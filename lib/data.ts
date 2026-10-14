import { supabaseBrowser } from "./supabase/client";
import type {
  Categoria,
  Conta,
  Dados,
  DespesaFixa,
  Id,
  NovaTransacao,
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
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return new Error(`${contexto}: sem permissão. Entre de novo e confira as regras de segurança (RLS) no Supabase.`);
  }
  return new Error(`${contexto}: ${error.message}`);
}

const PAGINA = 1000;

async function todasTransacoes(): Promise<Transacao[]> {
  const db = supabaseBrowser();
  const saida: Transacao[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("transacoes")
      .select("*")
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
  const db = supabaseBrowser();
  const [co, ca, fi, transacoes] = await Promise.all([
    db.from("contas").select("*").order("nome"),
    db.from("categorias").select("*").order("nome"),
    db.from("despesas_fixas").select("*").order("dia_vencimento"),
    todasTransacoes(),
  ]);
  if (co.error) throw falha("Não foi possível carregar as contas", co.error);
  if (ca.error) throw falha("Não foi possível carregar as categorias", ca.error);
  if (fi.error) throw falha("Não foi possível carregar as contas fixas", fi.error);
  return {
    contas: (co.data ?? []) as Conta[],
    categorias: (ca.data ?? []) as Categoria[],
    fixas: (fi.data ?? []) as DespesaFixa[],
    transacoes,
  };
}

/** Grava todas as linhas de uma vez: ou entra tudo, ou nada. */
export async function inserirTransacoes(linhas: NovaTransacao[]): Promise<void> {
  const { error } = await supabaseBrowser().from("transacoes").insert(linhas);
  if (error) throw falha("Não foi possível registrar o lançamento", error);
}

export async function atualizarTransacoes(itens: AtualizacaoTransacao[]): Promise<void> {
  const db = supabaseBrowser();
  for (const it of itens) {
    const { error } = await db
      .from("transacoes")
      .update({ data: it.data, descricao: it.descricao, valor: it.valor })
      .eq("id", it.id);
    if (error) throw falha("Não foi possível salvar a edição", error);
  }
}

export async function excluirTransacoes(ids: Id[]): Promise<void> {
  const { error } = await supabaseBrowser().from("transacoes").delete().in("id", ids);
  if (error) throw falha("Não foi possível excluir", error);
}

export async function criarConta(c: {
  nome: string;
  tipo: TipoConta;
  valor: number;
  diaVencimento: number | null;
}): Promise<void> {
  const credito = c.tipo === "Crédito";
  const { error } = await supabaseBrowser()
    .from("contas")
    .insert({
      nome: c.nome,
      tipo: c.tipo,
      saldo_atual: credito ? 0 : c.valor,
      limite_total: credito ? c.valor : 0,
      dia_vencimento: credito ? c.diaVencimento : null,
    });
  if (error) throw falha("Não foi possível criar a conta", error);
}

export async function excluirConta(id: Id): Promise<void> {
  const { error } = await supabaseBrowser().from("contas").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a conta", error);
}

export async function criarFixa(f: { nome: string; valor: number; dia: number }): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("despesas_fixas")
    .insert({ nome: f.nome, valor: f.valor, dia_vencimento: f.dia });
  if (error) throw falha("Não foi possível criar a conta fixa", error);
}

export async function excluirFixa(id: Id): Promise<void> {
  const { error } = await supabaseBrowser().from("despesas_fixas").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a conta fixa", error);
}

export async function criarCategoria(c: { nome: string; tipo: TipoCategoria }): Promise<void> {
  const { error } = await supabaseBrowser().from("categorias").insert(c);
  if (error) throw falha("Não foi possível criar a categoria", error);
}

export async function excluirCategoria(id: Id): Promise<void> {
  const { error } = await supabaseBrowser().from("categorias").delete().eq("id", id);
  if (error) throw falha("Não foi possível excluir a categoria", error);
}

export async function sair(): Promise<void> {
  await supabaseBrowser().auth.signOut();
}
