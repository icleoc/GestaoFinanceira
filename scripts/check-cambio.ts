// Testes de contas em moeda estrangeira: saldo em reais, variação cambial e custo médio.
import assert from "node:assert/strict";
import { custoAposAjuste, saldoEmReais, somaEmReais, variacaoCambial } from "../lib/cambio";
import { calcularKpis } from "../lib/finance";
import type { Conta } from "../lib/types";

let total = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    total++;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    console.error(`  FALHOU  ${nome}\n`, e);
    process.exitCode = 1;
  }
}

const brl: Conta = { id: 1, nome: "Banco", tipo: "Corrente", saldo_atual: 1000, limite_total: 0, dia_vencimento: null };
const usd: Conta = { id: 2, nome: "Revolut", tipo: "Corrente", saldo_atual: 1000, limite_total: 0, dia_vencimento: null, moeda: "USD", custo_brl: 5000 };

test("conta em reais ignora cotação", () => {
  assert.equal(saldoEmReais(brl, { USD: 5.5 }), 1000);
});

test("conta em dólar vale saldo × cotação de hoje", () => {
  assert.equal(saldoEmReais(usd, { USD: 5.5 }), 5500);
});

test("sem cotação, a conta estrangeira vale o custo em reais", () => {
  assert.equal(saldoEmReais(usd, {}), 5000);
});

test("variação cambial: ganho quando o dólar sobe", () => {
  const v = variacaoCambial(usd, { USD: 5.5 })!;
  assert.equal(v.atual, 5500);
  assert.equal(v.custo, 5000);
  assert.equal(v.variacao, 500);
  assert.equal(v.pct, 10);
  assert.equal(v.taxaMedia, 5);
});

test("variação cambial: perda quando o dólar cai", () => {
  const v = variacaoCambial(usd, { USD: 4.8 })!;
  assert.equal(v.variacao, -200);
  assert.equal(v.pct, -4);
});

test("sem variação para conta em reais ou sem cotação", () => {
  assert.equal(variacaoCambial(brl, { USD: 5.5 }), null);
  assert.equal(variacaoCambial(usd, {}), null);
});

test("patrimônio converte a conta em dólar pela cotação", () => {
  const k = calcularKpis([brl, usd], { USD: 5.5 });
  assert.equal(k.bancos, 6500);
  assert.equal(k.patrimonio, 6500);
});

test("soma em reais mistura contas em reais e em moeda estrangeira", () => {
  assert.equal(somaEmReais([brl, usd], { USD: 5 }), 6000);
});

test("ajuste de saldo para mais: o que entrou custa a cotação de hoje", () => {
  assert.equal(custoAposAjuste(1000, 5000, 1200, 5.5), 6100);
});

test("ajuste de saldo para menos: o custo cai na mesma proporção", () => {
  assert.equal(custoAposAjuste(1000, 5000, 400, 5.5), 2000);
});

test("saldo zerado zera o custo", () => {
  assert.equal(custoAposAjuste(1000, 5000, 0, 5.5), 0);
});

console.log(`\n${total} testes de câmbio passaram.`);
