import { supabaseBrowser } from "./supabase/client";
import * as demo from "./demo";
import { descricaoDaParcela } from "./divida";
import type {
  Categoria,
  Conta,
  Dados,
  DespesaFixa,
  Divida,
  FormaCompra,
  Id,
  Limite,
  Membro,
  NovaTransacao,
  Papel,
  Permissao,
  Pretensao,
  Sessao,
  StatusPretensao,
  TipoDivida,
  TipoCategoria,
  TipoConta,
  Transacao,
} from "./types";
import type { AtualizacaoTransacao } from "./finance";

/** Transforma o erro do Supabase em mensagem que a pessoa entende. */
function falha(contexto: string, error: { message: string; code?: string }): Error {
  if (error.code === "23503") {
    return new Error(`${contexto}: este item está sendo usado em outros registros. Remova ou mude esses registros primeiro.`);
  }
  if (error.code === "23505") {
    return new Error(`${contexto}: já existe um item com esse nome.`);
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return new Error(`${contexto}: sem permissão. Você não tem permissão para isso nesta carteira.`);
  }
  return new Error(`${contexto}: ${error.message}`);
}

/* ---------- carteira e sessão ---------- */

let carteiraAtual = "";

/** Define em qual carteira as próximas leituras e gravações acontecem. */
export function usarCarteira(id: string) {
  carteiraAtual = id;
  try {
    localStorage.setItem("carteira", id);
  } catch {
    /* sem armazenamento local: tudo bem */
  }
}

interface LinhaMembro {
  carteira_id: string;
  papel: Papel;
  permissoes: Permissao[];
  carteiras: { nome: string } | { nome: string }[] | null;
}

/** Quem está logado, em qual carteira e com quais permissões. Null se não tiver carteira. */
export async function carregarSessao(): Promise<Sessao | null> {
  if (demo.emDemo()) return demo.SESSAO_DEMO;
  const db = supabaseBrowser();
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const { data, error } = await db
    .from("membros")
    .select("carteira_id, papel, permissoes, carteiras(nome)")
    .eq("user_id", user.id)
    .order("criado_em");
  if (error) throw falha("Não foi possível carregar o seu acesso", error);
  const linhas = (data ?? []) as unknown as LinhaMembro[];
  if (linhas.length === 0) return null;

  const nomeDe = (l: LinhaMembro) => (Array.isArray(l.carteiras) ? l.carteiras[0]?.nome : l.carteiras?.nome) ?? "Carteira";
  let preferida = "";
  try {
    preferida = localStorage.getItem("carteira") ?? "";
  } catch {
    /* ignora */
  }
  const escolhida = linhas.find((l) => l.carteira_id === preferida) ?? linhas[0];
  usarCarteira(escolhida.carteira_id);
  return {
    userId: user.id,
    email: user.email ?? "",
    carteiraId: escolhida.carteira_id,
    carteiraNome: nomeDe(escolhida),
    papel: escolhida.papel,
    permissoes: escolhida.permissoes,
    carteiras: linhas.map((l) => ({ id: l.carteira_id, nome: nomeDe(l) })),
  };
}

const PAGINA = 1000;

async function todasTransacoes(): Promise<Transacao[]> {
  const db = supabaseBrowser();
  const saida: Transacao[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("transacoes")
      .select("*")
      .eq("carteira_id", carteiraAtual)
      .order("data", { ascending: false })
      .order("id", { ascending: false })
      .range(de, de + PAGINA - 1);
    if (error) throw falha("Não foi possível carregar os lançamentos", error);
    saida.push(...((data ?? []) as Transacao[]));
    if (!data || data.length < PAGINA) break;
  }
  return saida;
}

