import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarPush, pushConfigurado } from "@/lib/push-servidor";

export const dynamic = "force-dynamic";

/** Manda uma notificação de teste para os aparelhos de quem está logado. */
export async function POST() {
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ erro: "Entre para continuar." }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin || !pushConfigurado()) return NextResponse.json({ erro: "O servidor ainda não está configurado para notificações." }, { status: 501 });
  const n = await enviarPush(admin, data.user.id, { titulo: "Jarvis Finance", corpo: "Pronto! Os avisos de vencimento vão chegar assim, neste aparelho." });
  if (n === 0) return NextResponse.json({ erro: "Nenhum aparelho seu está cadastrado para receber avisos. Toque em “Ativar neste aparelho”." }, { status: 404 });
  return NextResponse.json({ enviados: n });
}
