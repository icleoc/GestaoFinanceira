"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dados, DadosNota, Id } from "@/lib/types";
import { montarLancamento, todayISO } from "@/lib/finance";
import CategoriaNova, { NOVA_CATEGORIA } from "./CategoriaNova";
import { atualizarTransacoes, carteiraDaSessao, criarCategoria, enviarNota, excluirTransacoes, inserirTransacoes, mudarCategoria, removerNotas } from "@/lib/data";
import { acharNotaAnterior, camposLidos, lerNotaNoServidor } from "@/lib/nota";
import { sugerirCategoria } from "@/lib/categorizar";
import { reduzirImagem } from "@/lib/imagem";
import { dateBR, money } from "@/lib/format";
import Modal from "./Modal";

type Fase =
  | { f: "inicio" }
  | { f: "lendo"; url: string }
  | { f: "pronto"; url: string; resumo: Resumo }
  | { f: "erro"; url: string | null; msg: string };

interface Resumo {
  empresa: string;
  total: number;
  data: string;
  categoria: string | null;
  categoriaCriada: boolean;
  conta: string;
  ids: Id[];
  caminho: string | null;
  itens: DadosNota["itens"];
  /** Razão social como saiu na nota (o nome do lançamento pode ser outro). */
  lidoNaNota: string;
  categoriaId: Id | null;
  /** Reconhecida por uma nota anterior da mesma empresa. */
  lembrada: boolean;
  parcelas: number;
  /** Data e valor de cada lançamento (várias linhas quando parcelado no cartão). */
  linhas: { data: string; valor: number }[];
}

const CHAVE = "contaDasNotas";

/**
 * Lançamento por foto, num toque só: a pessoa escolhe de onde saiu o dinheiro e tira a foto.
 * O sistema lê a nota, escolhe a categoria pelo tipo de estabelecimento e já registra.
 */
