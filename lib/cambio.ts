// Moedas e câmbio. A conversão usa a cotação do dia do lançamento.

import { round2 } from "./finance";

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
  const r = await fetch(`/api/cambio?moeda=${encodeURIComponent(moeda)}&data=${encodeURIComponent(data)}`);
  const corpo = (await r.json().catch(() => ({}))) as Partial<Cotacao> & { erro?: string };
  if (!r.ok || !corpo.taxa) throw new Error(corpo.erro ?? "Não foi possível buscar a cotação agora.");
  return { taxa: corpo.taxa, dataCotacao: corpo.dataCotacao ?? data };
}
