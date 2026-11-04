import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarPush, pushConfigurado } from "@/lib/push-servidor";
import { entradaDaCarteira, hojeEmBrasilia } from "@/lib/vencimentos-servidor";
import { filtrarPorAviso, proximosVencimentos, quandoVence, DIAS_PADRAO } from "@/lib/vencimentos";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Roda uma vez por dia (Vercel Cron, 8h em Brasília). Para cada pessoa com avisos ligados, junta as contas que
 * vencem exatamente nos dias escolhidos (7, 4, 1 dia antes e no dia, por padrão) e manda uma notificação ao celular.
 * Protegida pelo segredo CRON_SECRET (a Vercel envia sozinha no cabeçalho).
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado.", { status: 401 });
  const admin = supabaseAdmin();
  if (!admin || !pushConfigurado()) return NextResponse.json({ erro: "Avisos no celular ainda não estão configurados." }, { status: 501 });

  const hoje = hojeEmBrasilia();
  const { data: avisos } = await admin.from("avisos").select("carteira_id, user_id, dias, contas").eq("ativo", true);
  const cache = new Map<string, Awaited<ReturnType<typeof entradaDaCarteira>>>();
  let pessoas = 0;
  let notificacoes = 0;

  for (const a of avisos ?? []) {
    const { data: membro } = await admin.from("membros").select("user_id").eq("carteira_id", a.carteira_id).eq("user_id", a.user_id).maybeSingle();
    if (!membro) continue;
    let entrada = cache.get(a.carteira_id as string);
    if (!entrada) {
      entrada = await entradaDaCarteira(admin, a.carteira_id as string, hoje);
      cache.set(a.carteira_id as string, entrada);
    }
    const dias = (a.dias as number[] | null)?.length ? (a.dias as number[]) : DIAS_PADRAO;
    const meus = filtrarPorAviso(proximosVencimentos(entrada, hoje, Math.max(...dias)), { ativo: true, contas: a.contas as string[] | null }, a.user_id as string).filter((v) => dias.includes(v.dias));
    if (meus.length === 0) continue;
    pessoas++;
    const linhas = meus.map((v) => `${v.indice ? `${v.nome} ${v.indice}/${v.total}` : v.nome} ${quandoVence(v.dias)} (${money(v.valor)})`);
    const titulo = meus.length === 1 ? "Conta a vencer" : `${meus.length} contas a vencer`;
    notificacoes += await enviarPush(admin, a.user_id as string, { titulo, corpo: linhas.join("\n"), url: "/app" });
  }
  return NextResponse.json({ ok: true, hoje, pessoas, notificacoes });
}