export default function NotaRapida({ dados, onClose, onMudou }: { dados: Dados; onClose: () => void; onMudou: (msg: string) => void }) {
  const contas = useMemo(() => dados.contas.filter((c) => c.tipo !== "Investimento" && (!c.moeda || c.moeda === "BRL")), [dados.contas]);
  const [contaId, setContaId] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [fase, setFase] = useState<Fase>({ f: "inicio" });
  const entrada = useRef<HTMLInputElement>(null);
  const jaRegistrou = useRef(false);

  // Conta usada na última nota; senão, a primeira conta corrente.
  useEffect(() => {
    let salva = "";
    try {
      salva = localStorage.getItem(CHAVE) ?? "";
    } catch {
      /* sem armazenamento: tudo bem */
    }
    const padrao = contas.find((c) => String(c.id) === salva) ?? contas.find((c) => c.tipo === "Corrente") ?? contas[0];
    setContaId(padrao ? String(padrao.id) : "");
  }, [contas]);

  // Libera o endereço temporário da miniatura ao trocar/fechar.
  useEffect(() => {
    const url = fase.f === "inicio" ? null : fase.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [fase]);

  async function processar(arquivo: File) {
    const conta = contas.find((c) => String(c.id) === contaId);
    if (!conta) return setFase({ f: "erro", url: null, msg: "Escolha de onde saiu o dinheiro." });
    try {
      localStorage.setItem(CHAVE, contaId);
    } catch {
      /* ignora */
    }
    const blob = await reduzirImagem(arquivo);
    const url = URL.createObjectURL(blob);
    setFase({ f: "lendo", url });

    let caminho: string | null = null;
    try {
      const nomes = dados.categorias.filter((c) => c.tipo === "Despesa").map((c) => c.nome);
      const lido = await lerNotaNoServidor(blob, carteiraDaSessao(), nomes);
      if (lido.total === null || !(lido.total > 0)) {
        return setFase({ f: "erro", url, msg: "Não consegui achar o valor total na nota. Tente outra foto, com mais luz e a nota inteira." });
      }
      if (camposLidos(lido) < 2) {
        return setFase({ f: "erro", url, msg: "A leitura ficou incompleta. Tente outra foto, com a nota inteira e bem enquadrada." });
      }

      // Categoria: primeiro as regras por tipo de estabelecimento (padaria, posto, farmácia...); se nenhuma
      // reconhecer, vale a sugestão da leitura. Se a carteira não tiver a categoria, ela é criada (quando a pessoa pode).
      const anterior = acharNotaAnterior(dados.transacoes, lido);
      const regra = sugerirCategoria(lido.empresa, lido.itens, dados.categorias);
      let categoriaId: Id | null = null;
      let categoriaNome: string | null = null;
      let criada = false;
      const catAnterior = anterior?.categoria_id != null ? dados.categorias.find((x) => x.tipo === "Despesa" && String(x.id) === String(anterior.categoria_id)) : undefined;
      const nomeParaCriar = catAnterior ? null : regra ? regra.criar : lido.categoria ? null : lido.categoriaNova ?? null;
      if (catAnterior) {
        // A pessoa já escolheu a categoria desta empresa numa nota anterior: vale o que ela escolheu.
        categoriaId = catAnterior.id;
        categoriaNome = catAnterior.nome;
      } else if (regra?.existente) {
        categoriaId = regra.existente.id;
        categoriaNome = regra.existente.nome;
      } else if (!regra && lido.categoria) {
        const c = dados.categorias.find((x) => x.tipo === "Despesa" && x.nome === lido.categoria);
        categoriaId = c?.id ?? null;
        categoriaNome = c?.nome ?? null;
      } else if (nomeParaCriar) {
        try {
          categoriaId = await criarCategoria({ nome: nomeParaCriar, tipo: "Despesa" });
          categoriaNome = nomeParaCriar;
          criada = true;
        } catch {
          /* sem permissão para criar: cai para Outros */
        }
      }
      if (categoriaId === null) {
        const outros = dados.categorias.find((c) => c.tipo === "Despesa" && /^outros?$/i.test(c.nome.trim()));
        categoriaId = outros?.id ?? null;
        categoriaNome = outros?.nome ?? null;
      }

      const lidoNaNota = lido.empresa ?? "Compra";
      const empresa = anterior?.descricao?.trim() || lidoNaNota;
      const data = lido.data ?? todayISO();
      const plano = montarLancamento({
        operacao: "despesa",
        data,
        descricao: empresa,
        valor: lido.total,
        parcelas: conta.tipo === "Crédito" ? parcelas : 1,
        origemId: conta.id,
        destinoId: null,
        categoriaId,
        diasResgate: 0,
        comTaxa: false,
        totalCobrado: 0,
      });
      if (!plano.ok) return setFase({ f: "erro", url, msg: plano.erro });

      caminho = await enviarNota(blob);
      const ids = await inserirTransacoes(plano.linhas.map((l) => ({ ...l, nota_path: caminho, nota_dados: lido })));
      jaRegistrou.current = true;
      setFase({
        f: "pronto",
        url,
        resumo: { empresa, total: lido.total, data, categoria: categoriaNome, categoriaCriada: criada, conta: conta.nome, ids, caminho, itens: lido.itens, lidoNaNota, categoriaId, lembrada: !!anterior, parcelas: plano.linhas.length > 1 ? plano.linhas.length : 1, linhas: plano.linhas.map((l) => ({ data: l.data, valor: l.valor })) },
      });
    } catch (e) {
      if (caminho) await removerNotas([caminho]).catch(() => undefined);
      setFase({ f: "erro", url, msg: e instanceof Error ? e.message : "Não foi possível registrar a nota." });
    }
  }

  async function desfazer(r: Resumo) {
    try {
      await excluirTransacoes(r.ids);
      if (r.caminho) await removerNotas([r.caminho]).catch(() => undefined);
      jaRegistrou.current = false;
      setFase({ f: "inicio" });
      onMudou("Lançamento desfeito.");
    } catch (e) {
      setFase({ f: "erro", url: null, msg: e instanceof Error ? e.message : "Não foi possível desfazer." });
    }
  }

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void processar(arquivo);
  }

  function fechar() {
    if (jaRegistrou.current) onMudou("Nota registrada.");
    onClose();
  }

  const ocupado = fase.f === "lendo";

  return (
    <Modal titulo="Lançar por foto" onClose={fechar} largura="md">
      <div className="space-y-4 p-5">
        <input ref={entrada} type="file" accept="image/*" capture="environment" onChange={aoEscolher} className="sr-only" id="nota-rapida" tabIndex={-1} />

        {(fase.f === "inicio" || fase.f === "erro" || fase.f === "pronto") && (
          <div>
            <label htmlFor="nr-conta" className="label">
              De onde saiu o dinheiro?
            </label>
            <select id="nr-conta" value={contaId} onChange={(e) => setContaId(e.target.value)} className="field" disabled={ocupado}>
              {contas.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {contas.find((c) => String(c.id) === contaId)?.tipo === "Crédito" && fase.f !== "pronto" && (
          <div>
            <label htmlFor="nr-parc" className="label">
              Parcelamento no cartão
            </label>
            <select id="nr-parc" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="field" disabled={ocupado}>
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : n + "x"}
                </option>
              ))}
            </select>
          </div>
        )}

        {fase.f === "lendo" && (
          <div className="flex items-center gap-3 rounded-xl bg-sunken p-3" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fase.url} alt="Nota enviada" className="size-16 rounded-lg object-cover" />
            <p className="animate-pulse text-sm text-muted">Lendo a nota e registrando…</p>
          </div>
        )}

        {fase.f === "erro" && (
          <p role="alert" className="text-sm font-medium text-neg">
            {fase.msg}
          </p>
        )}

        {fase.f === "pronto" && (
          <Resultado
            key={fase.resumo.ids.join(",")}
            r={fase.resumo}
            categorias={dados.categorias.filter((c) => c.tipo === "Despesa")}
            onDesfazer={() => void desfazer(fase.resumo)}
            onSalvo={(r) => setFase({ f: "pronto", url: fase.url, resumo: r })}
          />
        )}

        <button type="button" onClick={() => entrada.current?.click()} disabled={ocupado || contas.length === 0} className="btn btn-gold w-full py-3.5 text-base">
          {fase.f === "pronto" ? "Fotografar outra nota" : fase.f === "erro" ? "Tentar outra foto" : "Tirar foto da nota"}
        </button>
        <p className="text-center text-xs text-muted">O valor, a empresa e a categoria saem da própria nota. Confira o resultado e desfaça se algo estiver errado.</p>
      </div>
    </Modal>
  );
}

