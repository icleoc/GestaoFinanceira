"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Categoria, DadosNota, Dados, Id } from "@/lib/types";
import CategoriaNova, { NOVA_CATEGORIA } from "./CategoriaNova";
import type { PrefillParcelado } from "./DividaForm";
import { montarLancamento, num, round2, sameId, todayISO, type Operacao } from "@/lib/finance";
import { carteiraDaSessao, enviarNota, inserirTransacoes, removerNotas } from "@/lib/data";
import { camposLidos, lerNotaNoServidor } from "@/lib/nota";
import { sugerirCategoria } from "@/lib/categorizar";
import { dateBR, money } from "@/lib/format";
import { useCotacaoDaData } from "@/lib/cotacoes";
import {
  MOEDAS,
  contaEstrangeira,
  converter,
  moedaDaConta,
  ehMoedaValida,
  formatarEstrangeira,
  formatarTaxa,
  lerTaxa,
  simboloDe,
} from "@/lib/cambio";
import { reduzirImagem } from "@/lib/imagem";

export interface Prefill {
  chave: number;
  nome: string;
  valor: number;
  /** Conta de valor variável: pede para confirmar o valor deste mês. */
  flutuante?: boolean;
}

interface Props {
  dados: Dados;
  prefill: Prefill | null;
  onSalvo: (mensagem: string) => void;
  /** Abre o cadastro de financiamento ou empréstimo (só para quem pode gerenciar). */
  onDivida?: (parcelado?: PrefillParcelado) => void;
  /** Avisa que uma categoria foi criada aqui (para recarregar os dados). */
  onCategoria?: () => void;
  /** Dentro de uma janela: sem caixa e sem título próprios. */
  semMoldura?: boolean;
}

const OPERACOES: { id: Operacao; nome: string }[] = [
  { id: "despesa", nome: "Despesa" },
  { id: "receita", nome: "Receita" },
  { id: "transferencia", nome: "Transferência" },
  { id: "investimento", nome: "Investimento" },
];

const DESCRICAO_PADRAO: Partial<Record<Operacao, string>> = {
  transferencia: "Transferência",
  investimento: "Aporte / resgate",
};

const RESGATE: { dias: number; nome: string }[] = [
  { dias: 0, nome: "No mesmo dia" },
  ...Array.from({ length: 10 }, (_, i) => ({ dias: i + 1, nome: `${i + 1} ${i === 0 ? "dia" : "dias"}` })),
  { dias: 15, nome: "15 dias" },
  { dias: 30, nome: "30 dias" },
  { dias: 60, nome: "60 dias" },
  { dias: 90, nome: "90 dias" },
];

