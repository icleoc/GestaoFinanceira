// O assistente financeiro: lê os lançamentos e diz, em português simples, onde o
// dinheiro está indo e o que merece atenção. Só regras e contas, sem inteligência
// externa: tudo é calculado aqui, com os dados da própria carteira.

import type { Categoria, Conta, Dados, Transacao } from "./types";
import {
  addMonthsISO,
  calcularKpis,
  contasFixasPendentes,
  daysInMonth,
  gastosPorCategoria,
  monthOf,
  num,
  parseISO,
  round2,
  totaisDoMes,
  usoCartao,
} from "./finance";
import { money } from "./format";

export type Nivel = "alerta" | "atencao" | "info" | "bom";
export type Destino = "extrato" | "planejar" | "gerenciar" | "lancar";

export interface Insight {
  id: string;
  nivel: Nivel;
  titulo: string;
  texto: string;
  destino?: Destino;
}

export interface PontoMensal {
  mes: string;
  receitas: number;
  despesas: number;
}

/** Soma `n` meses (pode ser negativo) a um AAAA-MM. */
export function somarMes(ym: string, n: number): string {
  return monthOf(addMonthsISO(`${ym}-01`, n));
}

/** Receitas e despesas dos últimos `quantidade` meses, do mais antigo ao mais novo. */
export function serieMensal(transacoes: Transacao[], categorias: Categoria[], mesFinal: string, quantidade = 6): PontoMensal[] {
  const saida: PontoMensal[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const mes = somarMes(mesFinal, -i);
    saida.push({ mes, ...totaisDoMes(transacoes, categorias, mes) });
  }
  return saida;
}

function mesTemMovimento(transacoes: Transacao[], mes: string): boolean {
  return transacoes.some((t) => t.data.startsWith(mes));
}

/** Meses completos anteriores a `mes` que têm lançamentos (até `quantidade`). */
export function mesesAnterioresComMovimento(transacoes: Transacao[], mes: string, quantidade = 3): string[] {
  const achados: string[] = [];
  for (let i = 1; i <= 12 && achados.length < quantidade; i++) {
    const m = somarMes(mes, -i);
    if (mesTemMovimento(transacoes, m)) achados.push(m);
  }
  return achados;
}

/** Média de gasto por categoria nos meses anteriores com movimento. */
export function mediaPorCategoria(transacoes: Transacao[], categorias: Categoria[], mes: string, quantidade = 3): Map<string, number> {
  const meses = mesesAnterioresComMovimento(transacoes, mes, quantidade);
  const soma = new Map<string, number>();
  for (const m of meses) {
    for (const g of gastosPorCategoria(transacoes, categorias, m)) soma.set(g.nome, (soma.get(g.nome) ?? 0) + g.total);
  }
  const media = new Map<string, number>();
  if (meses.length === 0) return media;
  for (const [nome, total] of soma) media.set(nome, round2(total / meses.length));
  return media;
}

/** Despesas já realizadas no mês, até a data de hoje. */
function despesasAte(transacoes: Transacao[], categorias: Categoria[], mes: string, hoje: string): number {
  const tipoPorId = new Map(categorias.map((c) => [String(c.id), c.tipo]));
  let total = 0;
  for (const t of transacoes) {
    if (!t.data.startsWith(mes) || t.data > hoje) continue;
    const v = num(t.valor);
    const tipo = t.categoria_id != null ? tipoPorId.get(String(t.categoria_id)) : undefined;
    if (v < 0 && (tipo === "Despesa" || t.descricao.startsWith("Taxa:"))) total += -v;
  }
  return round2(total);
}

/**
 * Parcelas de cartão que já estão lançadas para os próximos meses
 * (a partir do mês seguinte ao de `hoje`). Cada item é o total daquele mês.
 */
export function parcelasFuturas(transacoes: Transacao[], contas: Conta[], hoje: string, meses = 6): { mes: string; total: number }[] {
  const credito = new Set(contas.filter((c) => c.tipo === "Crédito").map((c) => String(c.id)));
  const base = monthOf(hoje);
  const saida: { mes: string; total: number }[] = [];
  for (let i = 1; i <= meses; i++) {
    const mes = somarMes(base, i);
    let total = 0;
    for (const t of transacoes) {
      if (!t.data.startsWith(mes)) continue;
      const v = num(t.valor);
      if (v < 0 && t.conta_origem_id != null && credito.has(String(t.conta_origem_id))) total += -v;
    }
    saida.push({ mes, total: round2(total) });
  }
  return saida;
}

