// Moedas e câmbio. A conversão usa a cotação do dia do lançamento.

import { num, round2 } from "./finance";
import type { Conta } from "./types";
import { emDemo } from "./demo";

export interface Moeda {
  codigo: string;
  nome: string;
  simbolo: string;
}

export const MOEDAS: Moeda[] = [
  { codigo: "BRL", nome: "Real", simbolo: "R$" },
  { codigo: "EUR", nome: "Euro", simbolo: "€" },
  { codigo: "USD", nome: "Dólar", simbolo: "US$" },
  { codigo: "GBP", nome: "Libra", simbolo: "£" },
  { codigo: "CHF", nome: "Franco suíço", simbolo: "CHF" },
];

export const MOEDAS_ESTRANGEIRAS = MOEDAS.filter((m) => m.codigo !== "BRL");

export function ehMoedaValida(codigo: string): boolean {
  return MOEDAS.some((m) => m.codigo === codigo);
}

export function simboloDe(codigo: string): string {
  return MOEDAS.find((m) => m.codigo === codigo)?.simbolo ?? codigo;
}

/** Valor em moeda estrangeira vezes a cotação, arredondado em centavos. */
export function converter(valor: number, taxa: number): number {
  if (!(valor > 0) || !(taxa > 0)) return 0;
  return round2(valor * taxa);
}

/** Aceita "6.2345" e "6,2345". */
export function lerTaxa(texto: string): number {
  const n = parseFloat(texto.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatarTaxa(taxa: number): string {
  return taxa.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function formatarEstrangeira(valor: number, codigo: string): string {
  const n = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${simboloDe(codigo)} ${n}`;
}

export interface Cotacao {
  taxa: number;
  /** Dia a que a cotação se refere (fim de semana usa o último dia útil). */
  dataCotacao: string;
}

/** Busca a cotação no servidor do próprio sistema. */
export async function buscarCotacao(moeda: string, data: string): Promise<Cotacao> {
  if (emDemo()) return { taxa: taxaDemo(moeda), dataCotacao: data };
  const r = await fetch(`/api/cambio?moeda=${encodeURIComponent(moeda)}&data=${encodeURIComponent(data)}`);
  const corpo = (await r.json().catch(() => ({}))) as Partial<Cotacao> & { erro?: string };
  if (!r.ok || !corpo.taxa) throw new Error(corpo.erro ?? "Não foi possível buscar a cotação agora.");
  return { taxa: corpo.taxa, dataCotacao: corpo.dataCotacao ?? data };
}

/* ---------- contas em moeda estrangeira ---------- */

/** Cotação atual em reais de cada moeda, por código (USD, EUR…). */
export type Taxas = Record<string, number>;

export const moedaDaConta = (c: Pick<Conta, "moeda">): string => c.moeda || "BRL";
export const contaEstrangeira = (c: Pick<Conta, "moeda">): boolean => moedaDaConta(c) !== "BRL";

/** Saldo da conta em reais. Conta em moeda estrangeira usa a cotação atual (ou, sem ela, o custo de compra). */
export function saldoEmReais(c: Conta, taxas: Taxas): number {
  const saldo = num(c.saldo_atual);
  if (!contaEstrangeira(c)) return saldo;
  const t = taxas[moedaDaConta(c)];
  return t > 0 ? round2(saldo * t) : num(c.custo_brl);
}

export interface VariacaoCambial {
  /** Valor de hoje em reais. */
  atual: number;
  /** Quanto custou em reais. */
  custo: number;
  /** atual - custo (positivo = ganhou com o câmbio). */
  variacao: number;
  pct: number;
  /** Custo médio por unidade da moeda. */
  taxaMedia: number;
}

/** Ganho ou perda com o câmbio de uma conta em moeda estrangeira. Nulo se não há cotação ou saldo. */
export function variacaoCambial(c: Conta, taxas: Taxas): VariacaoCambial | null {
  if (!contaEstrangeira(c)) return null;
  const t = taxas[moedaDaConta(c)];
  const saldo = num(c.saldo_atual);
  const custo = num(c.custo_brl);
  if (!(t > 0) || !(saldo > 0) || !(custo > 0)) return null;
  const atual = round2(saldo * t);
  return { atual, custo, variacao: round2(atual - custo), pct: round2(((atual - custo) / custo) * 100), taxaMedia: custo / saldo };
}

/** Saldo em reais de todas as contas de um tipo, convertendo as estrangeiras. */
export function somaEmReais(contas: Conta[], taxas: Taxas): number {
  return round2(contas.reduce((s, c) => s + saldoEmReais(c, taxas), 0));
}

/**
 * Custo em reais de uma conta em moeda estrangeira depois de corrigir o saldo na mão.
 * Saldo maior: o que entrou custou a cotação de hoje. Saldo menor: o custo cai na mesma proporção.
 */
export function custoAposAjuste(saldoAntigo: number, custoAntigo: number, saldoNovo: number, taxaHoje: number): number {
  if (!(saldoNovo > 0)) return 0;
  if (saldoNovo >= saldoAntigo) return round2(Math.max(0, custoAntigo) + (saldoNovo - Math.max(0, saldoAntigo)) * taxaHoje);
  return saldoAntigo > 0 ? round2((Math.max(0, custoAntigo) * saldoNovo) / saldoAntigo) : round2(saldoNovo * taxaHoje);
}

/** Cotação fixa usada na demonstração (sem consultar a internet). */
export function taxaDemo(moeda: string): number {
  return ({ USD: 5.4312, EUR: 6.2874, GBP: 7.21, CHF: 6.7 } as Record<string, number>)[moeda] ?? 1;
}
