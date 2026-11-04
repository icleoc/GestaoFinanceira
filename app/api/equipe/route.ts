import { NextResponse, type NextRequest } from "next/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { papelDe, permissoesValidas, TODAS_PERMISSOES } from "@/lib/permissoes";
import type { Permissao } from "@/lib/types";
import { acharUsuarioPorEmail, autorizar, erro, limitar, UUID } from "@/lib/equipe-servidor";

export const dynamic = "force-dynamic";

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
