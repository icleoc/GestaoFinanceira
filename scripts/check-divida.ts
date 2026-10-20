// Testes de financiamentos e empréstimos.
import assert from "node:assert/strict";
import { calcular, descricaoDaParcela, resumir, situacao, taxaImplicita, valorPresente, vencimento, type Divida } from "../lib/divida";
import { parseParcela } from "../lib/finance";

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

const base = (o: Partial<Divida> = {}): Divida => ({
  id: "d1",
  tipo: "financiamento",
  nome: "Carro",
  valor_bem: 60000,
  entrada: 10000,
  parcelas: 48,
  valor_parcela: 1500,
  primeira_parcela: "2026-01-10",
  parcelas_pagas: 0,
  ...o,
});

test("juros e valor final: bem de 60 mil, entrada de 10 mil, 48 x 1.500", () => {
  const c = calcular({ valorBem: 60000, entrada: 10000, parcelas: 48, valorParcela: 1500 });
  assert.equal(c.financiado, 50000);
  assert.equal(c.totalParcelas, 72000);
  assert.equal(c.totalPago, 82000);
  assert.equal(c.juros, 22000);
  assert.equal(c.jurosPct, 44);
  assert.equal(c.taxaMensalPct, 1.6);
});

test("a taxa mensal descoberta devolve o valor financiado", () => {
  const i = taxaImplicita(10000, 1000, 12);
  assert.ok(Math.abs(valorPresente(1000, i, 12) - 10000) < 0.01);
  assert.ok(Math.abs(i * 100 - 2.92) < 0.01);
});

test("empréstimo de 5.000 em 10 x 600 (sem entrada)", () => {
  const c = calcular({ valorBem: 5000, entrada: 0, parcelas: 10, valorParcela: 600 });
  assert.equal(c.juros, 1000);
  assert.equal(c.totalPago, 6000);
});

test("sem juros (parcelas somam o valor): taxa zero", () => {
  const c = calcular({ valorBem: 1200, entrada: 0, parcelas: 12, valorParcela: 100 });
  assert.equal(c.juros, 0);
  assert.equal(c.taxaMensalPct, 0);
  assert.equal(c.aviso, null);
});

test("avisa quando as parcelas somam menos que o financiado e quando a entrada é grande demais", () => {
  assert.ok(calcular({ valorBem: 1000, entrada: 0, parcelas: 5, valorParcela: 100 }).aviso);
  const c = calcular({ valorBem: 1000, entrada: 1000, parcelas: 5, valorParcela: 100 });
  assert.equal(c.ok, false);
  assert.ok(c.aviso);
});

test("campos vazios não calculam nada", () => {
  assert.equal(calcular({ valorBem: 0, entrada: 0, parcelas: 0, valorParcela: 0 }).ok, false);
});

test("vencimentos mensais; dia 31 em mês curto cai no último dia", () => {
  assert.equal(vencimento("2026-01-31", 1), "2026-01-31");
  assert.equal(vencimento("2026-01-31", 2), "2026-02-28");
  assert.equal(vencimento("2026-01-31", 3), "2026-03-31");
  assert.equal(vencimento("2026-11-10", 3), "2027-01-10");
});

test("parcelas retroativas: contam como pagas e a próxima é a seguinte", () => {
  const s = situacao(base({ parcelas_pagas: 9 }), "2026-10-18");
  assert.equal(s.pagas, 9);
  assert.equal(s.restantes, 39);
  assert.deepEqual(s.proxima, { indice: 10, data: "2026-10-10" });
  assert.equal(s.faltaPagar, 58500);
  assert.equal(s.atrasadas, 1); // a de 10/10 já venceu e não foi paga
  assert.equal(s.pctPago, 19);
});

test("saldo para quitar é menor que o que falta pagar (os juros futuros saem) e os juros fecham", () => {
  const d = base({ parcelas_pagas: 12 });
  const s = situacao(d, "2027-01-05");
  assert.ok(s.saldoParaQuitar < s.faltaPagar);
  const jurosTotal = 48 * 1500 - 50000;
  assert.ok(Math.abs(s.jurosPagos + s.jurosRestantes - jurosTotal) < 0.02);
});

test("dívida quitada não tem próxima parcela nem entra no resumo", () => {
  const q = base({ parcelas_pagas: 48 });
  const s = situacao(q, "2031-01-01");
  assert.equal(s.quitada, true);
  assert.equal(s.proxima, null);
  const r = resumir([q, base({ id: "d2", nome: "Moto", parcelas: 10, valor_parcela: 800, valor_bem: 7000, entrada: 0, parcelas_pagas: 4, primeira_parcela: "2026-07-05" })], "2026-10-18");
  assert.equal(r.emAberto, 1);
  assert.equal(r.mensal, 800);
  assert.equal(r.faltaPagar, 4800);
});

test("a descrição da parcela paga segue o formato das compras parceladas", () => {
  const p = parseParcela(descricaoDaParcela("Carro ", 10, 48));
  assert.deepEqual(p, { base: "Carro", indice: 10, total: 48 });
});

console.log(`\n${total} testes de dívidas passaram.`);