/** Aceita "1234.56", "1234,56" e "1.234,56". */
function lerValor(texto: string): number {
  const s = texto.trim();
  if (!s) return 0;
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

export default function LancamentoForm({ dados, prefill, onSalvo, onDivida, onCategoria, semMoldura = false }: Props) {
  const { contas, categorias, fixas } = dados;
  const raiz = useRef<HTMLElement>(null);

  const [operacao, setOperacao] = useState<Operacao>("despesa");
  const [data, setData] = useState(todayISO());
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [descAuto, setDescAuto] = useState(true);
  const [valor, setValor] = useState("");
  const [valorAuto, setValorAuto] = useState(false);
  const [confirmarValor, setConfirmarValor] = useState(false);
  const [origemId, setOrigemId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [dias, setDias] = useState(0);
  const [parcelas, setParcelas] = useState(1);
  const [comTaxa, setComTaxa] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [total, setTotal] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Moeda (câmbio automático nas receitas).
  const [moeda, setMoeda] = useState("BRL");
  // Valor que chegou na conta de destino, quando ela é em moeda estrangeira.
  const [recebidoTexto, setRecebidoTexto] = useState("");
  const recebidoManual = useRef(false);

  // Foto da nota.
  const [foto, setFoto] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const entradaFoto = useRef<HTMLInputElement>(null);
  // Leitura automática da nota (empresa, itens, valor, data e categoria).
  const [leitura, setLeitura] = useState<{ estado: "parado" | "lendo" | "ok" | "erro"; dados?: DadosNota; msg?: string }>({ estado: "parado" });
  const atual = useRef({ descAuto: true, valor: "", operacao: "despesa" as Operacao });

  atual.current = { descAuto, valor, operacao };
  const ehTransf = operacao === "transferencia" || operacao === "investimento";
  const tipoCategoria = operacao === "receita" ? "Receita" : "Despesa";
  const [criadas, setCriadas] = useState<Categoria[]>([]);
  const [criandoCat, setCriandoCat] = useState(false);
  const categoriasDoTipo = useMemo(() => {
    const base = categorias.filter((c) => c.tipo === tipoCategoria);
    const extras = criadas.filter((c) => c.tipo === tipoCategoria && !base.some((b) => String(b.id) === String(c.id)));
    return [...base, ...extras];
  }, [categorias, criadas, tipoCategoria]);

  const contasOrigem = useMemo(
    () => (operacao === "receita" ? contas.filter((c) => c.tipo !== "Crédito") : contas),
    [contas, operacao],
  );
  const origem = contas.find((c) => String(c.id) === origemId);
  const mostraParcelas = operacao !== "receita" && origem?.tipo === "Crédito";
  const parcelasEfetivas = mostraParcelas ? parcelas : 1;

  // Lembra a última moeda usada nas receitas (quem recebe em euro não precisa escolher toda vez).
  useEffect(() => {
    try {
      const guardada = localStorage.getItem("moedaReceita");
      if (guardada && ehMoedaValida(guardada) && operacao === "receita") setMoeda(guardada);
    } catch {
      /* sem armazenamento local */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conta em moeda estrangeira (OKX, Revolut…): o valor é digitado na moeda dela.
  const moedaConta = origem ? moedaDaConta(origem) : "BRL";
  const contaEstr = !!origem && contaEstrangeira(origem);
  const moedaEscolhivel = !contaEstr && (operacao === "receita" || operacao === "despesa");
  const moedaUsada = contaEstr ? moedaConta : moedaEscolhivel ? moeda : "BRL";
  const estrangeira = moedaUsada !== "BRL";

  // Destino em moeda estrangeira (transferência ou investimento).
  const destino = contas.find((c) => String(c.id) === destinoId);
  const moedaDestino = ehTransf && destino ? moedaDaConta(destino) : "BRL";
  const destinoEstr = moedaDestino !== "BRL";
  const mesmaMoedaNosDois = contaEstr && destinoEstr && moedaConta === moedaDestino;
  const moedasIncompativeis = contaEstr && destinoEstr && moedaConta !== moedaDestino;
  const precisaCotacaoDestino = destinoEstr && !mesmaMoedaNosDois;

  // Cotação de fechamento do dia escolhido (se paguei ontem, vale a de ontem).
  const principal = useCotacaoDaData(moedaUsada, data, estrangeira);
  const destinoQ = useCotacaoDaData(moedaDestino, data, precisaCotacaoDestino);
  const { taxaTexto, setTaxaTexto, cotacao } = principal;

  // Prévia e limpeza da foto.
  useEffect(() => {
    if (!foto) {
      setFotoUrl("");
      return;
    }
    const url = URL.createObjectURL(foto);
    setFotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    const reduzida = await reduzirImagem(arquivo);
    setFoto(reduzida);
    if (atual.current.operacao === "despesa") void lerFoto(reduzida);
  }

  async function lerFoto(blob: Blob) {
    setLeitura({ estado: "lendo" });
    try {
      const nomes = categorias.filter((c) => c.tipo === "Despesa").map((c) => c.nome);
      const dados = await lerNotaNoServidor(blob, carteiraDaSessao(), nomes);
      setLeitura({ estado: "ok", dados });
      preencherComLeitura(dados);
    } catch (err) {
      setLeitura({ estado: "erro", msg: err instanceof Error ? err.message : "Não consegui ler a nota." });
    }
  }

  /** Só preenche o que a pessoa ainda não digitou. */
  function preencherComLeitura(d: DadosNota) {
    if (d.total !== null && atual.current.valor.trim() === "") {
      setValor(String(d.total).replace(".", ","));
      setValorAuto(false);
    }
    if (d.empresa && atual.current.descAuto) {
      setDescricao(d.empresa);
      setDescAuto(false);
    }
    if (d.data) setData(d.data);
    const regra = sugerirCategoria(d.empresa, d.itens, categorias);
    const cat = regra?.existente ?? (!regra && d.categoria ? categorias.find((c) => c.tipo === "Despesa" && c.nome === d.categoria) : undefined);
    if (cat) setCategoriaId(String(cat.id));
  }

  // Conta de origem padrão: a primeira conta corrente.
  useEffect(() => {
    if (origemId && contasOrigem.some((c) => String(c.id) === origemId)) return;
    const padrao = contasOrigem.find((c) => c.tipo === "Corrente") ?? contasOrigem[0];
    setOrigemId(padrao ? String(padrao.id) : "");
  }, [contasOrigem, origemId]);

  // Categoria padrão ao trocar de operação.
  useEffect(() => {
    if (ehTransf) return;
    if (categoriasDoTipo.some((c) => String(c.id) === categoriaId)) return;
    setCategoriaId(categoriasDoTipo[0] ? String(categoriasDoTipo[0].id) : "");
  }, [categoriasDoTipo, categoriaId, ehTransf]);

  // Sugestão de descrição e de valor (contas fixas) a partir da categoria.
  useEffect(() => {
    if (ehTransf) {
      if (descAuto) setDescricao(DESCRICAO_PADRAO[operacao] ?? "");
      return;
    }
    const cat = categorias.find((c) => String(c.id) === categoriaId);
    if (!cat) return;
    if (descAuto) setDescricao(cat.nome);
    const fixa = fixas.find((f) => f.nome.trim().toLowerCase() === cat.nome.trim().toLowerCase());
    if (fixa && operacao === "despesa" && (valor === "" || valorAuto)) {
      setValor(String(num(fixa.valor)));
      setValorAuto(true);
    } else if (valorAuto) {
      setValor("");
      setValorAuto(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId, operacao]);

  // "Lançar" vindo do aviso de contas fixas.
  useEffect(() => {
    if (!prefill) return;
    setOperacao("despesa");
    const cat = categorias.find(
      (c) => c.tipo === "Despesa" && c.nome.trim().toLowerCase() === prefill.nome.trim().toLowerCase(),
    );
    if (cat) setCategoriaId(String(cat.id));
    setDescricao(prefill.nome);
    setDescAuto(false);
    setValor(String(prefill.valor).replace(".", ","));
    setValorAuto(false);
    setConfirmarValor(!!prefill.flutuante);
    setErro("");
    raiz.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.chave]);

  const digitado = lerValor(valor);
  const taxa = lerTaxa(taxaTexto);
  const taxaDestino = lerTaxa(destinoQ.taxaTexto);
  // Em moeda estrangeira, o valor digitado é convertido para reais com a cotação do dia.
  const liquido = estrangeira ? converter(digitado, taxa) : digitado;
  const cobrado = comTaxa ? lerValor(total) : liquido;

  // Quanto chega no destino em moeda estrangeira: mesma moeda = o digitado; saindo de reais, o convertido pela cotação do dia.
  useEffect(() => {
    if (!precisaCotacaoDestino || recebidoManual.current) return;
    setRecebidoTexto(liquido > 0 && taxaDestino > 0 ? String(round2(liquido / taxaDestino)).replace(".", ",") : "");
  }, [precisaCotacaoDestino, liquido, taxaDestino]);
  const recebido = mesmaMoedaNosDois ? digitado : lerValor(recebidoTexto);

  /** Compra parcelada em Pix ou boleto: vira um parcelamento com vencimentos e alertas. */
  function parcelarSemCartao(forma: "pix" | "boleto") {
    setErro("");
    if (!descricao.trim()) return setErro("Informe a descrição da compra (por exemplo, Honorários do advogado).");
    if (!(liquido > 0)) return setErro("Informe o valor total da compra.");
    onDivida?.({
      nome: descricao.trim(),
      valor: liquido,
      forma,
      categoriaId: categoriasDoTipo.find((c) => String(c.id) === categoriaId)?.id ?? null,
      contaId: contas.find((c) => String(c.id) === origemId && c.tipo !== "Crédito")?.id ?? null,
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    // Os selects devolvem texto; aqui volta para o id no tipo original (número ou uuid).
    const idDe = (lista: { id: Id }[], valor: string): Id | null => lista.find((x) => String(x.id) === valor)?.id ?? null;
    const r = montarLancamento({
      operacao,
      data,
      descricao,
      valor: liquido,
      parcelas: parcelasEfetivas,
      origemId: idDe(contas, origemId),
      destinoId: ehTransf ? idDe(contas, destinoId) : null,
      categoriaId: ehTransf ? null : idDe(categorias, categoriaId),
      diasResgate: operacao === "investimento" ? dias : 0,
      comTaxa: operacao !== "receita" && comTaxa,
      totalCobrado: lerValor(total),
      semSaldo: !ehTransf && historico,
    });
    if (estrangeira && !(taxa > 0)) return setErro("Informe a cotação para converter em reais.");
    if (moedasIncompativeis) return setErro("Para mover dinheiro entre duas moedas estrangeiras, passe pelo real: faça duas movimentações.");
    if (destinoEstr && !(recebido > 0)) return setErro(`Informe quanto chegou na conta de destino em ${moedaDestino}.`);
    if (!r.ok) return setErro(r.erro);
    // Conta em moeda estrangeira: cada lado guarda também o valor na moeda da conta (o banco usa isso no saldo).
    const linhas = r.linhas.map((l) => {
      if (contaEstr && origem && sameId(l.conta_origem_id, origem.id) && !l.descricao.startsWith("Recebido:") && !l.descricao.startsWith("Taxa:")) {
        return { ...l, valor_conta: l.valor < 0 ? -digitado : digitado };
      }
      if (destinoEstr && l.descricao.startsWith("Recebido:")) return { ...l, valor_conta: recebido };
      return l;
    });

    setEnviando(true);
    let caminhoNota: string | null = null;
    try {
      if (foto && !ehTransf) caminhoNota = await enviarNota(foto);
      const extras = {
        ...(caminhoNota ? { nota_path: caminhoNota } : {}),
        ...(caminhoNota && leitura.estado === "ok" && leitura.dados ? { nota_dados: leitura.dados } : {}),
        ...(estrangeira ? { moeda: moedaUsada, valor_original: digitado, taxa_cambio: taxa } : {}),
      };
      await inserirTransacoes(linhas.map((l) => ({ ...l, ...extras })));
      if (estrangeira && moedaEscolhivel && operacao === "receita") {
        try {
          localStorage.setItem("moedaReceita", moeda);
        } catch {
          /* ignora */
        }
      }
      const n = linhas.filter((l) => !l.descricao.startsWith("Taxa:") && !l.descricao.startsWith("Recebido:")).length;
      setDescricao("");
      setDescAuto(true);
      setValor("");
      setValorAuto(false);
      setConfirmarValor(false);
      setComTaxa(false);
      setTotal("");
      setParcelas(1);
      setRecebidoTexto("");
      recebidoManual.current = false;
      setFoto(null);
      setLeitura({ estado: "parado" });
      onSalvo(n > 1 ? `Registrado em ${n} parcelas.` : "Lançamento registrado.");
      // devolve a sugestão de descrição/categoria
      setCategoriaId((c) => c);
    } catch (err) {
      // Se a foto subiu mas o lançamento não entrou, não deixa a foto solta.
      if (caminhoNota) await removerNotas([caminhoNota]).catch(() => undefined);
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setEnviando(false);
    }
  }

  function trocarOperacao(op: Operacao) {
    setOperacao(op);
    // Receita lembra a última moeda; despesa começa em reais.
    try {
      const guardada = localStorage.getItem("moedaReceita");
      setMoeda(op === "receita" && guardada && ehMoedaValida(guardada) ? guardada : "BRL");
    } catch {
      setMoeda("BRL");
    }
    setErro("");
    setDescAuto(true);
    if (op === "transferencia" || op === "investimento") {
      setDestinoId((d) => (d && !sameId(d, origemId) ? d : ""));
    }
  }

  const textoDaCotacao = (q: { dia?: string }) => {
    const dia = q.dia ?? data;
    const aviso = q.dia && q.dia !== data ? " (último dia útil)" : "";
    return "Cotação de fechamento de " + dateBR(dia) + aviso + ". Se a sua conta usou outra, corrija acima.";
  };

  const botao =
    operacao === "receita" ? "Registrar receita" : ehTransf ? "Registrar movimentação" : "Registrar despesa";

  return (
    <section ref={raiz} className={semMoldura ? "p-5" : "panel p-5 sm:p-6"} aria-labelledby="titulo-lancamento">
      <h2 id="titulo-lancamento" className={semMoldura ? "sr-only" : "font-display text-lg font-semibold"}>
        Novo lançamento
      </h2>

      <div role="radiogroup" aria-label="Tipo de lançamento" className={(semMoldura ? "" : "mt-4 ") + "grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1"}>
        {OPERACOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={operacao === o.id}
            onClick={() => trocarOperacao(o.id)}
            className={"rounded-lg px-2 py-2 text-sm font-medium transition-colors " + (operacao === o.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {o.nome}
          </button>
        ))}
        {onDivida && (
          <button type="button" onClick={() => onDivida()} className="col-span-2 rounded-lg px-2 py-2 text-sm font-medium text-muted transition-colors hover:text-ink">
            Financiamento ou empréstimo
          </button>
        )}
      </div>

      <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-data" className="label">
              Data
            </label>
            <input id="f-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="field" required />
          </div>
          {!ehTransf && (
            <div>
              <label htmlFor="f-cat" className="label">
                Categoria
              </label>
              <select
                id="f-cat"
                value={criandoCat ? NOVA_CATEGORIA : categoriaId}
                onChange={(e) => {
                  if (e.target.value === NOVA_CATEGORIA) setCriandoCat(true);
                  else {
                    setCriandoCat(false);
                    setCategoriaId(e.target.value);
                  }
                }}
                className="field"
              >
                {categoriasDoTipo.length === 0 && !criandoCat && <option value="">Sem categoria</option>}
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
                <option value={NOVA_CATEGORIA}>＋ Nova categoria…</option>
              </select>
              {categoriasDoTipo.length === 0 && !criandoCat && (
                <p className="mt-1 text-xs text-muted">Não há categorias ainda. Escolha “Nova categoria” para criar.</p>
              )}
            </div>
          )}
        </div>

        {!ehTransf && criandoCat && (
          <CategoriaNova
            tipo={tipoCategoria}
            existentes={categorias}
            onCancelar={() => setCriandoCat(false)}
            onCriada={(c) => {
              setCriadas((l) => [...l, c]);
              setCategoriaId(String(c.id));
              setCriandoCat(false);
              onCategoria?.();
            }}
          />
        )}

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <label htmlFor="f-desc" className="label">
              Descrição
            </label>
            <input
              id="f-desc"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                setDescAuto(false);
              }}
              onFocus={(e) => descAuto && e.target.select()}
              className="field"
              required
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="f-valor" className="label">
              Valor ({simboloDe(moedaUsada)})
            </label>
            <input
              id="f-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setValorAuto(false);
              }}
              className="field num"
              required
            />
            {confirmarValor && (
              <p className="mt-1.5 rounded-lg bg-warn/10 px-3 py-2 text-sm font-medium text-warn" role="status">
                Esta conta muda todo mês. Confira o valor de agora antes de lançar (o que está aí é só o valor base).
              </p>
            )}
          </div>
        </div>

        {(moedaEscolhivel || contaEstr) && (
          <div className="rounded-xl bg-sunken p-3">
            {contaEstr ? (
              <p className="text-sm">
                Esta conta é em <b>{moedaConta}</b>: digite o valor em {MOEDAS.find((m) => m.codigo === moedaConta)?.nome.toLowerCase()}. O app converte para reais com a cotação do dia da data escolhida.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="f-moeda" className="text-sm font-medium">
                  {operacao === "receita" ? "Em que moeda você recebeu?" : "Em que moeda foi pago?"}
                </label>
                <select id="f-moeda" value={moeda} onChange={(e) => setMoeda(e.target.value)} className="field w-auto py-1.5 pr-8 text-sm">
                  {MOEDAS.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.simbolo} {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {estrangeira && (
              <div className="mt-3" aria-live="polite">
                <label htmlFor="f-taxa" className="label">
                  Cotação ({moedaUsada} → R$)
                </label>
                <input id="f-taxa" inputMode="decimal" value={taxaTexto} onChange={(e) => setTaxaTexto(e.target.value)} placeholder="0,0000" className="field num" />
                <p className="mt-1.5 text-sm text-muted">
                  {cotacao.estado === "buscando" && "Buscando a cotação de fechamento…"}
                  {cotacao.estado === "erro" && <span className="text-neg">{cotacao.msg}</span>}
                  {cotacao.estado === "ok" && textoDaCotacao(cotacao)}
                </p>
                {digitado > 0 && taxa > 0 && (
                  <p className="num mt-2 rounded-lg bg-surface px-3 py-2 text-sm">
                    {formatarEstrangeira(digitado, moedaUsada)} × {formatarTaxa(taxa)} = <b className="font-semibold">{money(liquido)}</b>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className={ehTransf ? "grid gap-3 grid-cols-2" : "grid gap-3 grid-cols-1"}>
          <div>
            <label htmlFor="f-origem" className="label">
              {operacao === "despesa" ? "Pago com" : operacao === "receita" ? "Entra em" : "Sai de"}
            </label>
            <select id="f-origem" value={origemId} onChange={(e) => setOrigemId(e.target.value)} className="field" required>
              {contasOrigem.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nome}
                  {contaEstrangeira(c) ? ` (${moedaDaConta(c)})` : ""}
                </option>
              ))}
            </select>
          </div>
          {ehTransf && (
            <div>
              <label htmlFor="f-destino" className="label">
                Entra em
              </label>
              <select id="f-destino" value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="field" required>
                <option value="">Escolha…</option>
                {contas
                  .filter((c) => !sameId(c.id as Id, origemId))
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nome}
                      {contaEstrangeira(c) ? ` (${moedaDaConta(c)})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {precisaCotacaoDestino && (
          <div className="rounded-xl bg-sunken p-3" aria-live="polite">
            <p className="text-sm">
              O destino é em <b>{moedaDestino}</b>. O app calcula quanto chega com a cotação de fechamento do dia escolhido; corrija se o seu banco usou outra.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="f-taxa-dest" className="label">
                  Cotação ({moedaDestino} → R$)
                </label>
                <input id="f-taxa-dest" inputMode="decimal" value={destinoQ.taxaTexto} onChange={(e) => { destinoQ.setTaxaTexto(e.target.value); recebidoManual.current = false; }} className="field num" placeholder="0,0000" />
              </div>
              <div>
                <label htmlFor="f-recebido" className="label">
                  Chegou ({simboloDe(moedaDestino)})
                </label>
                <input id="f-recebido" inputMode="decimal" value={recebidoTexto} onChange={(e) => { setRecebidoTexto(e.target.value); recebidoManual.current = true; }} className="field num" placeholder="0,00" />
              </div>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {destinoQ.cotacao.estado === "buscando" && "Buscando a cotação de fechamento…"}
              {destinoQ.cotacao.estado === "erro" && <span className="text-neg">{destinoQ.cotacao.msg}</span>}
              {destinoQ.cotacao.estado === "ok" && textoDaCotacao(destinoQ.cotacao)}
            </p>
          </div>
        )}
        {mesmaMoedaNosDois && digitado > 0 && (
          <p className="num rounded-xl bg-sunken px-3 py-2 text-sm">Chegam {formatarEstrangeira(digitado, moedaDestino)} na conta de destino.</p>
        )}
        {moedasIncompativeis && (
          <p role="alert" className="text-sm font-medium text-neg">
            Origem em {moedaConta} e destino em {moedaDestino}: passe pelo real, em duas movimentações.
          </p>
        )}

        {operacao === "investimento" && (
          <div>
            <label htmlFor="f-resgate" className="label">
              Prazo para o dinheiro cair no destino
            </label>
            <select id="f-resgate" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="field">
              {RESGATE.map((r) => (
                <option key={r.dias} value={r.dias}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {mostraParcelas && (
          <div>
            <label htmlFor="f-parc" className="label">
              Parcelamento
            </label>
            <select id="f-parc" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="field">
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : n + "x"}
                </option>
              ))}
            </select>
            {parcelas > 1 && cobrado > 0 && (
              <p className="num mt-1.5 text-sm text-muted">
                {parcelas}x de {money(round2(cobrado / parcelas))}
              </p>
            )}
          </div>
        )}

        {operacao === "despesa" && onDivida && (
          <div className="rounded-xl border border-dashed border-line p-3">
            <p className="text-sm font-medium">Vai pagar em parcelas sem cartão?</p>
            <p className="mt-0.5 text-sm text-muted">Pix parcelado ou boleto: você escolhe quantas parcelas e o app avisa cada vencimento.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => parcelarSemCartao("pix")} className="btn btn-quiet px-3 py-1.5">
                Parcelar no Pix
              </button>
              <button type="button" onClick={() => parcelarSemCartao("boleto")} className="btn btn-quiet px-3 py-1.5">
                Parcelar no boleto
              </button>
            </div>
          </div>
        )}

        {!ehTransf && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-sunken p-3 text-sm">
            <input type="checkbox" checked={historico} onChange={(e) => setHistorico(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
            <span>
              <span className="font-medium">Lançamento de histórico</span>
              <span className="block text-muted">Registra no extrato e nas parcelas, mas não mexe no saldo nem na fatura atual. Use para justificar o que já estava na conta ou no cartão antes de começar a usar o app.</span>
            </span>
          </label>
        )}

        {operacao !== "receita" && (
          <div className="rounded-xl bg-sunken p-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={comTaxa}
                onChange={(e) => setComTaxa(e.target.checked)}
                className="size-4 accent-[rgb(var(--accent))]"
              />
              Cobraram taxa ou juros por cima
            </label>
            {comTaxa && (
              <div className="mt-3">
                <label htmlFor="f-total" className="label">
                  Total cobrado, já com a taxa (R$)
                </label>
                <input
                  id="f-total"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="field num"
                />
                {liquido > 0 && cobrado > liquido && (
                  <p className="num mt-1.5 text-sm text-muted">Taxa de {money(round2(cobrado - liquido))}, registrada à parte.</p>
                )}
              </div>
            )}
          </div>
        )}

        {!ehTransf && (
          <div>
            <input
              ref={entradaFoto}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={escolherFoto}
              className="sr-only"
              id="f-foto"
              tabIndex={-1}
            />
            {foto ? (
              <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
                {fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoUrl} alt="Foto da nota" className="size-16 rounded-lg object-cover" />
                ) : (
                  <span className="size-16 rounded-lg bg-line" aria-hidden />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">Nota anexada</p>
                  <p className="text-muted">{Math.max(1, Math.round(foto.size / 1024))} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFoto(null);
                    setLeitura({ estado: "parado" });
                  }}
                  className="btn btn-quiet px-3 py-1.5"
                >
                  Remover
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => entradaFoto.current?.click()}
                className="btn btn-quiet w-full border-dashed py-3"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Tirar foto da nota
              </button>
            )}
            {foto && leitura.estado === "lendo" && (
              <p role="status" className="mt-2 animate-pulse text-sm text-muted">
                Lendo a nota: empresa, itens e valor…
              </p>
            )}
            {foto && leitura.estado === "erro" && (
              <div role="alert" className="mt-2 text-sm">
                <p className="text-warn">{leitura.msg}</p>
                {atual.current.operacao === "despesa" && (
                  <button type="button" onClick={() => void lerFoto(foto)} className="mt-1 font-semibold underline">
                    Tentar ler de novo
                  </button>
                )}
              </div>
            )}
            {foto && leitura.estado === "ok" && leitura.dados && (
              <div role="status" className="mt-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
                <p className="font-semibold text-accent">
                  {camposLidos(leitura.dados) === 0 ? "Não consegui ler esta nota." : "Nota lida. Confira antes de registrar."}
                </p>
                {leitura.dados.empresa && <p className="mt-1">{leitura.dados.empresa}</p>}
                {leitura.dados.total !== null && <p className="num text-muted">Total {money(leitura.dados.total)}</p>}
                {leitura.dados.itens.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted">{leitura.dados.itens.length} itens</summary>
                    <ul className="mt-1 space-y-0.5">
                      {leitura.dados.itens.map((it, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">
                            {it.quantidade && it.quantidade !== 1 ? `${it.quantidade}× ` : ""}
                            {it.nome}
                          </span>
                          {it.valor !== null && <span className="num shrink-0">{money(it.valor)}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className="btn btn-primary w-full py-3">
          {enviando ? "Registrando…" : botao}
        </button>
      </form>
    </section>
  );
}
