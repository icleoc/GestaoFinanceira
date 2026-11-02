import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gerarIcs } from "@/lib/calendario";
import { filtrarPorAviso, proximosVencimentos, DIAS_PADRAO } from "@/lib/vencimentos";
import { entradaDaCarteira, hojeEmBrasilia } from "@/lib/vencimentos-servidor";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nao = () => new NextResponse("Link inválido ou desativado.", { status: 404 });

/** Calendário de vencimentos de uma pessoa. O segredo do link é quem autoriza; não há login aqui. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await ctx.params;
  const token = bruto.replace(/\.ics$/i, "");
  if (!UUID.test(token)) return nao();
  const admin = supabaseAdmin();
  if (!admin) return new NextResponse("Servidor sem chave de serviço.", { status: 501 });

  const { data: aviso } = await admin.from("avisos").select("carteira_id, user_id, ativo, dias, contas").eq("token", token).maybeSingle();
  if (!aviso || !aviso.ativo) return nao();
  // Quem saiu da carteira deixa de receber.
  const { data: membro } = await admin.from("membros").select("user_id").eq("carteira_id", aviso.carteira_id).eq("user_id", aviso.user_id).maybeSingle();
  if (!membro) return nao();

  const hoje = hojeEmBrasilia();
  const [{ data: carteira }, entrada] = await Promise.all([
    admin.from("carteiras").select("nome").eq("id", aviso.carteira_id).maybeSingle(),
    entradaDaCarteira(admin, aviso.carteira_id as string, hoje),
  ]);

  const todos = proximosVencimentos(entrada, hoje, 365);
  const itens = filtrarPorAviso(todos, { ativo: true, contas: aviso.contas as string[] | null });
  const ics = gerarIcs({
    calendario: `Vencimentos · ${carteira?.nome ?? "Jarvis Finance"}`,
    itens,
    dias: (aviso.dias as number[] | null)?.length ? (aviso.dias as number[]) : DIAS_PADRAO,
  });
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="vencimentos.ics"', "Cache-Control": "no-store" },
  });
}
