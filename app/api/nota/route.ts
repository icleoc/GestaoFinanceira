import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { normalizarLeitura } from "@/lib/nota";
import { todayISO } from "@/lib/finance";
import { escolherProvedor, lerComIA } from "@/lib/leitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

// Limite simples por pessoa (por instância do servidor): evita gasto por engano ou abuso.
const usos = new Map<string, number[]>();
function dentroDoLimite(userId: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(userId) ?? []).filter((t) => agora - t < 3_600_000);
  if (recentes.length >= 40) return false;
  recentes.push(agora);
  usos.set(userId, recentes);
  return true;
}

export async function POST(req: NextRequest) {
  const provedor = escolherProvedor();
  if (!provedor) {
    return erro("A leitura automática da nota ainda não está ligada. Preencha à mão por enquanto.", 501);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return erro("Pedido inválido.", 400);
  }
  const foto = form.get("foto");
  const carteiraId = String(form.get("carteiraId") ?? "");
  if (!(foto instanceof File) || !UUID.test(carteiraId)) return erro("Pedido inválido.", 400);
  if (!TIPOS.includes(foto.type)) return erro("Use uma foto JPG, PNG ou WebP.", 400);
  if (foto.size > MAX_BYTES) return erro("A foto é grande demais (máximo 6 MB).", 413);

  let categorias: string[] = [];
  try {
    const bruto = JSON.parse(String(form.get("categorias") ?? "[]")) as unknown;
    if (Array.isArray(bruto)) {
      categorias = bruto
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 60);
    }
  } catch {
    /* sem categorias: tudo bem */
  }

  // Quem pede precisa estar logado e poder lançar nesta carteira.
  const db = await supabaseServidor();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return erro("Entre para ler a nota.", 401);
  const { data: membro } = await db
    .from("membros")
    .select("permissoes")
    .eq("carteira_id", carteiraId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membro || !(membro.permissoes as string[]).includes("lancar")) {
    return erro("Você não pode lançar nesta carteira.", 403);
  }
  if (!dentroDoLimite(auth.user.id)) {
    return erro("Muitas leituras seguidas. Espere alguns minutos ou preencha à mão.", 429);
  }

  const hoje = todayISO();
  const base64 = Buffer.from(await foto.arrayBuffer()).toString("base64");

  const r = await lerComIA(provedor, { base64, mime: foto.type, categorias, hoje });
  if (!r.ok) return erro(r.msg, r.status);
  return NextResponse.json({ dados: normalizarLeitura(r.input, categorias, hoje) });
}