/** Resultado da leitura: nome e categoria podem ser corrigidos na hora. O app lembra a escolha para a próxima nota da mesma empresa. */
function Resultado({ r, categorias, onDesfazer, onSalvo }: { r: Resumo; categorias: Dados["categorias"]; onDesfazer: () => void; onSalvo: (r: Resumo) => void }) {
  const [nome, setNome] = useState(r.empresa);
  const [cat, setCat] = useState(r.categoriaId != null ? String(r.categoriaId) : "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [criadas, setCriadas] = useState<Dados["categorias"]>([]);
  const [criando, setCriando] = useState(false);
  const todas = [...categorias, ...criadas.filter((c) => !categorias.some((b) => String(b.id) === String(c.id)))];
  const mudou = nome.trim() !== r.empresa || cat !== (r.categoriaId != null ? String(r.categoriaId) : "");

  async function salvar() {
    setErro("");
    const limpo = nome.trim();
    if (!limpo) return setErro("Dê um nome ao lançamento.");
    setOcupado(true);
    try {
      const nova = todas.find((c) => String(c.id) === cat);
      if (limpo !== r.empresa) await atualizarTransacoes(r.ids.map((id, i) => ({ id, data: r.linhas[i]?.data ?? r.data, descricao: r.parcelas > 1 ? `${limpo} (${i + 1}/${r.parcelas})` : limpo, valor: r.linhas[i]?.valor ?? -r.total })));
      if (cat !== (r.categoriaId != null ? String(r.categoriaId) : "")) await mudarCategoria(r.ids, nova?.id ?? null);
      onSalvo({ ...r, empresa: limpo, categoria: nova?.nome ?? null, categoriaId: nova?.id ?? null, categoriaCriada: false });
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div role="status" className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="font-semibold text-accent">Registrado{r.lembrada ? " (empresa que você já usou antes)" : ""}</p>
      <p className="num font-display text-2xl">{money(r.total)}</p>
      <p className="text-sm text-muted">
        {r.conta} · {dateBR(r.data)}
        {r.itens.length > 0 ? ` · ${r.itens.length} ${r.itens.length === 1 ? "item lido" : "itens lidos"}` : ""}
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="nr-nome" className="label">
            Nome do lançamento
          </label>
          <input id="nr-nome" value={nome} onChange={(e) => { setNome(e.target.value); setSalvo(false); }} className="field" maxLength={80} />
          {r.lidoNaNota && r.lidoNaNota !== nome && <p className="mt-1 text-xs text-muted">Na nota: {r.lidoNaNota}</p>}
        </div>
        <div>
          <label htmlFor="nr-cat" className="label">
            Categoria
          </label>
          <select
            id="nr-cat"
            value={criando ? NOVA_CATEGORIA : cat}
            onChange={(e) => {
              if (e.target.value === NOVA_CATEGORIA) return setCriando(true);
              setCriando(false);
              setCat(e.target.value);
              setSalvo(false);
            }}
            className="field"
          >
            <option value="">Sem categoria</option>
            {todas.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
            <option value={NOVA_CATEGORIA}>＋ Nova categoria…</option>
          </select>
          {criando && (
            <CategoriaNova
              tipo="Despesa"
              existentes={todas}
              onCancelar={() => setCriando(false)}
              onCriada={(c) => {
                setCriadas((l) => [...l, c]);
                setCat(String(c.id));
                setCriando(false);
                setSalvo(false);
              }}
            />
          )}
          {!cat && <p className="mt-1 text-xs font-medium text-warn">Não identifiquei a categoria. Escolha uma acima.</p>}
          {r.categoriaCriada && cat === String(r.categoriaId) && <p className="mt-1 text-xs text-muted">Categoria nova criada a partir da nota.</p>}
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void salvar()} disabled={ocupado || !mudou} className="btn btn-primary px-4 py-2">
          {ocupado ? "Salvando…" : salvo ? "Salvo" : "Salvar alterações"}
        </button>
        <button type="button" onClick={onDesfazer} disabled={ocupado} className="text-sm font-semibold underline">
          Desfazer lançamento
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Na próxima nota desta empresa, o app usa este nome e esta categoria.</p>
    </div>
  );
}
