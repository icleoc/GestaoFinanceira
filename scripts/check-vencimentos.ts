// Testes da agenda de vencimentos e do calendário (.ics).
import assert from "node:assert/strict";
import { diasEntre, filtrarPorAviso, proximosVencimentos, quandoVence } from "../lib/vencimentos";
import { gerarIcs } from "../lib/calendario";
import type { Divida, DespesaFixa, Transacao } from "../lib/types";

let total = 0;
function test(nome: string, fn: () => void) {
  try { fn(); total++; console.log(`  ok  ${nome}`); } catch (e) { console.error(`FALHOU  ${nome}`); console.error(e); process.exit(1); }
}

const hoje = "2026-10-21";
const fixas: DespesaFixa[] = [{ id: 1, nome: "Aluguel", valor: 1800, dia_vencimento: 28 }, { id: 2, nome: "Internet", valor: 120, dia_vencimento: 31 }];
const divida: Divida = { id: "d1", tipo: "financiamento", nome: "Carro", valor_bem: 60000, entrada: 10000, parcelas: 48, valor_parcela: 1500, primeira_parcela: "2025-08-10", parcelas_pagas: 14 };
const pago = (descricao: string): Transacao => ({ id: 9, data: "2026-10-05", descricao, valor: -120 } as unknown as Transacao);

test("diasEntre conta dias de calendário", () => {
  assert.equal(diasEntre("2026-10-21", "2026-10-28"), 7);
  assert.equal(diasEntre("2026-10-21", "2026-10-20"), -1);
  assert.equal(diasEntre("2026-10-31", "2026-11-01"), 1);
});
test("conta fixa e parcela aparecem na mesma agenda, em ordem de data", () => {
  const v = proximosVencimentos({ fixas, transacoes: [], dividas: [divida] }, hoje, 30);
  const datas = v.map((x) => x.data);
  assert.deepEqual(datas, [...datas].sort());
  assert.ok(v.some((x) => x.chave === "fixa:1" && x.data === "2026-10-28" && x.dias === 7));
  assert.ok(v.some((x) => x.chave === "divida:d1" && x.indice === 15));
});
test("a próxima parcela atrasada entra, mas as outras atrasadas não", () => {
  const v = proximosVencimentos({ fixas: [], transacoes: [], dividas: [{ ...divida, parcelas_pagas: 2 }] }, hoje, 30);
  const parcelas = v.filter((x) => x.origem === "divida");
  assert.equal(parcelas[0].indice, 3);
  assert.ok(parcelas[0].dias < 0);
  assert.ok(parcelas.slice(1).every((x) => x.dias >= 0 || x.indice === 3));
});
test("conta fixa já lançada neste mês some só deste mês", () => {
  const v = proximosVencimentos({ fixas: [fixas[1]], transacoes: [pago("Internet outubro")], dividas: [] }, hoje, 60);
  assert.ok(!v.some((x) => x.data.startsWith("2026-10")));
  assert.ok(v.some((x) => x.data === "2026-11-30"));
});
test("dia 31 num mês curto cai no último dia", () => {
  const v = proximosVencimentos({ fixas: [fixas[1]], transacoes: [], dividas: [] }, hoje, 60);
  assert.ok(v.some((x) => x.data === "2026-11-30"));
});
test("filtro por pessoa: desligado = nada; contas escolhidas = só elas; nulo = todas", () => {
  const v = proximosVencimentos({ fixas, transacoes: [], dividas: [divida] }, hoje, 30);
  assert.equal(filtrarPorAviso(v, null).length, 0);
  assert.equal(filtrarPorAviso(v, { ativo: false, contas: null }).length, 0);
  assert.equal(filtrarPorAviso(v, { ativo: true, contas: null }).length, v.length);
  const so = filtrarPorAviso(v, { ativo: true, contas: ["fixa:1"] });
  assert.ok(so.length > 0 && so.every((x) => x.chave === "fixa:1"));
});
test("textos de prazo", () => {
  assert.equal(quandoVence(0), "vence hoje");
  assert.equal(quandoVence(1), "vence amanhã");
  assert.equal(quandoVence(4), "vence em 4 dias");
  assert.equal(quandoVence(-2), "venceu há 2 dias");
});
test("ics: um evento por vencimento, com alarmes de 7, 4, 1 dia e do dia", () => {
  const itens = proximosVencimentos({ fixas: [fixas[0]], transacoes: [], dividas: [] }, hoje, 10);
  const ics = gerarIcs({ calendario: "Teste", itens, dias: [7, 4, 1, 0], agora: new Date("2026-10-21T12:00:00Z") });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR") && ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, itens.length);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 4 * itens.length);
  for (const g of ["-P6DT15H", "-P3DT15H", "-PT15H", "PT9H"]) assert.ok(ics.includes(`TRIGGER;RELATED=START:${g}`), g);
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261028") && ics.includes("DTEND;VALUE=DATE:20261029"));
  assert.ok(ics.includes("\r\n"));
});
test("ics: texto com vírgula e ponto e vírgula é escapado", () => {
  const ics = gerarIcs({ calendario: "A;B", itens: [{ chave: "fixa:1", origem: "fixa", nome: "Luz, água; gás", valor: 10, data: "2026-10-28", dias: 7 }], dias: [0] });
  assert.ok(ics.includes("Luz\\, água\; gás"));
});
console.log(`\n${total} testes de vencimentos passaram.`);
