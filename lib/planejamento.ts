// Pretensões de compra: quanto cada desejo pesa no orçamento.
// Tudo aqui é conta pura, testada em npm run check.

import type { Dados, FormaCompra, Pretensao } from "./types";
import { calcularKpis, monthOf, num, round2, totaisDoMes } from "./finance";
import { mesesAnterioresComMovimento, parcelasFuturas } from "./assistente";
import { money } from "./format";

/** Parcela fixa de um financiamento (tabela Price). `juros` é a taxa mensal em fração (0,015 = 1,5%). */
export function parcelaPrice(principal: number, juros: number, n: number): number {
  if (principal <= 0 || n <= 0) return 0;
  if (juros <= 0) return round2(principal / n);
  const f = Math.pow(1 + juros, n);
  return round2((principal * juros * f) / (f - 1));
}

export interface Perfil {
  /** Renda mensal considerada (média dos últimos meses ou a informada). */
  renda: number;
  /** Quanto costuma sair por mês (média dos últimos meses). */
  gastoMedio: number;
  /** Parcelas de cartão já lançadas para o mês que vem. */
  parcelasProximoMes: number;
  /** Dinheiro em contas correntes, o que dá para usar já. */
  liquidez: number;
  investimentos: number;
  /** De onde veio a renda: 'media' dos lançamentos, 'mes' (só o mês atual), 'manual' ou 'nenhuma'. */
  origemRenda: "media" | "mes" | "manual" | "nenhuma";
  /** Quanto sobra por mês (renda menos gasto médio), nunca negativo. */
  sobraMensal: number;
}

export function montarPerfil(dados: Dados, hoje: string, rendaManual = 0): Perfil {
  const { transacoes, categorias, contas } = dados;
  const mes = monthOf(hoje);
  const anteriores = mesesAnterioresComMovimento(transacoes, mes, 3);
  const totaisAnt = anteriores.map((m) => totaisDoMes(transacoes, categorias, m));
  const comReceita = totaisAnt.filter((t) => t.receitas > 0);
  const atual = totaisDoMes(transacoes, categorias, mes);

  let renda = 0;
  let origemRenda: Perfil["origemRenda"] = "nenhuma";
  if (comReceita.length > 0) {
    renda = round2(comReceita.reduce((s, t) => s + t.receitas, 0) / comReceita.length);
    origemRenda = "media";
  } else if (atual.receitas > 0) {
    renda = atual.receitas;
    origemRenda = "mes";
  } else if (rendaManual > 0) {
    renda = rendaManual;
    origemRenda = "manual";
  }

  let gastoMedio = 0;
  if (totaisAnt.length > 0) gastoMedio = round2(totaisAnt.reduce((s, t) => s + t.despesas, 0) / totaisAnt.length);
  else gastoMedio = atual.despesas;

  const kpis = calcularKpis(contas);
  const parcelasProximoMes = parcelasFuturas(transacoes, contas, hoje, 1)[0]?.total ?? 0;
  return {
    renda,
    gastoMedio,
    parcelasProximoMes,
    liquidez: Math.max(0, kpis.bancos),
    investimentos: Math.max(0, kpis.investimentos),
    origemRenda,
    sobraMensal: Math.max(0, round2(renda - gastoMedio)),
  };
}

export type Veredito = "tranquilo" | "atencao" | "arriscado" | "sem-dados";

export interface Analise {
  forma: FormaCompra;
  /** Valor de cada parcela (ou o valor total, se à vista). */
  parcela: number;
  nParcelas: number;
  entrada: number;
  /** Tudo o que sai do bolso no fim, com juros. */
  totalPago: number;
  jurosTotal: number;
  /** Parcelas (já lançadas + esta) como fatia da renda, em %. */
  pctRendaParcelas: number | null;
  /** O que sobra por mês depois de pagar esta compra. */
  folgaDepois: number | null;
  /** Em quantos meses de gasto o dinheiro em conta se sustenta depois da entrada/compra. */
  reservaDepoisMeses: number | null;
  /** Meses guardando a sobra atual para pagar à vista. */
  mesesParaJuntar: number | null;
  veredito: Veredito;
  titulo: string;
  detalhes: string[];
}