export async function carregarDados(): Promise<Dados> {
  if (demo.emDemo()) return demo.demoDados();
  const db = supabaseBrowser();
  const [co, ca, fi, pr, transacoes, mb, li, dv] = await Promise.all([
    db.from("contas").select("*").eq("carteira_id", carteiraAtual).order("nome"),
    db.from("categorias").select("*").eq("carteira_id", carteiraAtual).order("nome"),
    db.from("despesas_fixas").select("*").eq("carteira_id", carteiraAtual).order("dia_vencimento"),
    db.from("pretensoes").select("*").eq("carteira_id", carteiraAtual).order("criado_em", { ascending: false }),
    todasTransacoes(),
    db.from("membros").select("user_id, nome, email").eq("carteira_id", carteiraAtual),
    // Antes da migração 003 a tabela não existe: segue sem limites, sem quebrar o painel.
    db.from("limites").select("user_id, valor_mensal").eq("carteira_id", carteiraAtual),
    // Antes da migração 004 a tabela não existe: segue sem financiamentos, sem quebrar o painel.
    db.from("dividas").select("*").eq("carteira_id", carteiraAtual).order("criado_em"),
  ]);
  if (co.error) throw falha("Não foi possível carregar as contas", co.error);
  if (ca.error) throw falha("Não foi possível carregar as categorias", ca.error);
  if (fi.error) throw falha("Não foi possível carregar as contas fixas", fi.error);
  if (pr.error) throw falha("Não foi possível carregar as pretensões de compra", pr.error);
  return {
    membros: (mb.data ?? []) as NonNullable<Dados["membros"]>,
    limites: li.error ? [] : ((li.data ?? []) as Limite[]),
    dividas: dv.error ? [] : ((dv.data ?? []) as Divida[]),
    pretensoes: (pr.data ?? []) as Pretensao[],
    contas: (co.data ?? []) as Conta[],
    categorias: (ca.data ?? []) as Categoria[],
    fixas: (fi.data ?? []) as DespesaFixa[],
    transacoes,
  };
}

/** Grava todas as linhas de uma vez: ou entra tudo, ou nada. Devolve os ids criados (para poder desfazer). */
export async function inserirTransacoes(linhas: NovaTransacao[]): Promise<Id[]> {
  if (demo.emDemo()) return demo.demoInserir(linhas);
  const db = supabaseBrowser();
  const completas = linhas.map((l) => ({ ...l, carteira_id: carteiraAtual }));
  let { data, error } = await db.from("transacoes").insert(completas).select("id");
  // Banco ainda sem a migração 002: o lançamento entra, só sem os itens lidos da nota.
  if (error && /nota_dados/.test(error.message) && completas.some((l) => l.nota_dados)) {
    ({ data, error } = await db
      .from("transacoes")
      .insert(
        completas.map((l) => {
          const { nota_dados, ...resto } = l;
          void nota_dados;
          return resto;
        }),
      )
      .select("id"));
  }
  if (error) throw falha("Não foi possível registrar o lançamento", error);
  return ((data ?? []) as { id: Id }[]).map((r) => r.id);
}

/** A carteira em uso agora (para rotas do servidor que precisam saber). */
export function carteiraDaSessao(): string {
  return carteiraAtual;
}

export async function atualizarTransacoes(itens: AtualizacaoTransacao[]): Promise<void> {
  if (demo.emDemo()) return demo.demoAtualizar(itens as never);
  const db = supabaseBrowser();
  for (const it of itens) {
    const { error } = await db
      .from("transacoes")
      .update({ data: it.data, descricao: it.descricao, valor: it.valor, ...(it.conta_origem_id !== undefined ? { conta_origem_id: it.conta_origem_id } : {}) })
      .eq("id", it.id);
    if (error) throw falha("Não foi possível salvar a edição", error);
  }
}

export async function mudarCategoria(ids: Id[], categoriaId: Id | null): Promise<void> {
  if (demo.emDemo()) return demo.demoCategoria(ids, categoriaId);
  const { error } = await supabaseBrowser().from("transacoes").update({ categoria_id: categoriaId }).in("id", ids);
  if (error) throw falha("Não foi possível mudar a categoria", error);
}

