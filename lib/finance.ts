// Regras de negócio do sistema, sem nada de tela nem de banco de dados.
// Fica separado para poder ser testado (npm run check).

import type {
  Categoria,
  Conta,
  DespesaFixa,
  Id,
  NovaTransacao,
  Transacao,
} from "./types";

/* ---------- números e datas ---------- */

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sameId(a: Id | null | undefined, b: Id | null | undefined): boolean {
  return a != null && b != null && String(a) === String(b);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data de hoje (fuso do aparelho) como AAAA-MM-DD. */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** AAAA-MM de uma data AAAA-MM-DD. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function daysInMonth(year: number, month: number): number {
  // month de 1 a 12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseISO(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/**
 * Soma meses mantendo o dia. Se o mês de destino não tem esse dia
 * (ex.: 31/01 + 1 mês), usa o último dia do mês (28/02) em vez de pular para março.
 */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = parseISO(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (((total % 12) + 12) % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* ---------- parcelas ---------- */

/** Divide um valor em parcelas em centavos exatos (a soma sempre fecha). */
export function splitInstallments(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const extra = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

const PARCELA_RE = /^(.*) \((\d+)\/(\d+)\)$/;

export function parseParcela(
  descricao: string,
): { base: string; indice: number; total: number } | null {
  const m = descricao.match(PARCELA_RE);
  if (!m) return null;
  return { base: m[1], indice: Number(m[2]), total: Number(m[3]) };
}

/* ---------- novo lançamento ---------- */

export type Operacao = "despesa" | "receita" | "transferencia" | "investimento";

export interface EntradaLancamento {
  operacao: Operacao;
  data: string;
  descricao: string;
  /** Valor líquido: o que a pessoa quer gastar, receber ou mover. */
  valor: number;
  parcelas: number;
  origemId: Id | null;
  destinoId?: Id | null;
  categoriaId?: Id | null;
  /** Dias até o dinheiro cair no destino (resgate de investimento). */
  diasResgate?: number;
  /** A operadora cobrou taxa ou juros por cima do valor? */
  comTaxa?: boolean;
  /** Total cobrado no cartão, já com a taxa. Só vale se comTaxa. */
  totalCobrado?: number;
}

export type ResultadoPlano =
  | { ok: true; linhas: NovaTransacao[] }
  | { ok: false; erro: string };

/**
 * Transforma o formulário nas linhas que vão para a tabela "transacoes".
 *
 * - Despesa/receita: uma linha por parcela, com a categoria escolhida.
 * - Transferência/investimento: sai da origem (em parcelas, se for cartão) e
 *   entra no destino uma linha "Recebido: ..." na data + dias de resgate.
 * - Taxa: linha extra "Taxa: ..." sem conta, só para registrar o custo.
 */
export function montarLancamento(e: EntradaLancamento): ResultadoPlano {
  const descricao = e.descricao.trim();
  const ehTransf = e.operacao === "transferencia" || e.operacao === "investimento";
  const parcelas = e.operacao === "receita" ? 1 : Math.trunc(e.parcelas) || 1;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) return { ok: false, erro: "Informe a data." };
  if (!descricao) return { ok: false, erro: "Informe a descrição." };
  if (!(e.valor > 0)) return { ok: false, erro: "Informe um valor maior que zero." };
  if (parcelas < 1 || parcelas > 48) return { ok: false, erro: "Use de 1 a 48 parcelas." };
  if (e.origemId == null || e.origemId === "") return { ok: false, erro: "Escolha a conta." };

  if (ehTransf) {
    if (e.destinoId == null || e.destinoId === "")
      return { ok: false, erro: "Escolha a conta de destino." };
    if (sameId(e.origemId, e.destinoId))
      return { ok: false, erro: "Origem e destino precisam ser contas diferentes." };
  } else if (e.categoriaId == null || e.categoriaId === "") {
    return { ok: false, erro: "Escolha a categoria." };
  }

  const liquido = round2(e.valor);
  let bruto = liquido;
  if (e.comTaxa) {
    bruto = round2(e.totalCobrado ?? 0);
    if (!(bruto > liquido))
      return { ok: false, erro: "O total cobrado precisa ser maior que o valor." };
  }

  const sinal = e.operacao === "receita" ? 1 : -1;
  const partes = splitInstallments(bruto, parcelas);
  const linhas: NovaTransacao[] = partes.map((p, i) => ({
    data: addMonthsISO(e.data, i),
    descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
    valor: sinal * p,
    conta_origem_id: e.origemId as Id,
    categoria_id: ehTransf ? null : (e.categoriaId as Id),
  }));

  if (ehTransf) {
    linhas.push({
      data: addDaysISO(e.data, Math.max(0, Math.trunc(e.diasResgate ?? 0))),
      descricao: `Recebido: ${descricao}`,
      valor: liquido,
      conta_origem_id: e.destinoId as Id,
      categoria_id: null,
    });
  }

  if (e.comTaxa) {
    linhas.push({
      data: e.data,
      descricao: `Taxa: ${descricao}`,
      valor: -round2(bruto - liquido),
      conta_origem_id: null,
      categoria_id: null,
    });
  }

  return { ok: true, linhas };
}

/* ---------- edição em cascata (parcelas irmãs) ---------- */

export interface AtualizacaoTransacao {
  id: Id;
  data: string;
  descricao: string;
  valor: number;
}

/**
 * Edita uma transação. Com `cascata`, aplica descrição e valor em todas as
 * parcelas da mesma compra e mantém o intervalo de um mês entre elas
 * (a data editada vira a data daquela parcela, as outras acompanham).
 */
export function montarEdicao(
  editada: Transacao,
  todas: Transacao[],
  novo: { data: string; descricao: string; valorAbs: number },
  cascata: boolean,
): AtualizacaoTransacao[] {
  const valorAbs = round2(Math.abs(novo.valorAbs));
  const sinalDe = (t: Transacao) => (num(t.valor) < 0 ? -1 : 1);
  const info = parseParcela(editada.descricao);

  if (!cascata || !info) {
    const sufixo = info ? ` (${info.indice}/${info.total})` : "";
    return [
      {
        id: editada.id,
        data: novo.data,
        descricao: `${novo.descricao.trim()}${sufixo}`,
        valor: sinalDe(editada) * valorAbs,
      },
    ];
  }

  const irmas = todas.filter((t) => {
    const p = parseParcela(t.descricao);
    return (
      p &&
      p.base === info.base &&
      p.total === info.total &&
      String(t.conta_origem_id) === String(editada.conta_origem_id)
    );
  });

  return irmas.map((t) => {
    const p = parseParcela(t.descricao)!;
    return {
      id: t.id,
      data: addMonthsISO(novo.data, p.indice - info.indice),
      descricao: `${novo.descricao.trim()} (${p.indice}/${p.total})`,
      valor: sinalDe(t) * valorAbs,
    };
  });
}

/* ---------- indicadores ---------- */

export interface Kpis {
  bancos: number;
  divida: number;
  investimentos: number;
  patrimonio: number;
}

export function calcularKpis(contas: Conta[]): Kpis {
  let bancos = 0;
  let credito = 0;
  let investimentos = 0;
  for (const c of contas) {
    const s = num(c.saldo_atual);
    if (c.tipo === "Corrente") bancos += s;
    else if (c.tipo === "Crédito") credito += s;
    else if (c.tipo === "Investimento") investimentos += s;
  }
  return {
    bancos,
    divida: Math.max(0, -credito),
    investimentos,
    patrimonio: bancos + credito + investimentos,
  };
}

/** Quanto do limite do cartão está comprometido. */
export function usoCartao(c: Conta): { usado: number; limite: number; disponivel: number; pct: number } {
  const usado = Math.max(0, -num(c.saldo_atual));
  const limite = num(c.limite_total);
  return {
    usado,
    limite,
    disponivel: Math.max(0, limite - usado),
    pct: limite > 0 ? Math.min(100, (usado / limite) * 100) : usado > 0 ? 100 : 0,
  };
}

export interface GrupoInvestimento {
  nome: string;
  total: number;
  itens: { conta: Conta; rotulo: string }[];
}

/**
 * Agrupa investimentos da mesma instituição: "BTG - CDB" e "BTG - Fundo"
 * viram o grupo "BTG". Contas sem par ficam avulsas.
 */
export function agruparInvestimentos(contas: Conta[]): {
  grupos: GrupoInvestimento[];
  avulsos: Conta[];
} {
  const porInstituicao = new Map<string, { conta: Conta; rotulo: string }[]>();
  const avulsos: Conta[] = [];

  for (const c of contas) {
    if (c.tipo !== "Investimento") continue;
    const i = c.nome.indexOf(" - ");
    let chave: string | null = null;
    let rotulo = c.nome;
    if (i > 0) {
      chave = c.nome.slice(0, i).trim();
      rotulo = c.nome.slice(i + 3).trim();
    } else if (/btg/i.test(c.nome)) {
      chave = "BTG";
    }
    if (!chave) {
      avulsos.push(c);
      continue;
    }
    const lista = porInstituicao.get(chave) ?? [];
    lista.push({ conta: c, rotulo });
    porInstituicao.set(chave, lista);
  }

  const grupos: GrupoInvestimento[] = [];
  for (const [chave, itens] of porInstituicao) {
    if (itens.length === 1) {
      avulsos.push(itens[0].conta);
      continue;
    }
    grupos.push({
      nome: /^btg$/i.test(chave) ? "BTG Pactual" : chave,
      total: itens.reduce((s, it) => s + num(it.conta.saldo_atual), 0),
      itens,
    });
  }
  return { grupos, avulsos };
}

/* ---------- contas fixas pendentes ---------- */

export interface ContaFixaPendente {
  fixa: DespesaFixa;
  /** Dias de atraso em relação ao vencimento (0 = vence hoje). */
  atraso: number;
}

/**
 * Contas fixas deste mês que já venceram (ou vencem hoje) e ainda não têm
 * nenhum lançamento de saída com o nome delas.
 */
export function contasFixasPendentes(
  fixas: DespesaFixa[],
  transacoes: Transacao[],
  hoje: string,
): ContaFixaPendente[] {
  const mes = monthOf(hoje);
  const [y, m, dia] = parseISO(hoje);
  const ultimoDia = daysInMonth(y, m);

  const pendentes: ContaFixaPendente[] = [];
  for (const f of fixas) {
    const nome = f.nome.trim().toLowerCase();
    if (!nome) continue;
    const venc = Math.min(Math.max(1, f.dia_vencimento), ultimoDia);
    if (dia < venc) continue;
    const paga = transacoes.some(
      (t) =>
        num(t.valor) < 0 &&
        t.data.startsWith(mes) &&
        t.descricao.toLowerCase().includes(nome),
    );
    if (!paga) pendentes.push({ fixa: f, atraso: dia - venc });
  }
  return pendentes.sort((a, b) => b.atraso - a.atraso);
}

/* ---------- resumo do mês ---------- */

export interface GastoPorCategoria {
  nome: string;
  total: number;
}

/** Despesas do mês por categoria, da maior para a menor. */
export function gastosPorCategoria(
  transacoes: Transacao[],
  categorias: Categoria[],
  mes: string,
): GastoPorCategoria[] {
  const nomes = new Map(categorias.map((c) => [String(c.id), c.nome]));
  const soma = new Map<string, number>();
  for (const t of transacoes) {
    const v = num(t.valor);
    if (v >= 0 || t.categoria_id == null || !t.data.startsWith(mes)) continue;
    const nome = nomes.get(String(t.categoria_id));
    if (!nome) continue;
    soma.set(nome, (soma.get(nome) ?? 0) + Math.abs(v));
  }
  return [...soma.entries()]
    .map(([nome, total]) => ({ nome, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Receitas e despesas do mês. Transferências e resgates não entram:
 * só categorias de receita/despesa e as taxas ("Taxa: ...").
 */
export function totaisDoMes(
  transacoes: Transacao[],
  categorias: Categoria[],
  mes: string,
): { receitas: number; despesas: number } {
  const tipoPorId = new Map(categorias.map((c) => [String(c.id), c.tipo]));
  let receitas = 0;
  let despesas = 0;
  for (const t of transacoes) {
    if (!t.data.startsWith(mes)) continue;
    const v = num(t.valor);
    const tipo = t.categoria_id != null ? tipoPorId.get(String(t.categoria_id)) : undefined;
    if (tipo === "Receita" && v > 0) receitas += v;
    else if (v < 0 && (tipo === "Despesa" || t.descricao.startsWith("Taxa:"))) despesas += -v;
  }
  return { receitas: round2(receitas), despesas: round2(despesas) };
}

/** Meses (AAAA-MM) com movimento, do mais recente para o mais antigo. Sempre inclui o mês atual. */
export function mesesDisponiveis(transacoes: Transacao[], hoje: string): string[] {
  const set = new Set<string>([monthOf(hoje)]);
  for (const t of transacoes) if (t.data) set.add(monthOf(t.data));
  return [...set].sort().reverse();
}
