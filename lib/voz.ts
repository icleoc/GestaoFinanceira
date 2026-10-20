// Resumo falado do painel. O texto é montado aqui (função pura, testável); a voz vem do próprio aparelho.

import type { Insight } from "./assistente";
import type { GastoPorCategoria, Kpis } from "./finance";
import type { SituacaoLimite } from "./limites";

/** "1234,5" -> "1.234 reais e 50 centavos", do jeito que se fala. */
export function falarValor(n: number): string {
  const abs = Math.abs(n);
  const reais = Math.floor(abs);
  const centavos = Math.round((abs - reais) * 100) % 100;
  const r = `${reais.toLocaleString("pt-BR")} ${reais === 1 ? "real" : "reais"}`;
  return centavos > 0 ? `${r} e ${centavos} ${centavos === 1 ? "centavo" : "centavos"}` : r;
}

export interface EntradaResumo {
  nome?: string | null;
  kpis: Kpis;
  receitas: number;
  despesas: number;
  gastos: GastoPorCategoria[];
  insights: Insight[];
  pendentes: number;
  limite?: SituacaoLimite | null;
  mesRotulo: string;
}

/** Texto curto (uns 30 segundos) com o que importa hoje. */
export function montarResumoFalado(e: EntradaResumo): string {
  const partes: string[] = [];
  partes.push(e.nome ? `Olá, ${e.nome}. Este é o seu resumo financeiro.` : "Este é o seu resumo financeiro.");

  partes.push(`Seu patrimônio líquido está em ${e.kpis.patrimonio < 0 ? "menos " : ""}${falarValor(e.kpis.patrimonio)}.`);
  if (e.kpis.divida > 0) partes.push(`Você tem ${falarValor(e.kpis.divida)} em faturas de cartão a pagar.`);

  if (e.despesas > 0 || e.receitas > 0) {
    partes.push(`Em ${e.mesRotulo}, entraram ${falarValor(e.receitas)} e saíram ${falarValor(e.despesas)}.`);
    const saldo = e.receitas - e.despesas;
    if (e.receitas > 0) partes.push(saldo >= 0 ? `Sobraram ${falarValor(saldo)} até agora.` : `Você gastou ${falarValor(-saldo)} a mais do que recebeu.`);
  }

  const topo = e.gastos[0];
  if (topo && e.despesas > 0) {
    const pct = Math.round((topo.total / e.despesas) * 100);
    partes.push(`Onde você mais gastou foi ${topo.nome}, com ${falarValor(topo.total)}, ${pct} por cento das saídas.`);
  }

  if (e.limite && e.limite.estado === "estourou") partes.push("Atenção: você atingiu seu limite de gasto mensal.");
  else if (e.limite && e.limite.estado === "perto") partes.push(`Você está perto do seu limite de gasto mensal. Restam ${falarValor(e.limite.restante)}.`);

  if (e.pendentes > 0) partes.push(`Há ${e.pendentes} ${e.pendentes === 1 ? "conta fixa" : "contas fixas"} deste mês sem lançamento.`);

  const importantes = e.insights.filter((i) => i.nivel === "alerta" || i.nivel === "atencao").slice(0, 2);
  for (const i of importantes) partes.push(`${i.titulo}.`.replace(/\.\.$/, "."));

  return partes.join(" ");
}
