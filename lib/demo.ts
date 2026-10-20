// Modo demonstração: o mesmo painel, com uma família fictícia e tudo guardado só na memória da aba.
// Nada daqui toca no banco. Ao recarregar a página, volta ao começo.

import type { Categoria, Conta, Dados, DadosNota, DespesaFixa, Id, Limite, Membro, NovaTransacao, Permissao, Pretensao, Sessao, Transacao } from "./types";
import { gastoPorPessoa } from "./limites";
import { monthOf } from "./finance";

const LEO = "demo-leo";
const ANA = "demo-ana";
const PEDRO = "demo-pedro";
const TODAS: Permissao[] = ["ver", "lancar", "editar", "gerenciar", "planejar", "equipe"];

let store: Dados | null = null;
let membros: Membro[] = [];
let seq = 5000;
const fotos = new Map<string, string>();

export const emDemo = () => store !== null;

export const SESSAO_DEMO: Sessao = {
  userId: LEO,
  email: "voce@exemplo.com",
  carteiraId: "demo-carteira",
  carteiraNome: "Família Souza (demonstração)",
  papel: "dono",
  permissoes: TODAS,
  carteiras: [{ id: "demo-carteira", nome: "Família Souza (demonstração)" }],
};

/** Números repetíveis: a demonstração parece a mesma para todo mundo no mesmo dia. */
function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function somaMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function iniciarDemo(hoje: string) {
  const agora = monthOf(hoje);
  const diaHoje = Number(hoje.slice(8, 10));

  const contas: Conta[] = [
    { id: 1, nome: "Conta principal", tipo: "Corrente", saldo_atual: 12480.35, limite_total: 0, dia_vencimento: null },
    { id: 2, nome: "Reserva", tipo: "Corrente", saldo_atual: 6200, limite_total: 0, dia_vencimento: null },
    { id: 3, nome: "Cartão do Leo", tipo: "Crédito", saldo_atual: -2140.8, limite_total: 9000, dia_vencimento: 10, dia_fechamento: 3, bandeira: "Visa", final_cartao: "4821", titular_id: LEO },
    { id: 4, nome: "Cartão da Ana", tipo: "Crédito", saldo_atual: -960.4, limite_total: 5000, dia_vencimento: 15, dia_fechamento: 8, bandeira: "Mastercard", final_cartao: "7733", titular_id: ANA },
    { id: 5, nome: "Corretora - Renda fixa", tipo: "Investimento", saldo_atual: 38500, limite_total: 0, dia_vencimento: null },
    { id: 6, nome: "Tesouro Direto", tipo: "Investimento", saldo_atual: 15200, limite_total: 0, dia_vencimento: null },
  ];
  const nomes = ["Mercado", "Alimentação", "Combustível", "Transporte", "Saúde", "Moradia", "Energia", "Internet", "Assinaturas", "Lazer", "Educação", "Compras", "Outros"];
  const categorias: Categoria[] = [
    ...nomes.map((nome, i) => ({ id: i + 1, nome, tipo: "Despesa" as const })),
    { id: 20, nome: "Salário", tipo: "Receita" },
    { id: 21, nome: "Rendimentos", tipo: "Receita" },
  ];
  const cat = (n: string) => categorias.find((c) => c.nome === n)!.id;
  const fixas: DespesaFixa[] = [
    { id: 1, nome: "Aluguel", valor: 2200, dia_vencimento: 5 },
    { id: 2, nome: "Internet", valor: 119.9, dia_vencimento: 12 },
    { id: 3, nome: "Academia", valor: 149.9, dia_vencimento: 20 },
  ];

  const rnd = sorteio(Number(agora.replace("-", "")));
  const transacoes: Transacao[] = [];
  let id = 1;
  const add = (data: string, descricao: string, valor: number, categoria: string, conta: number, por: string) =>
    transacoes.push({ id: id++, data, descricao, valor: Math.round(valor * 100) / 100, conta_origem_id: conta, categoria_id: cat(categoria), moeda: "BRL", criado_por: por });

  const comercios: [string, string, number, number, string][] = [
    ["Supermercado Bom Preço", "Mercado", 90, 420, LEO],
    ["Padaria Pão Quente", "Alimentação", 12, 48, ANA],
    ["Auto Posto Shell", "Combustível", 140, 260, LEO],
    ["Farmácia Saúde", "Saúde", 25, 140, ANA],
    ["Restaurante Sabor & Arte", "Alimentação", 60, 180, LEO],
    ["Cinema Cinemark", "Lazer", 40, 120, PEDRO],
    ["Lanchonete da Esquina", "Alimentação", 15, 45, PEDRO],
    ["Loja de Roupas Centro", "Compras", 80, 320, ANA],
  ];
  for (let k = -5; k <= 0; k++) {
    const mes = somaMes(agora, k);
    const ultimo = k === 0 ? diaHoje : 28;
    const dia = (n: number) => `${mes}-${String(Math.min(n, ultimo)).padStart(2, "0")}`;
    if (k < 0 || diaHoje >= 5) add(dia(5), "Salário", 9800, "Salário", 1, LEO);
    if (k < 0 || diaHoje >= 5) add(dia(5), "Aluguel", -2200, "Moradia", 1, LEO);
    if (k < 0 || diaHoje >= 12) add(dia(12), "Internet", -119.9, "Internet", 1, LEO);
    if (k < 0 || diaHoje >= 15) add(dia(15), "Energia elétrica", -(180 + rnd() * 60), "Energia", 1, LEO);
    if (k < 0 || diaHoje >= 20) add(dia(20), "Netflix e Spotify", -64.8, "Assinaturas", 3, ANA);
    const n = k === 0 ? Math.max(2, Math.round(diaHoje / 2.2)) : 14;
    for (let i = 0; i < n; i++) {
      const [nome, categoria, min, max, por] = comercios[Math.floor(rnd() * comercios.length)];
      const d = 1 + Math.floor(rnd() * ultimo);
      add(dia(d), nome, -(min + rnd() * (max - min)), categoria, por === PEDRO ? 3 : por === ANA ? 4 : 3, por);
    }
  }
  transacoes.sort((a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id));

  membros = [
    { user_id: LEO, nome: "Você", email: "voce@exemplo.com", papel: "dono", permissoes: TODAS },
    { user_id: ANA, nome: "Ana", email: "ana@exemplo.com", papel: "admin", permissoes: ["ver", "lancar", "editar", "planejar"] },
    { user_id: PEDRO, nome: "Pedro (filho)", email: "pedro@exemplo.com", papel: "membro", permissoes: ["ver", "lancar"] },
  ];

  const gastos = gastoPorPessoa(transacoes, categorias, agora);
  const gastoLeo = gastos.get(LEO) ?? 0;
  const gastoPedro = gastos.get(PEDRO) ?? 0;
  const gastoAna = gastos.get(ANA) ?? 0;
  const arred = (n: number, passo: number) => Math.max(passo, Math.ceil(n / passo) * passo);
  // Limites calibrados para o visitante ver os três avisos: perto (ele mesmo), estourou (Pedro) e tranquilo (Ana).
  const limites: Limite[] = [
    { user_id: LEO, valor_mensal: arred(gastoLeo / 0.88, 100) },
    { user_id: ANA, valor_mensal: arred(gastoAna / 0.5, 100) },
    { user_id: PEDRO, valor_mensal: Math.max(50, Math.floor((gastoPedro * 0.9) / 10) * 10) },
  ];

  const pretensoes: Pretensao[] = [
    { id: "p1", nome: "Notebook novo", categoria: "Compras", valor: 6200, forma: "parcelado", parcelas: 10, entrada: 0, juros_mensal: 0, prevista: null, status: "desejo" },
    { id: "p2", nome: "Viagem de férias", categoria: "Lazer", valor: 14000, forma: "avista", parcelas: 1, entrada: 0, juros_mensal: 0, prevista: null, status: "desejo" },
  ];

  store = { contas, categorias, transacoes, fixas, pretensoes, membros: membros.map((m) => ({ user_id: m.user_id, nome: m.nome, email: m.email })), limites };
}

