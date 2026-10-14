"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dados, Id } from "@/lib/types";
import { montarLancamento, num, round2, sameId, todayISO, type Operacao } from "@/lib/finance";
import { inserirTransacoes } from "@/lib/data";
import { money } from "@/lib/format";

export interface Prefill {
  chave: number;
  nome: string;
  valor: number;
}

interface Props {
  dados: Dados;
  prefill: Prefill | null;
  onSalvo: (mensagem: string) => void;
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

export default function LancamentoForm({ dados, prefill, onSalvo }: Props) {
  const { contas, categorias, fixas } = dados;
  const raiz = useRef<HTMLElement>(null);

  const [operacao, setOperacao] = useState<Operacao>("despesa");
  const [data, setData] = useState(todayISO());
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [descAuto, setDescAuto] = useState(true);
  const [valor, setValor] = useState("");
  const [valorAuto, setValorAuto] = useState(false);
  const [origemId, setOrigemId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [dias, setDias] = useState(0);
  const [parcelas, setParcelas] = useState(1);
  const [comTaxa, setComTaxa] = useState(false);
  const [total, setTotal] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ehTransf = operacao === "transferencia" || operacao === "investimento";
  const tipoCategoria = operacao === "receita" ? "Receita" : "Despesa";
  const categoriasDoTipo = useMemo(
    () => categorias.filter((c) => c.tipo === tipoCategoria),
    [categorias, tipoCategoria],
  );

  const contasOrigem = useMemo(
    () => (operacao === "receita" ? contas.filter((c) => c.tipo !== "Crédito") : contas),
    [contas, operacao],
  );
  const origem = contas.find((c) => String(c.id) === origemId);
  const mostraParcelas = operacao !== "receita" && origem?.tipo === "Crédito";
  const parcelasEfetivas = mostraParcelas ? parcelas : 1;

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
    setValor(String(prefill.valor));
    setValorAuto(false);
    setErro("");
    raiz.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.chave]);

  const liquido = lerValor(valor);
  const cobrado = comTaxa ? lerValor(total) : liquido;

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
    });
    if (!r.ok) return setErro(r.erro);

    setEnviando(true);
    try {
      await inserirTransacoes(r.linhas);
      const n = r.linhas.filter((l) => !l.descricao.startsWith("Taxa:") && !l.descricao.startsWith("Recebido:")).length;
      setDescricao("");
      setDescAuto(true);
      setValor("");
      setValorAuto(false);
      setComTaxa(false);
      setTotal("");
      setParcelas(1);
      onSalvo(n > 1 ? `Registrado em ${n} parcelas.` : "Lançamento registrado.");
      // devolve a sugestão de descrição/categoria
      setCategoriaId((c) => c);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setEnviando(false);
    }
  }

  function trocarOperacao(op: Operacao) {
    setOperacao(op);
    setErro("");
    setDescAuto(true);
    if (op === "transferencia" || op === "investimento") {
      setDestinoId((d) => (d && !sameId(d, origemId) ? d : ""));
    }
  }

  const botao =
    operacao === "receita" ? "Registrar receita" : ehTransf ? "Registrar movimentação" : "Registrar despesa";

  return (
    <section ref={raiz} className="panel p-5 sm:p-6" aria-labelledby="titulo-lancamento">
      <h2 id="titulo-lancamento" className="font-display text-lg font-semibold">
        Novo lançamento
      </h2>

      <div role="radiogroup" aria-label="Tipo de lançamento" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
        {OPERACOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={operacao === o.id}
            onClick={() => trocarOperacao(o.id)}
            className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
              operacao === o.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.nome}
          </button>
        ))}
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
              <select id="f-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="field">
                {categoriasDoTipo.length === 0 && <option value="">Crie uma em Gerenciar</option>}
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
              Valor (R$)
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
          </div>
        </div>

        <div className={`grid gap-3 ${ehTransf ? "grid-cols-2" : "grid-cols-1"}`}>
          <div>
            <label htmlFor="f-origem" className="label">
              {operacao === "despesa" ? "Pago com" : operacao === "receita" ? "Entra em" : "Sai de"}
            </label>
            <select id="f-origem" value={origemId} onChange={(e) => setOrigemId(e.target.value)} className="field" required>
              {contasOrigem.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nome}
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
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

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
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x`}
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