function diasAteVencimento(diaVenc: number, hoje: string): number {
  const [y, m, d] = parseISO(hoje);
  const doMes = Math.min(diaVenc, daysInMonth(y, m));
  if (doMes >= d) return doMes - d;
  return daysInMonth(y, m) - d + Math.min(diaVenc, daysInMonth(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1));
}

const PESO: Record<Nivel, number> = { alerta: 0, atencao: 1, info: 2, bom: 3 };

export function gerarInsights(dados: Dados, hoje: string): Insight[] {
  const { contas, categorias, transacoes, fixas } = dados;
  const mes = monthOf(hoje);
  const saida: Insight[] = [];

  if (transacoes.length === 0) {
    return [
      {
        id: "comeco",
        nivel: "info",
        titulo: "Vamos começar?",
        texto: "Cadastre suas contas e lance os primeiros gastos. Com alguns dias de uso eu mostro onde seu dinheiro está indo.",
        destino: "lancar",
      },
    ];
  }

  const totais = totaisDoMes(transacoes, categorias, mes);
  const gastos = gastosPorCategoria(transacoes, categorias, mes);
  const medias = mediaPorCategoria(transacoes, categorias, mes);
  const anteriores = mesesAnterioresComMovimento(transacoes, mes);
  const mediaDespesas = anteriores.length
    ? round2(anteriores.reduce((s, m) => s + totaisDoMes(transacoes, categorias, m).despesas, 0) / anteriores.length)
    : 0;
  const kpis = calcularKpis(contas);

  // Onde mais gasta.
  if (gastos.length > 0 && totais.despesas > 0) {
    const topo = gastos[0];
    const pct = Math.round((topo.total / totais.despesas) * 100);
    const media = medias.get(topo.nome);
    saida.push({
      id: "maior-categoria",
      nivel: "info",
      titulo: `${topo.nome} é onde você mais gasta`,
      texto: `${money(topo.total)} neste mês, ${pct}% de tudo o que saiu.${media ? ` Sua média nos meses anteriores é ${money(media)}.` : ""}`,
      destino: "extrato",
    });
  }

  // Categorias que subiram muito em relação à média.
  let avisadas = 0;
  for (const g of gastos) {
    const media = medias.get(g.nome);
    if (!media || avisadas >= 2) continue;
    const dif = g.total - media;
    if (dif >= 50 && dif / media >= 0.25) {
      avisadas++;
      saida.push({
        id: `alta-${g.nome}`,
        nivel: "atencao",
        titulo: `${g.nome} está ${Math.round((dif / media) * 100)}% acima da média`,
        texto: `${money(g.total)} contra ${money(media)} de média. São ${money(dif)} a mais do que o normal.`,
        destino: "extrato",
      });
    }
  }

  // Ritmo do mês.
  const [y, m, dia] = parseISO(hoje);
  const diasDoMes = daysInMonth(y, m);
  const feitas = despesasAte(transacoes, categorias, mes, hoje);
  if (dia >= 5 && mediaDespesas > 0 && feitas > 0) {
    const projetado = round2((feitas / dia) * diasDoMes);
    if (projetado > mediaDespesas * 1.15) {
      saida.push({
        id: "ritmo-alto",
        nivel: "atencao",
        titulo: "O mês está caminhando para fechar mais caro",
        texto: `No ritmo de hoje, as despesas chegam a cerca de ${money(projetado)}. Sua média é ${money(mediaDespesas)}.`,
        destino: "extrato",
      });
    } else if (projetado < mediaDespesas * 0.9) {
      saida.push({
        id: "ritmo-bom",
        nivel: "bom",
        titulo: "Você está gastando menos que o normal",
        texto: `No ritmo de hoje, o mês fecha em cerca de ${money(projetado)}, abaixo da média de ${money(mediaDespesas)}.`,
      });
    }
  }

  // Quanto sobra da renda.
  if (totais.receitas > 0) {
    const sobra = totais.receitas - totais.despesas;
    const pct = Math.round((sobra / totais.receitas) * 100);
    if (sobra < 0) {
      saida.push({
        id: "no-vermelho",
        nivel: "alerta",
        titulo: "Neste mês você gastou mais do que recebeu",
        texto: `Entraram ${money(totais.receitas)} e saíram ${money(totais.despesas)}. Diferença de ${money(-sobra)}.`,
        destino: "extrato",
      });
    } else if (pct >= 20) {
      saida.push({
        id: "poupando",
        nivel: "bom",
        titulo: `Você está guardando ${pct}% do que recebe`,
        texto: `Sobraram ${money(sobra)} neste mês. Que tal separar parte disso em um investimento?`,
      });
    } else {
      saida.push({
        id: "sobra-baixa",
        nivel: "info",
        titulo: `Sobram ${pct}% da sua renda este mês`,
        texto: `São ${money(sobra)} depois das despesas. Quem consegue guardar 20% ou mais costuma ter mais folga.`,
      });
    }
  }

  // Cartões: limite e vencimento.
  for (const c of contas) {
    if (c.tipo !== "Crédito") continue;
    const u = usoCartao(c);
    if (u.limite > 0 && u.pct >= 80) {
      saida.push({
        id: `limite-${c.id}`,
        nivel: u.pct >= 95 ? "alerta" : "atencao",
        titulo: `${c.nome} está com ${Math.round(u.pct)}% do limite usado`,
        texto: `Restam ${money(u.disponivel)} de ${money(u.limite)}. Evite novas compras parceladas nele.`,
        destino: "extrato",
      });
    }
    if (c.dia_vencimento && u.usado > 0) {
      const dias = diasAteVencimento(c.dia_vencimento, hoje);
      if (dias <= 5) {
        saida.push({
          id: `vence-${c.id}`,
          nivel: dias <= 2 ? "alerta" : "atencao",
          titulo: dias === 0 ? `A fatura do ${c.nome} vence hoje` : `A fatura do ${c.nome} vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
          texto: `Dívida total no cartão: ${money(u.usado)} (inclui parcelas dos próximos meses). Confira o valor da fatura aberta.`,
          destino: "lancar",
        });
      }
    }
  }

  // Dívida de cartão comparada ao que há em conta.
  if (kpis.divida > 0 && kpis.divida > kpis.bancos) {
    const alerta = kpis.divida > kpis.bancos + kpis.investimentos;
    saida.push({
      id: "divida-maior",
      nivel: alerta ? "alerta" : "info",
      titulo: alerta ? "A dívida dos cartões é maior que tudo o que você tem" : "A dívida dos cartões passa do saldo em conta",
      texto: `Cartões: ${money(kpis.divida)}, contas: ${money(kpis.bancos)}${kpis.investimentos > 0 ? `, investimentos: ${money(kpis.investimentos)}` : ""}. A dívida inclui parcelas que ainda vão vencer.`,
    });
  }

  // Parcelas já comprometidas.
  const futuras = parcelasFuturas(transacoes, contas, hoje, 3);
  const somaFuturas = round2(futuras.reduce((s, f) => s + f.total, 0));
  if (somaFuturas > 0) {
    saida.push({
      id: "parcelas",
      nivel: "info",
      titulo: `${money(somaFuturas)} já comprometidos nos próximos 3 meses`,
      texto: `São parcelas de cartão já lançadas. Antes de comprar mais, veja o efeito na área de planejamento.`,
      destino: "planejar",
    });
  }

  // Contas fixas sem lançamento.
  const pendentes = contasFixasPendentes(fixas, transacoes, hoje);
  if (pendentes.length > 0) {
    const nomes = pendentes.map((p) => p.fixa.nome).join(", ");
    saida.push({
      id: "fixas",
      nivel: "atencao",
      titulo: pendentes.length === 1 ? "Uma conta fixa ainda não foi lançada" : `${pendentes.length} contas fixas ainda não foram lançadas`,
      texto: `${nomes}. Já passaram do vencimento neste mês.`,
      destino: "lancar",
    });
  }

  // Maior gasto isolado.
  let maior: Transacao | null = null;
  const tipoPorId = new Map(categorias.map((c) => [String(c.id), c.tipo]));
  for (const t of transacoes) {
    if (!t.data.startsWith(mes)) continue;
    const v = num(t.valor);
    if (v >= 0 || t.categoria_id == null || tipoPorId.get(String(t.categoria_id)) !== "Despesa") continue;
    if (!maior || v < num(maior.valor)) maior = t;
  }
  if (maior && gastos.length > 1) {
    saida.push({
      id: "maior-gasto",
      nivel: "info",
      titulo: "Seu maior gasto do mês",
      texto: `${maior.descricao}: ${money(-num(maior.valor))}.`,
      destino: "extrato",
    });
  }

  return saida.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
}

