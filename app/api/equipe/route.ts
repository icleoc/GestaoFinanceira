import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { papelDe, permissoesValidas, TODAS_PERMISSOES } from "@/lib/permissoes";
import type { Permissao } from "@/lib/types";

export const dynamic = "force-dynamic";

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Quem {
  userId: string;
  papel: string;
  permissoes: Permissao[];
}

/** Confere que quem pede está logado, é da carteira e pode gerenciar pessoas. */
async function autorizar(carteiraId: unknown): Promise<{ quem: Quem } | { resposta: NextResponse }> {
  if (typeof carteiraId !== "string" || !UUID.test(carteiraId)) return { resposta: erro("Carteira inválida.", 400) };
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return { resposta: erro("Entre para continuar.", 401) };
  const { data: linha } = await db
    .from("membros")
    .select("papel, permissoes")
    .eq("carteira_id", carteiraId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!linha || !(linha.permissoes as Permissao[]).includes("equipe")) {
    return { resposta: erro("Você não pode gerenciar pessoas nesta carteira.", 403) };
  }
  return { quem: { userId: data.user.id, papel: linha.papel, permissoes: linha.permissoes as Permissao[] } };
}

/** Só dá para conceder o que você mesmo tem. */
function limitar(pedidas: Permissao[], quem: Quem): Permissao[] {
  return pedidas.filter((p) => quem.permissoes.includes(p));
}

async function acharUsuarioPorEmail(admin: NonNullable<ReturnType<typeof supabaseAdmin>>, email: string) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const aut = await autorizar(corpo.carteiraId);
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);

  const email = String(corpo.email ?? "").trim().toLowerCase();
  const nome = String(corpo.nome ?? "").trim().slice(0, 80);
  const senha = String(corpo.senha ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("Informe um e-mail válido.", 400);
  const permissoes = limitar(permissoesValidas(corpo.permissoes), aut.quem);
  if (!permissoes.includes("ver")) permissoes.unshift("ver");

  let usuario = await acharUsuarioPorEmail(admin, email);
  let senhaTemporaria: string | undefined;
  if (!usuario) {
    if (senha.length < 8) return erro("A senha precisa ter pelo menos 8 caracteres.", 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) return erro(`Não foi possível criar o acesso: ${error?.message ?? "erro desconhecido"}`, 400);
    usuario = data.user;
    senhaTemporaria = senha;
  }

  const { error } = await admin.from("membros").insert({
    carteira_id: corpo.carteiraId,
    user_id: usuario.id,
    nome: nome || email.split("@")[0],
    email,
    papel: papelDe(permissoes),
    permissoes,
  });
  if (error) {
    return erro(error.code === "23505" ? "Essa pessoa já faz parte da carteira." : `Não foi possível adicionar: ${error.message}`, 400);
  }
  return NextResponse.json({ ok: true, senhaTemporaria });
}

export async function PATCH(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const aut = await autorizar(corpo.carteiraId);
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);

  const userId = String(corpo.userId ?? "");
  if (!UUID.test(userId)) return erro("Pessoa inválida.", 400);
  const { data: alvo } = await admin
    .from("membros")
    .select("papel, permissoes")
    .eq("carteira_id", corpo.carteiraId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!alvo) return erro("Essa pessoa não está na carteira.", 404);
  if (alvo.papel === "dono") return erro("As permissões do dono não podem ser alteradas.", 403);
  if (userId === aut.quem.userId) return erro("Você não pode mudar as suas próprias permissões.", 403);
  // Quem gerencia pessoas só mexe em quem não gerencia, a não ser que seja o dono.
  if (aut.quem.papel !== "dono" && (alvo.permissoes as Permissao[]).includes("equipe")) {
    return erro("Só o dono altera quem também gerencia pessoas.", 403);
  }

  let permissoes = permissoesValidas(corpo.permissoes);
  if (aut.quem.papel !== "dono") permissoes = limitar(permissoes, aut.quem);
  if (!permissoes.includes("ver")) permissoes.unshift("ver");
  const { error } = await admin
    .from("membros")
    .update({ permissoes, papel: papelDe(permissoes) })
    .eq("carteira_id", corpo.carteiraId)
    .eq("user_id", userId);
  if (error) return erro(`Não foi possível salvar: ${error.message}`, 400);
  return NextResponse.json({ ok: true, validas: TODAS_PERMISSOES.length });
}

export async function DELETE(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const aut = await autorizar(corpo.carteiraId);
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);

  const userId = String(corpo.userId ?? "");
  if (!UUID.test(userId)) return erro("Pessoa inválida.", 400);
  if (userId === aut.quem.userId) return erro("Você não pode remover a si mesmo.", 403);
  const { data: alvo } = await admin
    .from("membros")
    .select("papel, permissoes")
    .eq("carteira_id", corpo.carteiraId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!alvo) return erro("Essa pessoa não está na carteira.", 404);
  if (alvo.papel === "dono") return erro("O dono não pode ser removido.", 403);
  if (aut.quem.papel !== "dono" && (alvo.permissoes as Permissao[]).includes("equipe")) {
    return erro("Só o dono remove quem também gerencia pessoas.", 403);
  }
  const { error } = await admin.from("membros").delete().eq("carteira_id", corpo.carteiraId).eq("user_id", userId);
  if (error) return erro(`Não foi possível remover: ${error.message}`, 400);
  return NextResponse.json({ ok: true });
}
