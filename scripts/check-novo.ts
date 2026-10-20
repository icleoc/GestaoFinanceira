// Testes do assistente, do planejamento de compras, do câmbio e das permissões.
import assert from "node:assert/strict";
import { converter, lerTaxa } from "../lib/cambio";
import { gerarInsights, mediaPorCategoria, parcelasFuturas, serieMensal, somarMes } from "../lib/assistente";
import { analisarPretensao, montarPerfil, parcelaPrice, resumirLista, type Perfil } from "../lib/planejamento";
import { papelDe, permissoesValidas, pode } from "../lib/permissoes";
import { falarValor, montarResumoFalado } from "../lib/voz";
import { gastoPorPessoa, situacaoDoLimite } from "../lib/limites";
import { grupoDaCompra, sugerirCategoria } from "../lib/categorizar";
import type { Categoria, Conta, Dados, Transacao } from "../lib/types";

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

/* ---------- câmbio ---------- */
test("converte moeda estrangeira em reais com centavos exatos", () => {
  assert.equal(converter(3000, 5.6246), 16873.8);
  assert.equal(converter(1234.56, 6.1234), 7559.7);
  assert.equal(converter(0, 5), 0);
  assert.equal(converter(10, 0), 0);
});
test("lê cotação com vírgula ou ponto", () => {
  assert.equal(lerTaxa("5,6246"), 5.6246);
  assert.equal(lerTaxa("5.6246"), 5.6246);
  assert.equal(lerTaxa("abc"), 0);
  assert.equal(lerTaxa("-2"), 0);
});

/* ---------- permissões ---------- */
test("papéis prontos são reconhecidos pelas permissões", () => {
  assert.equal(papelDe(["ver"]), "leitor");
  assert.equal(papelDe(["planejar", "lancar", "ver"]), "membro");
  assert.equal(papelDe(["ver", "editar"]), "personalizado");
  assert.equal(papelDe(["ver", "lancar", "editar", "gerenciar", "planejar", "equipe"]), "admin");
});
test("permissões inválidas são descartadas", () => {
  assert.deepEqual(permissoesValidas(["ver", "voar", "ver", "lancar"]), ["ver", "lancar"]);
  assert.deepEqual(permissoesValidas("ver"), []);
  assert.equal(pode(["ver"], "lancar"), false);
  assert.equal(pode(undefined, "ver"), false);
});

/* ---------- financiamento ---------- */
test("parcela da tabela Price confere com o valor conhecido", () => {
  assert.equal(parcelaPrice(10000, 0.01, 12), 888.49);
  assert.equal(parcelaPrice(1200, 0, 12), 100);
  assert.equal(parcelaPrice(0, 0.01, 12), 0);
});

/* ---------- dados de exemplo ---------- */
const cats: Categoria[] = [
  { id: 1, nome: "Mercado", tipo: "Despesa" },
  { id: 2, nome: "Restaurante", tipo: "Despesa" },
  { id: 3, nome: "Salário", tipo: "Receita" },
];
const contas: Conta[] = [
  { id: 10, nome: "Banco", tipo: "Corrente", saldo_atual: 20000, limite_total: 0, dia_vencimento: null },
  { id: 11, nome: "Cartão", tipo: "Crédito", saldo_atual: -4500, limite_total: 5000, dia_vencimento: 18 },
];
const mov = (id: number, data: string, valor: number, cat: number | null, conta = 10, descricao = "x"): Transacao => ({
  id,
  data,
  descricao,
  valor,
  categoria_id: cat,
  conta_origem_id: conta,
});
// Julho a setembro: salário 10.000, mercado 1.000, restaurante 500. Outubro: mercado alto.
const transacoes: Transacao[] = [
  ...["2026-07", "2026-08", "2026-09"].flatMap((m, i) => [
    mov(100 + i * 3, `${m}-05`, 10000, 3),
    mov(101 + i * 3, `${m}-10`, -1000, 1),
    mov(102 + i * 3, `${m}-12`, -500, 2),
  ]),
  mov(200, "2026-10-05", 10000, 3),
  mov(201, "2026-10-08", -2000, 1, 10, "Compra grande no mercado"),
  mov(202, "2026-10-09", -400, 2),
  // parcelas futuras no cartão
  mov(300, "2026-11-10", -700, 1, 11),
  mov(301, "2026-12-10", -700, 1, 11),
];
const dados: Dados = { contas, categorias: cats, transacoes, fixas: [], pretensoes: [] };
const HOJE = "2026-10-14";

