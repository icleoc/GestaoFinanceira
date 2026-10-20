// Financiamentos e empréstimos: quanto de juros, valor final, saldo e parcelas.
// Tudo aqui é função pura (testável). As parcelas não viram lançamentos sozinhas:
// só entram no extrato quando a pessoa paga uma delas pelo app, então as parcelas
// antigas (retroativas) não mexem em relatório nenhum.

import type { Divida, TipoDivida } from "./types";
import { addMonthsISO, round2 } from "./finance";

export type { Divida, TipoDivida };

export interface EntradaCalculo {
  valorBem: number;
  entrada: number;
  parcelas: number;
  valorParcela: number;
}

export interface Calculo {
  ok: boolean;
  aviso: string | null;
  /** O que de fato foi financiado: valor do bem menos a entrada. */
  financiado: number;
  totalParcelas: number;
  /** Tudo o que sai do bolso: parcelas + entrada. */
  totalPago: number;
  juros: number;
  /** Juros sobre o valor financiado, em %. */
  jurosPct: number;
  /** Taxa mensal embutida nas parcelas, em % ao mês. */
  taxaMensalPct: number;
}

const num = (x: number | string | null | undefined) => {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

/** Valor presente de `n` parcelas de `pmt` à taxa `i` (fração ao mês). */
export function valorPresente(pmt: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i <= 0) return pmt * n;
  return (pmt * (1 - Math.pow(1 + i, -n))) / i;
}

/** Taxa mensal que faz as parcelas valerem exatamente o valor financiado (bisseção). 0 se não houver juros. */
export function taxaImplicita(financiado: number, pmt: number, n: number): number {
  if (!(financiado > 0) || !(pmt > 0) || n < 1 || pmt * n <= financiado) return 0;
  let lo = 0;
  let hi = 1; // 100% ao mês é mais do que qualquer financiamento real
  for (let k = 0; k < 200; k++) {
    const meio = (lo + hi) / 2;
    if (valorPresente(pmt, meio, n) > financiado) lo = meio;
    else hi = meio;
  }
  return (lo + hi) / 2;
}

export function calcular(e: EntradaCalculo): Calculo {
  const financiado = round2(e.valorBem - e.entrada);
  const totalParcelas = round2(e.parcelas * e.valorParcela);
  const base = { financiado, totalParcelas, totalPago: round2(totalParcelas + Math.max(0, e.entrada)), juros: 0, jurosPct: 0, taxaMensalPct: 0 };
  if (!(e.valorBem > 0) || !(e.parcelas >= 1) || !(e.valorParcela > 0)) {
    return { ok: false, aviso: null, ...base };
  }
  if (e.entrada < 0 || e.entrada >= e.valorBem) {
    return { ok: false, aviso: "A entrada precisa ser menor que o valor do bem.", ...base };
  }
  const juros = round2(totalParcelas - financiado);
  if (juros < 0) {
    return { ok: true, aviso: "As parcelas somam menos do que o valor financiado. Confira os valores.", ...base, juros, jurosPct: round2((juros / financiado) * 100) };
  }
  return {
    ok: true,
    aviso: null,
    ...base,
    juros,
    jurosPct: round2((juros / financiado) * 100),
    taxaMensalPct: Math.round(taxaImplicita(financiado, e.valorParcela, e.parcelas) * 10000) / 100,
  };
}

/** Vencimento da parcela `k` (1 = primeira). Mês curto cai no último dia. */
export function vencimento(primeira: string, k: number): string {
  return addMonthsISO(primeira, k - 1);
}

export interface Situacao {
  total: number;
  pagas: number;
  restantes: number;
  quitada: boolean;
  /** Índice (1..n) e data da próxima parcela a pagar. */
  proxima: { indice: number; data: string } | null;
  /** Parcelas não pagas cujo vencimento já passou. */
  atrasadas: number;
  /** Soma das parcelas que ainda faltam. */
  faltaPagar: number;
  /** Quanto custaria quitar hoje (parcelas que faltam trazidas a valor presente, sem os juros futuros). */
  saldoParaQuitar: number;
  /** Juros que ainda estão embutidos nas parcelas que faltam. */
  jurosRestantes: number;
  jurosPagos: number;
  pctPago: number;
}

export function situacao(d: Divida, hoje: string): Situacao {
  const n = Math.max(0, Math.trunc(d.parcelas));
  const pmt = num(d.valor_parcela);
  const pagas = Math.min(n, Math.max(0, Math.trunc(d.parcelas_pagas)));
  const restantes = n - pagas;
  const financiado = num(d.valor_bem) - num(d.entrada);
  const i = taxaImplicita(financiado, pmt, n);
  const faltaPagar = round2(restantes * pmt);
  const saldoParaQuitar = round2(Math.min(faltaPagar, valorPresente(pmt, i, restantes)));
  const jurosTotal = Math.max(0, round2(n * pmt - financiado));
  const jurosRestantes = round2(faltaPagar - saldoParaQuitar);
  let atrasadas = 0;
  for (let k = pagas + 1; k <= n; k++) {
    if (vencimento(d.primeira_parcela, k) < hoje) atrasadas++;
    else break;
  }
  return {
    total: n,
    pagas,
    restantes,
    quitada: restantes === 0,
    proxima: restantes > 0 ? { indice: pagas + 1, data: vencimento(d.primeira_parcela, pagas + 1) } : null,
    atrasadas,
    faltaPagar,
    saldoParaQuitar,
    jurosRestantes,
    jurosPagos: round2(Math.max(0, jurosTotal - jurosRestantes)),
    pctPago: n > 0 ? Math.round((pagas / n) * 100) : 0,
  };
}

export interface ResumoDividas {
  /** Soma das parcelas mensais das dívidas em aberto. */
  mensal: number;
  faltaPagar: number;
  saldoParaQuitar: number;
  jurosRestantes: number;
  emAberto: number;
  atrasadas: number;
}

export function resumir(dividas: Divida[], hoje: string): ResumoDividas {
  const r: ResumoDividas = { mensal: 0, faltaPagar: 0, saldoParaQuitar: 0, jurosRestantes: 0, emAberto: 0, atrasadas: 0 };
  for (const d of dividas) {
    const s = situacao(d, hoje);
    if (s.quitada) continue;
    r.emAberto++;
    r.mensal += num(d.valor_parcela);
    r.faltaPagar += s.faltaPagar;
    r.saldoParaQuitar += s.saldoParaQuitar;
    r.jurosRestantes += s.jurosRestantes;
    r.atrasadas += s.atrasadas;
  }
  return { ...r, mensal: round2(r.mensal), faltaPagar: round2(r.faltaPagar), saldoParaQuitar: round2(r.saldoParaQuitar), jurosRestantes: round2(r.jurosRestantes) };
}

/** Descrição do lançamento de uma parcela paga: "Carro (3/48)", no mesmo formato das compras parceladas. */
export function descricaoDaParcela(nome: string, indice: number, total: number): string {
  return `${nome.trim()} (${indice}/${total})`;
}
