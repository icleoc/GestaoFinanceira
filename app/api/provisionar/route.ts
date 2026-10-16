import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cria um cliente novo: acesso de login + carteira própria (com categorias iniciais).
 * Feito para ser chamado pelo sistema de vendas depois da compra aprovada:
 *
 *   POST /api/provisionar
 *   Authorization: Bearer <PROVISION_SECRET>
 *   { "email": "cliente@exemplo.com", "nome": "Maria", "carteira": "Carteira da Maria" }
 *
 * Responde com a senha temporária, para o sistema de vendas enviar ao cliente.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.PROVISION_SECRET;
  if (!segredo || segredo.length < 24) {
    return NextResponse.json({ erro: "Provisionamento desligado: defina PROVISION_SECRET (24+ caracteres)." }, { status: 501 });
  }
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(enviado);
  const b = Buffer.from(segredo);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ erro: SEM_CHAVE_DE_SERVICO }, { status: 501 });

  const corpo = (await req.json().catch(() => null)) as { email?: string; nome?: string; carteira?: string } | null;
  const email = String(corpo?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  const senhaTemporaria = randomBytes(9).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password: senhaTemporaria, email_confirm: true });
  if (error || !data.user) {
    return NextResponse.json({ erro: `Não foi possível criar o acesso: ${error?.message ?? "erro desconhecido"}` }, { status: 400 });
  }
  const nome = String(corpo?.nome ?? "").trim().slice(0, 80);
  const { data: carteiraId, error: erroCarteira } = await admin.rpc("nova_carteira", {
    p_dono: data.user.id,
    p_nome: String(corpo?.carteira ?? "").trim().slice(0, 80) || (nome ? `Carteira de ${nome}` : "Minha carteira"),
    p_membro_nome: nome || null,
  });
  if (erroCarteira) {
    // Não deixa um acesso sem carteira para trás.
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ erro: `Não foi possível criar a carteira: ${erroCarteira.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId: data.user.id, carteiraId, email, senhaTemporaria }, { status: 201 });
}
