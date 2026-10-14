// Testes simples das regras de negócio. Rode com: npm run check
import assert from "node:assert/strict";
import {
  addDaysISO,
  addMonthsISO,
  agruparInvestimentos,
  calcularKpis,
  contasFixasPendentes,
  gastosPorCategoria,
  mesesDisponiveis,
  montarEdicao,
  montarLancamento,
  parseParcela,
  splitInstallments,
  totaisDoMes,
  usoCartao,
} from "../lib/finance";
import type { Categoria, Conta, DespesaFixa, Transacao } from "../lib/types";

let total = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    total++;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    console.error(`FALHOU  ${nome}`);
    console.error(e);
    process.exit(1);
  }
}

const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/* ---------- datas ---------- */
test("soma de meses mantém o dia", () => {
  assert.equal(addMonthsISO("2026-10-14", 1), "2026-11-14");
  assert.equal(addMonthsISO("2026-12-05", 1), "2027-01-05");
  assert.equal(addMonthsISO("2026-10-14", 14), "2027-12-14");
});
test("31/01 + 1 mês cai no último dia de fevereiro, não em março", () => {
  assert.equal(addMonthsISO("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsISO("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsISO("2026-01-31", 2), "2026-03-31");
});
test("soma de dias atravessa mês e ano", () => {
  assert.equal(addDaysISO("2026-10-30", 3), "2026-11-02");
  assert.equal(addDaysISO("2026-12-30", 5), "2027-01-04");
  assert.equal(addDaysISO("2026-10-14", 0), "2026-10-14");
});

/* ---------- parcelas ---------- */
test("parcelas fecham o total em centavos", () => {
  const p = splitInstallments(100, 3);
  assert.deepEqual(p, [33.34, 33.33, 33.33]);
  assert.equal(soma(p), 100);
  assert.equal(soma(splitInstallments(1234.57, 7)), 1234.57);
});
test("lê o sufixo (2/5) da descrição", () => {
  assert.deepEqual(parseParcela("Celular (2/5)"), { base: "Celular", indice: 2, total: 5 });
  assert.equal(parseParcela("Mercado"), null);
});

/* ---------- novo lançamento ---------- */
test("despesa à vista: uma linha negativa com categoria", () => {
  const r = montarLancamento({
    operacao: "despesa", data: "2026-10-14", descricao: "Mercado", valor: 80.5,
    parcelas: 1, origemId: 1, categoriaId: 7,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.linhas.length, 1);
  assert.deepEqual(r.linhas[0], {
    data: "2026-10-14", descricao: "Mercado", valor: -80.5, conta_origem_id: 1, categoria_id: 7,
  });
});
test("despesa parcelada no cartão: uma linha por mês, soma fecha", () => {
  const r = montarLancamento({
    operacao: "despesa", data: "2026-01-31", descricao: "TV", valor: 1000,
    parcelas: 3, origemId: 2, categoriaId: 4,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.linhas.map((l) => l.data), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.deepEqual(r.linhas.map((l) => l.descricao), ["TV (1/3)", "TV (2/3)", "TV (3/3)"]);
  assert.equal(soma(r.linhas.map((l) => l.valor)), -1000);
});
test("receita é positiva e nunca parcela", () => {
  const r = montarLancamento({
    operacao: "receita", data: "2026-10-05", descricao: "Salário", valor: 5000,
    parcelas: 6, origemId: 1, categoriaId: 9,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].valor, 5000);
});
test("investimento: sai da origem e entra no destino após os dias de resgate", () => {
  const r = montarLancamento({
    operacao: "investimento", data: "2026-10-14", descricao: "Resgate CDB", valor: 2000,
    parcelas: 1, origemId: 10, destinoId: 1, diasResgate: 30,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(r.linhas[0], {
    data: "2026-10-14", descricao: "Resgate CDB", valor: -2000, conta_origem_id: 10, categoria_id: null,
  });
  assert.deepEqual(r.linhas[1], {
    data: "2026-11-13", descricao: "Recebido: Resgate CDB", valor: 2000, conta_origem_id: 1, categoria_id: null,
  });
});
test("pagar fatura: transferência do banco para o cartão", () => {
  const r = montarLancamento({
    operacao: "transferencia", data: "2026-10-10", descricao: "Fatura Nubank", valor: 900,
    parcelas: 1, origemId: 1, destinoId: 2,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.linhas[0].valor, -900);
  assert.equal(r.linhas[0].conta_origem_id, 1);
  assert.equal(r.linhas[1].valor, 900);
  assert.equal(r.linhas[1].conta_origem_id, 2);
});
test("taxa do cartão vira linha extra sem conta; o líquido continua o mesmo", () => {
  const r = montarLancamento({
    operacao: "transferencia", data: "2026-10-14", descricao: "Aporte", valor: 1000,
    parcelas: 2, origemId: 3, destinoId: 1, comTaxa: true, totalCobrado: 1100,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  const saidas = r.linhas.filter((l) => l.descricao.startsWith("Aporte (")).map((l) => l.valor);
  assert.equal(soma(saidas), -1100);
  const recebido = r.linhas.find((l) => l.descricao.startsWith("Recebido:"))!;
  assert.equal(recebido.valor, 1000);
  const taxa = r.linhas.find((l) => l.descricao.startsWith("Taxa:"))!;
  assert.equal(taxa.valor, -100);
  assert.equal(taxa.conta_origem_id, null);
});
test("validações bloqueiam entradas ruins", () => {
  const base = {
    operacao: "despesa" as const, data: "2026-10-14", descricao: "X", valor: 10,
    parcelas: 1, origemId: 1 as number | null, categoriaId: 1 as number | null,
  };
  const erro = (o: Partial<typeof base> & Record<string, unknown>) => {
    const r = montarLancamento({ ...base, ...o } as never);
    assert.equal(r.ok, false);
  };
  erro({ valor: 0 });
  erro({ valor: -5 });
  erro({ descricao: "   " });
  erro({ data: "14/10/2026" });
  erro({ origemId: null });
  erro({ categoriaId: null });
  erro({ parcelas: 99 });
  erro({ operacao: "transferencia", destinoId: 1 });
  erro({ operacao: "transferencia", destinoId: null });
  erro({ comTaxa: true, totalCobrado: 5 });
});

/* ---------- edição em cascata ---------- */
const parcelas: Transacao[] = [
  { id: 1, data: "2026-09-14", descricao: "TV (1/3)", valor: -333.34, conta_origem_id: 2, categoria_id: 4 },
  { id: 2, data: "2026-10-14", descricao: "TV (2/3)", valor: -333.33, conta_origem_id: 2, categoria_id: 4 },
  { id: 3, data: "2026-11-14", descricao: "TV (3/3)", valor: -333.33, conta_origem_id: 2, categoria_id: 4 },
  { id: 4, data: "2026-10-14", descricao: "TV (1/2)", valor: -50, conta_origem_id: 5, categoria_id: 4 },
];
test("edição simples mantém o sufixo da parcela e o sinal", () => {
  const r = montarEdicao(parcelas[1], parcelas, { data: "2026-10-20", descricao: "Televisão", valorAbs: 300 }, false);
  assert.deepEqual(r, [{ id: 2, data: "2026-10-20", descricao: "Televisão (2/3)", valor: -300 }]);
});
test("edição em cascata altera só as parcelas da mesma compra e acompanha os meses", () => {
  const r = montarEdicao(parcelas[1], parcelas, { data: "2026-10-20", descricao: "Televisão", valorAbs: 300 }, true);
  assert.deepEqual(r.map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(r.map((x) => x.data), ["2026-09-20", "2026-10-20", "2026-11-20"]);
  assert.deepEqual(r.map((x) => x.descricao), ["Televisão (1/3)", "Televisão (2/3)", "Televisão (3/3)"]);
  assert.ok(r.every((x) => x.valor === -300));
});

/* ---------- indicadores ---------- */
const contas: Conta[] = [
  { id: 1, nome: "Nubank", tipo: "Corrente", saldo_atual: 1500.5, limite_total: null, dia_vencimento: null },
  { id: 2, nome: "Itaú", tipo: "Corrente", saldo_atual: "500", limite_total: null, dia_vencimento: null },
  { id: 3, nome: "Cartão Nu", tipo: "Crédito", saldo_atual: -800, limite_total: 4000, dia_vencimento: 10 },
  { id: 4, nome: "BTG - CDB", tipo: "Investimento", saldo_atual: 10000, limite_total: null, dia_vencimento: null },
  { id: 5, nome: "BTG - Fundo", tipo: "Investimento", saldo_atual: 5000, limite_total: null, dia_vencimento: null },
  { id: 6, nome: "Tesouro Direto", tipo: "Investimento", saldo_atual: 2000, limite_total: null, dia_vencimento: null },
];
test("KPIs: patrimônio = bancos − dívida + investimentos", () => {
  const k = calcularKpis(contas);
  assert.equal(k.bancos, 2000.5);
  assert.equal(k.divida, 800);
  assert.equal(k.investimentos, 17000);
  assert.equal(k.patrimonio, 2000.5 - 800 + 17000);
});
test("uso do cartão", () => {
  const u = usoCartao(contas[2]);
  assert.deepEqual(u, { usado: 800, limite: 4000, disponivel: 3200, pct: 20 });
  assert.equal(usoCartao({ ...contas[2], saldo_atual: -9000 }).pct, 100);
  assert.equal(usoCartao({ ...contas[2], saldo_atual: 50 }).usado, 0);
});
test("investimentos da mesma instituição são agrupados", () => {
  const { grupos, avulsos } = agruparInvestimentos(contas);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].nome, "BTG Pactual");
  assert.equal(grupos[0].total, 15000);
  assert.deepEqual(grupos[0].itens.map((i) => i.rotulo), ["CDB", "Fundo"]);
  assert.deepEqual(avulsos.map((c) => c.nome), ["Tesouro Direto"]);
});

/* ---------- contas fixas ---------- */
const fixas: DespesaFixa[] = [
  { id: 1, nome: "Aluguel", valor: 1500, dia_vencimento: 5 },
  { id: 2, nome: "Internet", valor: 100, dia_vencimento: 20 },
  { id: 3, nome: "Academia", valor: 90, dia_vencimento: 10 },
  { id: 4, nome: "Luz", valor: 150, dia_vencimento: 31 },
];
const lancadas: Transacao[] = [
  { id: 1, data: "2026-10-05", descricao: "aluguel", valor: -1500, conta_origem_id: 1, categoria_id: 1 },
  { id: 2, data: "2026-09-10", descricao: "Academia", valor: -90, conta_origem_id: 1, categoria_id: 1 },
];
test("conta fixa pendente: venceu e não foi paga neste mês", () => {
  const p = contasFixasPendentes(fixas, lancadas, "2026-10-14");
  assert.deepEqual(p.map((x) => [x.fixa.nome, x.atraso]), [["Academia", 4]]);
});
test("não alerta antes do vencimento; vence hoje conta como pendente", () => {
  assert.equal(contasFixasPendentes(fixas, lancadas, "2026-10-09").length, 0);
  assert.equal(contasFixasPendentes(fixas, lancadas, "2026-10-10")[0].atraso, 0);
});
test("dia 31 em mês curto vence no último dia do mês", () => {
  const p = contasFixasPendentes(fixas, [], "2026-11-30");
  assert.ok(p.some((x) => x.fixa.nome === "Luz"));
});
test("receita com o mesmo nome não conta como conta fixa paga", () => {
  const t: Transacao[] = [{ id: 9, data: "2026-10-12", descricao: "Academia reembolso", valor: 90, conta_origem_id: 1, categoria_id: 1 }];
  assert.ok(contasFixasPendentes(fixas, t, "2026-10-14").some((x) => x.fixa.nome === "Academia"));
});

/* ---------- resumo do mês ---------- */
const cats: Categoria[] = [
  { id: 1, nome: "Mercado", tipo: "Despesa" },
  { id: 2, nome: "Lazer", tipo: "Despesa" },
  { id: 3, nome: "Salário", tipo: "Receita" },
];
const movs: Transacao[] = [
  { id: 1, data: "2026-10-02", descricao: "Feira", valor: -100, conta_origem_id: 1, categoria_id: 1 },
  { id: 2, data: "2026-10-09", descricao: "Super", valor: -250.5, conta_origem_id: 1, categoria_id: 1 },
  { id: 3, data: "2026-10-11", descricao: "Cinema", valor: -60, conta_origem_id: 1, categoria_id: 2 },
  { id: 4, data: "2026-10-05", descricao: "Salário", valor: 5000, conta_origem_id: 1, categoria_id: 3 },
  { id: 5, data: "2026-10-12", descricao: "Taxa: Aporte", valor: -20, conta_origem_id: null, categoria_id: null },
  { id: 6, data: "2026-10-13", descricao: "Aporte", valor: -1000, conta_origem_id: 1, categoria_id: null },
  { id: 7, data: "2026-10-13", descricao: "Recebido: Aporte", valor: 1000, conta_origem_id: 4, categoria_id: null },
  { id: 8, data: "2026-09-20", descricao: "Super", valor: -999, conta_origem_id: 1, categoria_id: 1 },
];
test("gastos por categoria do mês, do maior para o menor", () => {
  assert.deepEqual(gastosPorCategoria(movs, cats, "2026-10"), [
    { nome: "Mercado", total: 350.5 },
    { nome: "Lazer", total: 60 },
  ]);
});
test("totais do mês ignoram transferências e incluem taxas", () => {
  assert.deepEqual(totaisDoMes(movs, cats, "2026-10"), { receitas: 5000, despesas: 430.5 });
});
test("meses disponíveis: mais recente primeiro e sempre com o mês atual", () => {
  assert.deepEqual(mesesDisponiveis(movs, "2026-10-14"), ["2026-10", "2026-09"]);
  assert.deepEqual(mesesDisponiveis([], "2026-10-14"), ["2026-10"]);
});

console.log(`\n${total} testes passaram.`);