const copia = (): Dados => ({ ...store!, contas: [...store!.contas], categorias: [...store!.categorias], transacoes: [...store!.transacoes], fixas: [...store!.fixas], pretensoes: [...store!.pretensoes], limites: [...(store!.limites ?? [])], membros: [...(store!.membros ?? [])] });
export const demoDados = (): Dados => copia();
export const demoMembros = (): Membro[] => membros.map((m) => ({ ...m }));

export const AVISO_DEMO = "Isto é uma demonstração: nada é salvo de verdade. Crie sua conta para usar com seus dados.";

export function demoInserir(linhas: NovaTransacao[]): Id[] {
  const ids: Id[] = [];
  for (const l of linhas) {
    const novo = { ...l, id: seq++, criado_por: LEO } as Transacao;
    ids.push(novo.id);
    store!.transacoes.unshift(novo);
    // O saldo da conta acompanha o lançamento, como no banco de verdade.
    const c = store!.contas.find((x) => x.id === l.conta_origem_id);
    if (c) c.saldo_atual = Number(c.saldo_atual ?? 0) + Number(l.valor);
  }
  return ids;
}
export function demoExcluir(ids: Id[]) {
  for (const t of store!.transacoes.filter((x) => ids.some((i) => String(i) === String(x.id)))) {
    const c = store!.contas.find((x) => x.id === t.conta_origem_id);
    if (c) c.saldo_atual = Number(c.saldo_atual ?? 0) - Number(t.valor);
  }
  store!.transacoes = store!.transacoes.filter((x) => !ids.some((i) => String(i) === String(x.id)));
}
export function demoAtualizar(itens: { id: Id; data: string; descricao: string; valor: number }[]) {
  for (const it of itens) {
    const t = store!.transacoes.find((x) => String(x.id) === String(it.id));
    if (!t) continue;
    const c = store!.contas.find((x) => x.id === t.conta_origem_id);
    if (c) c.saldo_atual = Number(c.saldo_atual ?? 0) - Number(t.valor) + it.valor;
    Object.assign(t, { data: it.data, descricao: it.descricao, valor: it.valor });
  }
}
export function demoCategoria(ids: Id[], categoriaId: Id | null) {
  for (const t of store!.transacoes) if (ids.some((i) => String(i) === String(t.id))) t.categoria_id = categoriaId;
}
export function demoCriarCategoria(nome: string, tipo: Categoria["tipo"]): Id {
  const novo = { id: seq++, nome, tipo };
  store!.categorias.push(novo);
  return novo.id;
}
export function demoExcluirCategoria(id: Id) {
  store!.categorias = store!.categorias.filter((c) => String(c.id) !== String(id));
}
export function demoCriarConta(c: Conta) {
  store!.contas.push({ ...c, id: seq++ });
}
export function demoExcluirConta(id: Id) {
  store!.contas = store!.contas.filter((c) => String(c.id) !== String(id));
}
export function demoCriarFixa(f: { nome: string; valor: number; dia: number }) {
  store!.fixas.push({ id: seq++, nome: f.nome, valor: f.valor, dia_vencimento: f.dia });
}
export function demoExcluirFixa(id: Id) {
  store!.fixas = store!.fixas.filter((f) => String(f.id) !== String(id));
}
export function demoPretensao(p: Omit<Pretensao, "id" | "status">) {
  store!.pretensoes.unshift({ ...p, id: `p${seq++}`, status: "desejo" });
}
export function demoStatusPretensao(id: string, status: Pretensao["status"]) {
  const p = store!.pretensoes.find((x) => x.id === id);
  if (p) p.status = status;
}
export function demoExcluirPretensao(id: string) {
  store!.pretensoes = store!.pretensoes.filter((x) => x.id !== id);
}
export function demoLimite(userId: string, valor: number | null) {
  const resto = (store!.limites ?? []).filter((l) => l.user_id !== userId);
  store!.limites = valor === null ? resto : [...resto, { user_id: userId, valor_mensal: valor }];
}
export function demoConvidar(p: { nome: string; email: string; permissoes: Permissao[] }) {
  membros.push({ user_id: `demo-${seq++}`, nome: p.nome, email: p.email, papel: "personalizado", permissoes: p.permissoes });
  store!.membros = membros.map((m) => ({ user_id: m.user_id, nome: m.nome, email: m.email }));
}
export function demoMudarPermissoes(userId: string, permissoes: Permissao[]) {
  const m = membros.find((x) => x.user_id === userId);
  if (m) m.permissoes = permissoes;
}
export function demoRemover(userId: string) {
  membros = membros.filter((x) => x.user_id !== userId);
  store!.membros = membros.map((m) => ({ user_id: m.user_id, nome: m.nome, email: m.email }));
}
export function demoGuardarFoto(blob: Blob): string {
  const caminho = `demo/${seq++}.jpg`;
  fotos.set(caminho, URL.createObjectURL(blob));
  return caminho;
}
export const demoEnderecoDaFoto = (caminho: string) => fotos.get(caminho) ?? "";
export function demoRemoverFotos(caminhos: string[]) {
  for (const c of caminhos) {
    const u = fotos.get(c);
    if (u) URL.revokeObjectURL(u);
    fotos.delete(c);
  }
}