export async function excluirTransacoes(ids: Id[]): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluir(ids);
  const { error } = await supabaseBrowser().from("transacoes").delete().in("id", ids);
  if (error) throw falha("Não foi possível excluir", error);
}

export async function criarConta(c: {
  nome: string;
  tipo: TipoConta;
  valor: number;
  diaVencimento: number | null;
  bandeira?: string | null;
  finalCartao?: string | null;
  diaFechamento?: number | null;
  titularId?: string | null;
}): Promise<void> {
  if (demo.emDemo()) {
    const credito = c.tipo === "Crédito";
    return demo.demoCriarConta({
      id: 0,
      nome: c.nome,
      tipo: c.tipo,
      saldo_atual: credito ? 0 : c.valor,
      limite_total: credito ? c.valor : 0,
      dia_vencimento: credito ? c.diaVencimento : null,
      bandeira: c.bandeira ?? null,
      final_cartao: c.finalCartao ?? null,
      dia_fechamento: c.diaFechamento ?? null,
      titular_id: c.titularId ?? null,
    });
  }
  const credito = c.tipo === "Crédito";
  const base = {
    nome: c.nome,
    tipo: c.tipo,
    saldo_atual: credito ? 0 : c.valor,
    limite_total: credito ? c.valor : 0,
    dia_vencimento: credito ? c.diaVencimento : null,
    carteira_id: carteiraAtual,
  };
  const cartao = credito
    ? { bandeira: c.bandeira || null, final_cartao: c.finalCartao || null, dia_fechamento: c.diaFechamento ?? null, titular_id: c.titularId || null }
    : {};
  const db = supabaseBrowser();
  let { error } = await db.from("contas").insert({ ...base, ...cartao });
  // Banco ainda sem a migração 003: cria o cartão só com o essencial.
  if (error && /bandeira|final_cartao|dia_fechamento|titular_id/.test(error.message)) {
    ({ error } = await db.from("contas").insert(base));
  }
  if (error) throw falha("Não foi possível criar a conta", error);
}

export async function excluirConta(id: Id): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluirConta(id);
  const { error } = await supabaseBrowser().from("contas").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a conta", error);
}

export async function criarFixa(f: { nome: string; valor: number; dia: number }): Promise<void> {
  if (demo.emDemo()) return demo.demoCriarFixa(f);
  const { error } = await supabaseBrowser()
    .from("despesas_fixas")
    .insert({ nome: f.nome, valor: f.valor, dia_vencimento: f.dia, carteira_id: carteiraAtual });
  if (error) throw falha("Não foi possível criar a conta fixa", error);
}

export async function excluirFixa(id: Id): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluirFixa(id);
  const { error } = await supabaseBrowser().from("despesas_fixas").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a conta fixa", error);
}

export async function criarCategoria(c: { nome: string; tipo: TipoCategoria }): Promise<Id> {
  if (demo.emDemo()) return demo.demoCriarCategoria(c.nome, c.tipo);
  const { data, error } = await supabaseBrowser()
    .from("categorias")
    .insert({ ...c, carteira_id: carteiraAtual })
    .select("id")
    .single();
  if (error || !data) throw falha("Não foi possível criar a categoria", error ?? { message: "sem resposta" });
  return (data as { id: Id }).id;
}

export async function excluirCategoria(id: Id): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluirCategoria(id);
  const { error } = await supabaseBrowser().from("categorias").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a categoria", error);
}

/* ---------- fotos das notas ---------- */

/** Envia a foto da nota para a pasta da carteira e devolve o caminho guardado no lançamento. */
export async function enviarNota(foto: Blob): Promise<string> {
  if (demo.emDemo()) return demo.demoGuardarFoto(foto);
  const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  const caminho = `${carteiraAtual}/${id}.${ext}`;
  const { error } = await supabaseBrowser().storage.from("notas").upload(caminho, foto, { contentType: foto.type, upsert: false });
  if (error) throw new Error(`Não foi possível enviar a foto da nota: ${error.message}`);
  return caminho;
}

