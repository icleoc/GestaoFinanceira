import { NextResponse, type NextRequest } from "next/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/server";
import { papelDe } from "@/lib/permissoes";
import { acharUsuarioPorEmail, erro, UUID } from "@/lib/equipe-servidor";
import type { Permissao } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

async function achar(token: string) {
  const admin = supabaseAdmin();
  if (!admin) return { admin: null, convite: null } as const;
  const { data } = await admin
    .from("convites")
    .select("id, carteira_id, nome, email, permissoes, expira_em, usado_em")
    .eq("token", token)
    .maybeSingle();
  return { admin, convite: data } as const;
}

const motivoInvalido = (c: { expira_em: string; usado_em: string | null } | null) =>
  !c ? "Convite não encontrado." : c.usado_em ? "Este convite já foi usado." : new Date(c.expira_em) < new Date() ? "Este convite venceu. Peça um novo." : null;

/** O que a pessoa vê antes de aceitar: de quem é a carteira e o acesso que vai receber. */
export async function GET(_req: NextRequest, ctx: Params) {
  const { token } = await ctx.params;
  if (!UUID.test(token)) return erro("Convite inválido.", 404);
  const { admin, convite } = await achar(token);
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const invalido = motivoInvalido(convite);
  if (invalido || !convite) return erro(invalido ?? "Convite inválido.", 410);
  const { data: carteira } = await admin.from("carteiras").select("nome").eq("id", convite.carteira_id).maybeSingle();
  const db = await supabaseServidor();
  const { data: sessao } = await db.auth.getUser();
  return NextResponse.json({
    carteira: carteira?.nome ?? "Carteira",
    nome: convite.nome,
    email: convite.email,
    permissoes: convite.permissoes,
    papel: papelDe(convite.permissoes as Permissao[]),
    logadoComo: sessao.user?.email ?? null,
  });
}

/**
 * Aceita o convite. Sem login: cria o acesso com nome, e-mail e senha escolhidos pela pessoa.
 * Com login (modo "logado"): coloca na carteira a conta que já está aberta.
 */
export async function POST(req: NextRequest, ctx: Params) {
  const { token } = await ctx.params;
  if (!UUID.test(token)) return erro("Convite inválido.", 404);
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const { admin, convite } = await achar(token);
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const invalido = motivoInvalido(convite);
  if (invalido || !convite) return erro(invalido ?? "Convite inválido.", 410);

  const nome = String(corpo.nome ?? "").trim().slice(0, 80);
  let userId: string;
  let email: string;
  let criou = false;

  if (corpo.modo === "logado") {
    const db = await supabaseServidor();
    const { data } = await db.auth.getUser();
    if (!data.user?.email) return erro("Entre na sua conta para aceitar.", 401);
    userId = data.user.id;
    email = data.user.email.toLowerCase();
    if (convite.email && convite.email.toLowerCase() !== email) return erro(`Este convite é para ${convite.email}.`, 403);
  } else {
    email = String(corpo.email ?? "").trim().toLowerCase();
    const senha = String(corpo.senha ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("Informe um e-mail válido.", 400);
    if (convite.email && convite.email.toLowerCase() !== email) return erro(`Este convite é para ${convite.email}.`, 403);
    if (nome.length < 2) return erro("Informe seu nome.", 400);
    if (senha.length < 8) return erro("A senha precisa ter pelo menos 8 caracteres.", 400);
    if (await acharUsuarioPorEmail(admin, email)) {
      return erro("Este e-mail já tem cadastro. Entre com ele e abra o convite de novo para aceitar.", 409);
    }
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) return erro(`Não foi possível criar o acesso: ${error?.message ?? "erro desconhecido"}`, 400);
    userId = data.user.id;
    criou = true;
  }

  // Marca como usado antes de entrar: um convite vale uma vez só.
  const { data: reservado } = await admin
    .from("convites")
    .update({ usado_em: new Date().toISOString() })
    .eq("id", convite.id)
    .is("usado_em", null)
    .select("id");
  if (!reservado || reservado.length === 0) {
    if (criou) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return erro("Este convite já foi usado.", 410);
  }

  const permissoes = convite.permissoes as Permissao[];
  const { error } = await admin.from("membros").insert({
    carteira_id: convite.carteira_id,
    user_id: userId,
    nome: nome || convite.nome || email.split("@")[0],
    email,
    papel: papelDe(permissoes),
    permissoes,
  });
  if (error) {
    await admin.from("convites").update({ usado_em: null }).eq("id", convite.id);
    if (criou) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return erro(error.code === "23505" ? "Você já faz parte desta carteira." : `Não foi possível entrar na carteira: ${error.message}`, 400);
  }
  return NextResponse.json({ ok: true, email, criou });
}
