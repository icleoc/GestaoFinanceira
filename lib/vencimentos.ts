// Agenda de vencimentos: contas fixas do mês e parcelas de financiamentos e empréstimos num lugar só.
// Funções puras (testáveis), usadas pela tela e pelo calendário (.ics).

import type { Aviso, DespesaFixa, Divida, Transacao } from "./types";
import { addDaysISO, addMonthsISO, daysInMonth, monthOf, num, parseISO } from "./finance";
import { situacao, vencimento } from "./divida";

export interface Vencimento {
  /** 'fixa:<id>' ou 'divida:<id>': é isto que cada pessoa escolhe para ser avisada. */
  chave: string;
  origem: "fixa" | "divida";
  nome: string;
  valor: number;
  data: string;
  /** Dias até o vencimento (negativo = atrasada, 0 = hoje). */
  dias: number;
  /** Para parcelas: número da parcela e total. */
  indice?: number;
  total?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = parseISO(de);
  const [y2, m2, d2] = parseISO(ate);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export const chaveFixa = (f: Pick<DespesaFixa, "id">) => `fixa:${f.id}`;
export const chaveDivida = (d: Pick<Divida, "id">) => `divida:${d.id}`;

interface Entrada {
  fixas: DespesaFixa[];
  transacoes: Transacao[];
  dividas?: Divida[];
}

/**
 * Próximos vencimentos até `janela` dias à frente, do mais próximo para o mais distante.
 * Conta fixa já lançada neste mês não aparece neste mês. De cada financiamento entra sempre a próxima
 * parcela (mesmo atrasada); as seguintes só se caírem dentro da janela.
 */
export function proximosVencimentos(dados: Entrada, hoje: string, janela = 45): Vencimento[] {
  const limite = addDaysISO(hoje, janela);
  const saida: Vencimento[] = [];
  const mesAtual = monthOf(hoje);

  for (const f of dados.fixas) {
    const nome = f.nome.trim();
    if (!nome) continue;
    const baixa = nome.toLowerCase();
    const paga = dados.transacoes.some((t) => num(t.valor) < 0 && t.data.startsWith(mesAtual) && t.descricao.toLowerCase().includes(baixa));
    for (let k = 0; k < 24; k++) {
      const base = addMonthsISO(`${hoje.slice(0, 7)}-01`, k);
      const [y, m] = parseISO(base);
      const dia = Math.min(Math.max(1, f.dia_vencimento), daysInMonth(y, m));
      const data = `${y}-${pad(m)}-${pad(dia)}`;
      if (k === 0 && paga) continue;
      if (data > limite) break;
      saida.push({ chave: chaveFixa(f), origem: "fixa", nome, valor: num(f.valor), data, dias: diasEntre(hoje, data) });
    }
  }

  for (const d of dados.dividas ?? []) {
    const s = situacao(d, hoje);
    if (!s.proxima) continue;
    for (let k = s.proxima.indice; k <= s.total; k++) {
      const data = vencimento(d.primeira_parcela, k);
      if (k > s.proxima.indice && data < hoje) continue; // atrasadas além da primeira ficam só na área Dívidas
      if (k > s.proxima.indice && data > limite) break;
      saida.push({ chave: chaveDivida(d), origem: "divida", nome: d.nome, valor: num(d.valor_parcela), data, dias: diasEntre(hoje, data), indice: k, total: s.total });
    }
  }

  return saida.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
}

/** O que cada pessoa quer receber: nada se o aviso estiver desligado; todas as contas se nenhuma foi escolhida. */
export function filtrarPorAviso(v: Vencimento[], aviso: Pick<Aviso, "ativo" | "contas"> | null | undefined): Vencimento[] {
  if (!aviso || !aviso.ativo) return [];
  const escolhidas = aviso.contas;
  return escolhidas ? v.filter((x) => escolhidas.includes(x.chave)) : v;
}

/** Quanto falta, em palavras. */
export function quandoVence(dias: number): string {
  if (dias < 0) return dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

export const DIAS_PADRAO = [7, 4, 1, 0];
