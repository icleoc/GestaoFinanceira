import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

async function quemPede() {
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  return data.user;
}

/** Lista os aparelhos com Face ID/biometria cadastrados pela pessoa logada. */
export async function GET() {
  const user = await quemPede();
  if (!user) return erro("Entre para continuar.", 401);
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const { data, error } = await admin
    .from("passkeys")
    .select("id, nome, criado_em, ultimo_uso")
    .eq("user_id", user.id)
    .order("criado_em");
  if (error) return erro("Não foi possível carregar os aparelhos.", 500);
  return NextResponse.json({ aparelhos: data ?? [] });
}

/** Remove um aparelho (só os da própria pessoa). */
export async function DELETE(req: NextRequest) {
  const user = await quemPede();
  if (!user) return erro("Entre para continuar.", 401);
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const corpo = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof corpo?.id !== "string" || corpo.id.length > 600) return erro("Aparelho inválido.", 400);
  const { error } = await admin.from("passkeys").delete().eq("id", corpo.id).eq("user_id", user.id);
  if (error) return erro("Não foi possível remover.", 500);
  return NextResponse.json({ ok: true });
}