/** Endereço temporário (2 minutos) para ver a foto de uma nota. */
export async function enderecoDaNota(caminho: string): Promise<string> {
  if (demo.emDemo()) return demo.demoEnderecoDaFoto(caminho);
  const { data, error } = await supabaseBrowser().storage.from("notas").createSignedUrl(caminho, 120);
  if (error || !data) throw new Error("Não foi possível abrir a foto da nota.");
  return data.signedUrl;
}

export async function removerNotas(caminhos: string[]): Promise<void> {
  if (demo.emDemo()) return demo.demoRemoverFotos(caminhos);
  if (caminhos.length === 0) return;
  await supabaseBrowser().storage.from("notas").remove(caminhos);
}

/* ---------- pretensões de compra ---------- */

export interface NovaPretensao {
  nome: string;
  categoria: string | null;
  valor: number;
  forma: FormaCompra;
  parcelas: number;
  entrada: number;
  juros_mensal: number;
  prevista: string | null;
}

export async function criarPretensao(p: NovaPretensao): Promise<void> {
  if (demo.emDemo()) return demo.demoPretensao(p);
  const { error } = await supabaseBrowser()
    .from("pretensoes")
    .insert({ ...p, carteira_id: carteiraAtual });
  if (error) throw falha("Não foi possível salvar a pretensão", error);
}

export async function mudarStatusPretensao(id: string, status: StatusPretensao): Promise<void> {
  if (demo.emDemo()) return demo.demoStatusPretensao(id, status);
  const { error } = await supabaseBrowser().from("pretensoes").update({ status }).eq("id", id);
  if (error) throw falha("Não foi possível atualizar a pretensão", error);
}

export async function excluirPretensao(id: string): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluirPretensao(id);
  const { error } = await supabaseBrowser().from("pretensoes").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a pretensão", error);
}

/* ---------- limite de gasto por pessoa ---------- */

/** Define (ou tira, com valor nulo) o limite mensal de gasto de uma pessoa. */
export async function definirLimite(userId: string, valorMensal: number | null): Promise<void> {
  if (demo.emDemo()) return demo.demoLimite(userId, valorMensal);
  const db = supabaseBrowser();
  if (valorMensal === null) {
    const { error } = await db.from("limites").delete().eq("carteira_id", carteiraAtual).eq("user_id", userId);
    if (error) throw falha("Não foi possível remover o limite", error);
    return;
  }
  const { error } = await db
    .from("limites")
    .upsert({ carteira_id: carteiraAtual, user_id: userId, valor_mensal: valorMensal }, { onConflict: "carteira_id,user_id" });
  if (error) {
    throw /relation .*limites|does not exist|schema cache/i.test(error.message)
      ? new Error("O limite por pessoa precisa da atualização 003 do banco (ver README).")
      : falha("Não foi possível salvar o limite", error);
  }
}

/* ---------- equipe ---------- */

export async function listarMembros(): Promise<Membro[]> {
  if (demo.emDemo()) return demo.demoMembros();
  const { data, error } = await supabaseBrowser()
    .from("membros")
    .select("user_id, nome, email, papel, permissoes")
    .eq("carteira_id", carteiraAtual)
    .order("criado_em");
  if (error) throw falha("Não foi possível carregar as pessoas", error);
  return (data ?? []) as Membro[];
}

