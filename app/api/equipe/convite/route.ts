import { NextResponse, type NextRequest } from "next/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { papelDe, permissoesValidas } from "@/lib/permissoes";
import { autorizar, erro, limitar, UUID } from "@/lib/equipe-servidor";

export const dynamic = "force-dynamic";

/** Convites ainda abertos desta carteira (quem gerencia pessoas vê). */
export async function GET(req: NextRequest) {
  const aut = await autorizar(req.nextUrl.searchParams.get("carteiraId"));
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const { data, error } = await admin
    .from("convites")
    .select("id, token, nome, email, permissoes, criado_em, expira_em")
    .eq("carteira_id", req.nextUrl.searchParams.get("carteiraId"))
    .is("usado_em", null)
    .gt("expira_em", new Date().toISOString())
    .order("criado_em", { ascending: false });
  if (error) return erro(`Não foi possível listar: ${error.message}`, 400);
  return NextResponse.json({ convites: data ?? [] });
}

/** Cria um convite: a pessoa abre o link, escolhe nome e senha e entra com o acesso definido aqui. */
export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const aut = await autorizar(corpo.carteiraId);
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);

  const email = String(corpo.email ?? "").trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("E-mail inválido.", 400);
  const nome = String(corpo.nome ?? "").trim().slice(0, 80);
  const permissoes = limitar(permissoesValidas(corpo.permissoes), aut.quem);
  if (!permissoes.includes("ver")) permissoes.unshift("ver");

  const { data, error } = await admin
    .from("convites")
    .insert({ carteira_id: corpo.carteiraId, nome: nome || null, email: email || null, permissoes, criado_por: aut.quem.userId })
    .select("token, expira_em")
    .single();
  if (error || !data) return erro(`Não foi possível criar o convite: ${error?.message ?? "erro desconhecido"}`, 400);
  return NextResponse.json({ ok: true, token: data.token, expiraEm: data.expira_em, papel: papelDe(permissoes) });
}

/** Cancela um convite que ainda não foi usado. */
export async function DELETE(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const aut = await autorizar(corpo.carteiraId);
  if ("resposta" in aut) return aut.resposta;
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const token = String(corpo.token ?? "");
  if (!UUID.test(token)) return erro("Convite inválido.", 400);
  const { error } = await admin.from("convites").delete().eq("token", token).eq("carteira_id", corpo.carteiraId).is("usado_em", null);
  if (error) return erro(`Não foi possível cancelar: ${error.message}`, 400);
  return NextResponse.json({ ok: true });
}