export function analisarPretensao(p: Pick<Pretensao, "forma" | "valor" | "parcelas" | "entrada" | "juros_mensal">, perfil: Perfil): Analise {
  const valor = num(p.valor);
  const forma = p.forma;
  const entrada = forma === "avista" ? 0 : Math.min(valor, Math.max(0, num(p.entrada)));
  const n = forma === "avista" ? 1 : Math.max(1, Math.trunc(p.parcelas));
  const juros = forma === "financiado" ? Math.max(0, num(p.juros_mensal)) / 100 : 0;
  const principal = Math.max(0, valor - entrada);

  let parcela: number;
  let totalPago: number;
  if (forma === "avista") {
    parcela = valor;
    totalPago = valor;
  } else {
    parcela = parcelaPrice(principal, juros, n);
    totalPago = round2(entrada + parcela * n);
  }
  const jurosTotal = Math.max(0, round2(totalPago - valor));
  const detalhes: string[] = [];

  const semRenda = perfil.renda <= 0;
  const sobra = perfil.sobraMensal;
  const mesesParaJuntar = valor > 0 && sobra > 0 ? Math.ceil(valor / sobra) : null;

  // Dinheiro que sai já: a compra à vista ou a entrada.
  const saidaAgora = forma === "avista" ? valor : entrada;
  const caixaDepois = perfil.liquidez - saidaAgora;
  const reservaDepoisMeses = perfil.gastoMedio > 0 ? round2(Math.max(0, caixaDepois) / perfil.gastoMedio) : null;

  let veredito: Veredito = "tranquilo";
  const subir = (v: Veredito) => {
    const ordem: Veredito[] = ["tranquilo", "atencao", "arriscado"];
    if (ordem.indexOf(v) > ordem.indexOf(veredito)) veredito = v;
  };

  // Efeito mensal (parcelado ou financiado).
  let pctRendaParcelas: number | null = null;
  let folgaDepois: number | null = null;
  if (forma !== "avista") {
    if (!semRenda) {
      pctRendaParcelas = round2(((perfil.parcelasProximoMes + parcela) / perfil.renda) * 100);
      folgaDepois = round2(perfil.renda - perfil.gastoMedio - parcela);
      if (folgaDepois < 0) subir("arriscado");
      else if (folgaDepois < perfil.renda * 0.1) subir("atencao");
      if (pctRendaParcelas > 35) subir("arriscado");
      else if (pctRendaParcelas > 20) subir("atencao");
      detalhes.push(`Parcelas somariam ${Math.round(pctRendaParcelas)}% da sua renda mensal (${money(perfil.parcelasProximoMes)} já lançados mais ${money(parcela)}).`);
      detalhes.push(
        folgaDepois >= 0
          ? `Depois da parcela ainda sobrariam ${money(folgaDepois)} por mês.`
          : `Depois da parcela faltariam ${money(-folgaDepois)} por mês para fechar as contas.`,
      );
    }
    if (jurosTotal > 0) {
      detalhes.push(`Você pagaria ${money(totalPago)} no total, ${money(jurosTotal)} só de juros (${Math.round((jurosTotal / valor) * 100)}% a mais).`);
    }
  }

  // Efeito no caixa (à vista ou entrada).
  if (saidaAgora > 0) {
    if (saidaAgora > perfil.liquidez) {
      subir(forma === "avista" ? "arriscado" : "atencao");
      detalhes.push(`Hoje você tem ${money(perfil.liquidez)} em conta, menos que os ${money(saidaAgora)} necessários agora.`);
      if (mesesParaJuntar && forma === "avista") {
        detalhes.push(`Guardando ${money(sobra)} por mês, você junta o valor em cerca de ${mesesParaJuntar} ${mesesParaJuntar === 1 ? "mês" : "meses"}.`);
      }
    } else if (reservaDepoisMeses !== null && reservaDepoisMeses < 2) {
      subir("atencao");
      detalhes.push(`Depois de pagar, o dinheiro em conta cobriria só ${reservaDepoisMeses.toFixed(1).replace(".", ",")} mês de gastos. O ideal é manter pelo menos 2.`);
    } else {
      detalhes.push(`Você paga ${money(saidaAgora)} agora e ainda fica com ${money(caixaDepois)} em conta.`);
    }
  }

  if (semRenda) {
    detalhes.unshift("Ainda não encontrei receitas lançadas. Lance seu salário (ou informe a renda) para eu calcular o comprometimento.");
    if (forma !== "avista" && veredito === "tranquilo") veredito = "sem-dados";
  }

  const titulos: Record<Veredito, string> = {
    tranquilo: "Cabe no seu orçamento",
    atencao: "Dá, mas com atenção",
    arriscado: "Compromete demais",
    "sem-dados": "Faltam dados para avaliar",
  };

  return {
    forma,
    parcela,
    nParcelas: n,
    entrada,
    totalPago,
    jurosTotal,
    pctRendaParcelas,
    folgaDepois,
    reservaDepoisMeses,
    mesesParaJuntar,
    veredito,
    titulo: titulos[veredito],
    detalhes,
  };
}

export interface ResumoLista {
  quantidade: number;
  parcelasPorMes: number;
  avistaTotal: number;
  pctRendaParcelas: number | null;
}

/** Se todos os desejos da lista fossem comprados juntos. */
export function resumirLista(pretensoes: Pretensao[], perfil: Perfil): ResumoLista {
  const ativas = pretensoes.filter((p) => p.status === "desejo");
  let parcelasPorMes = 0;
  let avistaTotal = 0;
  for (const p of ativas) {
    const a = analisarPretensao(p, perfil);
    if (p.forma === "avista") avistaTotal += a.parcela;
    else {
      parcelasPorMes += a.parcela;
      avistaTotal += a.entrada;
    }
  }
  return {
    quantidade: ativas.length,
    parcelasPorMes: round2(parcelasPorMes),
    avistaTotal: round2(avistaTotal),
    pctRendaParcelas: perfil.renda > 0 ? round2(((perfil.parcelasProximoMes + parcelasPorMes) / perfil.renda) * 100) : null,
  };
}