test("soma de meses em AAAA-MM", () => {
  assert.equal(somarMes("2026-10", -1), "2026-09");
  assert.equal(somarMes("2026-01", -1), "2025-12");
  assert.equal(somarMes("2026-11", 3), "2027-02");
});
test("série mensal traz receitas e despesas dos últimos meses, do mais antigo ao mais novo", () => {
  const s = serieMensal(transacoes, cats, "2026-10", 3);
  assert.deepEqual(s.map((p) => p.mes), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(s[1].despesas, 1500);
  assert.equal(s[2].despesas, 2400);
});
test("média por categoria usa os meses anteriores", () => {
  const m = mediaPorCategoria(transacoes, cats, "2026-10");
  assert.equal(m.get("Mercado"), 1000);
  assert.equal(m.get("Restaurante"), 500);
});
test("parcelas futuras somam só cartão de crédito, mês a mês", () => {
  const f = parcelasFuturas(transacoes, contas, HOJE, 3);
  assert.deepEqual(f, [
    { mes: "2026-11", total: 700 },
    { mes: "2026-12", total: 700 },
    { mes: "2027-01", total: 0 },
  ]);
});

/* ---------- assistente ---------- */
test("assistente aponta a categoria que mais pesa e quem subiu acima da média", () => {
  const ins = gerarInsights(dados, HOJE);
  const topo = ins.find((i) => i.id === "maior-categoria");
  assert.ok(topo);
  assert.match(topo.titulo, /Mercado/);
  const alta = ins.find((i) => i.id === "alta-Mercado");
  assert.ok(alta);
  assert.match(alta.titulo, /100% acima/);
  assert.equal(alta.nivel, "atencao");
});
test("assistente avisa do limite do cartão e do vencimento próximo", () => {
  const ins = gerarInsights(dados, HOJE);
  const limite = ins.find((i) => i.id === "limite-11");
  assert.ok(limite);
  assert.match(limite.titulo, /90%/);
  const vence = ins.find((i) => i.id === "vence-11");
  assert.ok(vence);
  assert.match(vence.titulo, /vence em 4 dias/);
});
test("assistente mostra o que já está comprometido em parcelas", () => {
  const ins = gerarInsights(dados, HOJE);
  assert.match(ins.find((i) => i.id === "parcelas")!.titulo, /1\.400,00/);
});
test("alertas aparecem antes das boas notícias", () => {
  const ins = gerarInsights(dados, HOJE);
  const ordem = ["alerta", "atencao", "info", "bom"];
  const idx = ins.map((i) => ordem.indexOf(i.nivel));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});
test("sem lançamentos, o assistente convida a começar", () => {
  const vazio = gerarInsights({ ...dados, transacoes: [] }, HOJE);
  assert.equal(vazio.length, 1);
  assert.equal(vazio[0].id, "comeco");
});
test("gastar mais do que recebe gera alerta", () => {
  const d: Dados = { ...dados, transacoes: [mov(1, "2026-10-02", 1000, 3), mov(2, "2026-10-03", -3000, 1)] };
  assert.equal(gerarInsights(d, HOJE).find((i) => i.id === "no-vermelho")?.nivel, "alerta");
});

/* ---------- planejamento ---------- */
test("perfil usa a média dos meses anteriores", () => {
  const p = montarPerfil(dados, HOJE);
  assert.equal(p.renda, 10000);
  assert.equal(p.gastoMedio, 1500);
  assert.equal(p.parcelasProximoMes, 700);
  assert.equal(p.liquidez, 20000);
  assert.equal(p.sobraMensal, 8500);
  assert.equal(p.origemRenda, "media");
});
test("sem receita nenhuma, usa a renda informada à mão", () => {
  const d: Dados = { ...dados, transacoes: [mov(1, "2026-10-02", -100, 1)] };
  assert.equal(montarPerfil(d, HOJE, 4000).renda, 4000);
  assert.equal(montarPerfil(d, HOJE).origemRenda, "nenhuma");
});

const perfil: Perfil = {
  renda: 10000,
  gastoMedio: 6000,
  parcelasProximoMes: 0,
  liquidez: 20000,
  investimentos: 0,
  origemRenda: "media",
  sobraMensal: 4000,
};
const base = { parcelas: 1, entrada: 0, juros_mensal: 0 };

test("à vista que não cabe no saldo é arriscado e diz em quantos meses junta", () => {
  const a = analisarPretensao({ ...base, forma: "avista", valor: 30000 }, perfil);
  assert.equal(a.veredito, "arriscado");
  assert.equal(a.mesesParaJuntar, 8);
});
test("à vista que deixa pouca reserva pede atenção", () => {
  const a = analisarPretensao({ ...base, forma: "avista", valor: 12000 }, perfil);
  assert.equal(a.veredito, "atencao");
  assert.equal(a.reservaDepoisMeses, 1.33);
});
test("à vista pequena é tranquila", () => {
  assert.equal(analisarPretensao({ ...base, forma: "avista", valor: 2000 }, perfil).veredito, "tranquilo");
});
test("parcelado que estoura a fatia da renda é arriscado", () => {
  const p: Perfil = { ...perfil, parcelasProximoMes: 3000 };
  const a = analisarPretensao({ forma: "parcelado", valor: 12000, parcelas: 12, entrada: 0, juros_mensal: 0 }, p);
  assert.equal(a.parcela, 1000);
  assert.equal(a.pctRendaParcelas, 40);
  assert.equal(a.veredito, "arriscado");
});
test("financiado mostra juros e entrada; entrada que zera a reserva pede atenção", () => {
  const a = analisarPretensao({ forma: "financiado", valor: 50000, parcelas: 36, entrada: 10000, juros_mensal: 1.5 }, perfil);
  assert.equal(a.parcela, parcelaPrice(40000, 0.015, 36));
  assert.equal(a.totalPago, Math.round((10000 + a.parcela * 36) * 100) / 100);
  assert.ok(a.jurosTotal > 0);
  assert.equal(a.veredito, "atencao");
});
test("financiado confortável fica tranquilo", () => {
  const rico: Perfil = { ...perfil, liquidez: 100000 };
  const a = analisarPretensao({ forma: "financiado", valor: 50000, parcelas: 48, entrada: 10000, juros_mensal: 1.2 }, rico);
  assert.equal(a.veredito, "tranquilo");
});
test("sem renda, o parcelado avisa que faltam dados", () => {
  const a = analisarPretensao({ forma: "parcelado", valor: 1200, parcelas: 12, entrada: 0, juros_mensal: 0 }, { ...perfil, renda: 0, sobraMensal: 0 });
  assert.equal(a.veredito, "sem-dados");
});
test("lista inteira: soma parcelas e entradas só dos desejos ativos", () => {
  const r = resumirLista(
    [
      { id: "a", nome: "A", categoria: null, valor: 12000, forma: "parcelado", parcelas: 12, entrada: 0, juros_mensal: 0, prevista: null, status: "desejo" },
      { id: "b", nome: "B", categoria: null, valor: 3000, forma: "avista", parcelas: 1, entrada: 0, juros_mensal: 0, prevista: null, status: "desejo" },
      { id: "c", nome: "C", categoria: null, valor: 9999, forma: "avista", parcelas: 1, entrada: 0, juros_mensal: 0, prevista: null, status: "descartada" },
    ],
    perfil,
  );
  assert.equal(r.quantidade, 2);
  assert.equal(r.parcelasPorMes, 1000);
  assert.equal(r.avistaTotal, 3000);
  assert.equal(r.pctRendaParcelas, 10);
});

/* ---------- categoria por tipo de estabelecimento ---------- */
test("padaria, restaurante e lanchonete caem em Alimentação; posto em Combustível; farmácia em Saúde", () => {
  const nome = (e: string) => grupoDaCompra(e)?.nome;
  assert.equal(nome("PADARIA PÃO QUENTE LTDA"), "Alimentação");
  assert.equal(nome("Restaurante Sabor & Arte"), "Alimentação");
  assert.equal(nome("Lanchonete do Zé"), "Alimentação");
  assert.equal(nome("AUTO POSTO SHELL"), "Combustível");
  assert.equal(nome("Drogaria São Paulo"), "Saúde");
  assert.equal(nome("Supermercado Bom Preço"), "Mercado");
  assert.equal(nome("Empresa Desconhecida SA"), undefined);
});
test("usa a categoria que a carteira já tem; senão pede para criar", () => {
  const cats: Categoria[] = [
    { id: 1, nome: "Restaurante", tipo: "Despesa" },
    { id: 2, nome: "Mercado", tipo: "Despesa" },
  ];
  assert.equal(sugerirCategoria("Padaria Central", [], cats)?.existente?.nome, "Restaurante");
  assert.equal(sugerirCategoria("Posto Ipiranga", [], cats)?.criar, "Combustível");
  assert.equal(sugerirCategoria("Loja X Atacado", [], cats)?.criar, "Compras");
  assert.equal(sugerirCategoria("Fulano de Tal", [], cats), null);
  assert.equal(grupoDaCompra("Fulano", [{ nome: "Gasolina comum", quantidade: 30, valor: 180 }])?.nome, "Combustível");
});

/* ---------- limite de gasto por pessoa ---------- */
test("soma só as despesas de cada pessoa no mês e avisa a 80% e a 100%", () => {
  const cats: Categoria[] = [
    { id: 1, nome: "Mercado", tipo: "Despesa" },
    { id: 2, nome: "Salário", tipo: "Receita" },
  ];
  const tr = (id: number, data: string, valor: number, cat: number, por: string | null): Transacao => ({
    id, data, descricao: "x", valor, conta_origem_id: 1, categoria_id: cat, criado_por: por,
  });
  const g = gastoPorPessoa(
    [
      tr(1, "2026-10-02", -300, 1, "ana"),
      tr(2, "2026-10-09", -450.5, 1, "ana"),
      tr(3, "2026-10-10", 5000, 2, "ana"),
      tr(4, "2026-09-30", -999, 1, "ana"),
      tr(5, "2026-10-11", -80, 1, "beto"),
      tr(6, "2026-10-12", -80, 1, null),
    ],
    cats,
    "2026-10",
  );
  assert.equal(g.get("ana"), 750.5);
  assert.equal(g.get("beto"), 80);
  assert.equal(g.size, 2);
  assert.equal(situacaoDoLimite(500, 1000).estado, "ok");
  assert.equal(situacaoDoLimite(800, 1000).estado, "perto");
  assert.equal(situacaoDoLimite(1000, 1000).estado, "estourou");
  assert.equal(situacaoDoLimite(1200, 1000).restante, 0);
});

/* ---------- resumo por voz ---------- */
test("fala valores em reais e centavos e monta o resumo", () => {
  assert.equal(falarValor(1234.5), "1.234 reais e 50 centavos");
  assert.equal(falarValor(1), "1 real");
  assert.equal(falarValor(0.01), "0 reais e 1 centavo");
  const t = montarResumoFalado({
    nome: "leo",
    kpis: { bancos: 10000, divida: 800, investimentos: 5000, patrimonio: 14200 },
    receitas: 5000,
    despesas: 1200,
    gastos: [{ nome: "Mercado", total: 600 }],
    insights: [],
    pendentes: 1,
    limite: null,
    mesRotulo: "outubro",
  });
  assert.match(t, /Olá, leo/);
  assert.match(t, /14\.200 reais/);
  assert.match(t, /Mercado, com 600 reais, 50 por cento/);
  assert.match(t, /1 conta fixa/);
});

console.log(`\n${total} testes passaram.`);
