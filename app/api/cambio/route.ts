import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { MOEDAS_ESTRANGEIRAS } from "@/lib/cambio";
import { todayISO } from "@/lib/finance";

export const dynamic = "force-dynamic";

/**
 * Cotação de uma moeda em reais, no dia pedido.
 * Fonte: Frankfurter (taxas do Banco Central Europeu). Fim de semana e feriado
 * usam o último dia com cotação. Só responde para quem está logado.
 */
export async function GET(req: NextRequest) {
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ erro: "Entre para consultar a cotação." }, { status: 401 });

  const moeda = (req.nextUrl.searchParams.get("moeda") ?? "").toUpperCase();
  let dia = req.nextUrl.searchParams.get("data") ?? "";
  if (!MOEDAS_ESTRANGEIRAS.some((m) => m.codigo === moeda)) {
    return NextResponse.json({ erro: "Moeda não suportada." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(dia))) {
    return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
  }
  // Data no futuro: usa a cotação mais recente.
  if (dia > todayISO()) dia = "latest";

  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${dia}?base=${moeda}&symbols=BRL`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const json = (await r.json()) as { date?: string; rates?: { BRL?: number } };
    const taxa = json.rates?.BRL;
    if (!taxa || !json.date) throw new Error("resposta sem cotação");
    return NextResponse.json({ taxa, dataCotacao: json.date, fonte: "Banco Central Europeu (Frankfurter)" });
  } catch {
    return NextResponse.json(
      { erro: "Não consegui buscar a cotação agora. Você pode digitar a cotação manualmente." },
      { status: 502 },
    );
  }
}