const NOTAS: DadosNota[] = [
  { empresa: "Padaria Pão Quente", cnpj: "12.345.678/0001-90", data: null, total: 38.9, categoria: null, itens: [{ nome: "Pão francês", quantidade: 8, valor: 11.2 }, { nome: "Café com leite", quantidade: 2, valor: 14 }, { nome: "Bolo de fubá", quantidade: 1, valor: 13.7 }] },
  { empresa: "Auto Posto Shell", cnpj: "98.765.432/0001-10", data: null, total: 210, categoria: null, itens: [{ nome: "Gasolina comum", quantidade: 35, valor: 210 }] },
  { empresa: "Supermercado Bom Preço", cnpj: "11.222.333/0001-44", data: null, total: 187.45, categoria: null, itens: [{ nome: "Arroz 5kg", quantidade: 1, valor: 32.9 }, { nome: "Feijão", quantidade: 2, valor: 18 }, { nome: "Frutas e legumes", quantidade: 1, valor: 61.55 }, { nome: "Carne", quantidade: 1, valor: 75 }] },
];
let proxima = 0;
/** Leitura de nota de mentira, só para mostrar o fluxo (a foto enviada não é lida). */
export function demoLerNota(hoje: string): DadosNota {
  const n = NOTAS[proxima++ % NOTAS.length];
  return { ...n, data: hoje, itens: n.itens.map((i) => ({ ...i })) };
}