async function chamarEquipe(metodo: "POST" | "PATCH" | "DELETE", corpo: Record<string, unknown>): Promise<{ senhaTemporaria?: string }> {
  if (demo.emDemo()) {
    if (metodo === "POST") demo.demoConvidar(corpo as { nome: string; email: string; permissoes: Permissao[] });
    else if (metodo === "PATCH") demo.demoMudarPermissoes(String(corpo.userId), corpo.permissoes as Permissao[]);
    else demo.demoRemover(String(corpo.userId));
    return metodo === "POST" ? { senhaTemporaria: "(demonstração)" } : {};
  }
  const r = await fetch("/api/equipe", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...corpo, carteiraId: carteiraAtual }),
  });
  const json = (await r.json().catch(() => ({}))) as { erro?: string; senhaTemporaria?: string };
  if (!r.ok) throw new Error(json.erro ?? "Não foi possível concluir.");
  return json;
}

export function convidarPessoa(p: { nome: string; email: string; senha: string; permissoes: Permissao[] }) {
  return chamarEquipe("POST", p);
}
export function mudarPermissoes(userId: string, permissoes: Permissao[]) {
  return chamarEquipe("PATCH", { userId, permissoes });
}
export function removerPessoa(userId: string) {
  return chamarEquipe("DELETE", { userId });
}

export async function sair(): Promise<void> {
  if (demo.emDemo()) return;
  await supabaseBrowser().auth.signOut();
}


/* ---------- financiamentos e empréstimos ---------- */

export interface NovaDivida {
  tipo: TipoDivida;
  nome: string;
  valor_bem: number;
  entrada: number;
  parcelas: number;
  valor_parcela: number;
  primeira_parcela: string;
  parcelas_pagas: number;
  conta_id: Id | null;
  categoria_id: Id | null;
}

export async function criarDivida(d: NovaDivida): Promise<void> {
  if (demo.emDemo()) return demo.demoCriarDivida(d);
  const { error } = await supabaseBrowser().from("dividas").insert({ ...d, carteira_id: carteiraAtual });
  if (error) throw falha("Não foi possível salvar", error);
}

export async function atualizarDivida(id: string, d: NovaDivida): Promise<void> {
  if (demo.emDemo()) return demo.demoAtualizarDivida(id, d);
  const { error } = await supabaseBrowser().from("dividas").update(d).eq("id", id);
  if (error) throw falha("Não foi possível salvar", error);
}

/** Apagar a dívida não apaga os lançamentos das parcelas que já foram pagas pelo app. */
export async function excluirDivida(id: string): Promise<void> {
  if (demo.emDemo()) return demo.demoExcluirDivida(id);
  const { error } = await supabaseBrowser().from("dividas").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir", error);
}

export interface PagamentoParcela {
  /** Lança a parcela no extrato (sai da conta). Sem isso, só marca como paga. */
  lancar: boolean;
  contaId: Id | null;
  categoriaId: Id | null;
  data: string;
}

/** Marca a próxima parcela como paga e, se pedido, lança o valor no extrato. */
export async function pagarParcela(d: Divida, p: PagamentoParcela): Promise<void> {
  const indice = d.parcelas_pagas + 1;
  if (demo.emDemo()) {
    const ids = p.lancar
      ? demo.demoInserir([{ data: p.data, descricao: descricaoDaParcela(d.nome, indice, d.parcelas), valor: -Number(d.valor_parcela), conta_origem_id: p.contaId, categoria_id: p.categoriaId }])
      : [];
    return demo.demoPagarParcela(d.id, ids.length);
  }
  let ids: Id[] = [];
  if (p.lancar) {
    ids = await inserirTransacoes([
      { data: p.data, descricao: descricaoDaParcela(d.nome, indice, d.parcelas), valor: -Number(d.valor_parcela), conta_origem_id: p.contaId, categoria_id: p.categoriaId },
    ]);
  }
  const { error } = await supabaseBrowser().rpc("pagar_parcela", { p_id: d.id });
  if (error) {
    // Não deixa o lançamento solto se a parcela não pôde ser marcada.
    if (ids.length > 0) await excluirTransacoes(ids).catch(() => undefined);
    throw falha("Não foi possível marcar a parcela como paga", error);
  }
}
