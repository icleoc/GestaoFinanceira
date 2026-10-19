import { NextResponse } from "next/server";
import { estadoDaChaveAnthropic, estadoDaChaveGemini } from "@/lib/ambiente";

export const dynamic = "force-dynamic";

/** Diz só se cada configuração chegou ao servidor. Nunca mostra valores. */
export function GET() {
  return NextResponse.json(
    {
      leituraDeNota: estadoDaChaveGemini() === "ok" ? "ok (Gemini)" : estadoDaChaveAnthropic() === "ok" ? "ok (Anthropic)" : "ausente",
      faceId: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY ? "ok" : "ausente",
      criacaoDeClientes: (process.env.PROVISION_SECRET ?? "").length >= 24 ? "ok" : "ausente",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
