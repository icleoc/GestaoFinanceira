import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { MARCA } from "./brand";

export const NOME_DO_APP = MARCA.nome;
const COOKIE = "pk_desafio";
const VALIDADE_SEGUNDOS = 300;

/** Domínio (rpID) e endereço (origin) pelos quais a pessoa está acessando agora. */
export function origemDe(req: NextRequest): { rpID: string; origin: string } {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = req.headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

function chave(): Buffer | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update("jarvis-passkey-desafio-v1").digest();
}

export interface Desafio {
  challenge: string;
  tipo: "reg" | "ent";
  /** Quem está cadastrando (só no cadastro). */
  uid?: string;
  exp: number;
}

/** Guarda o desafio num cookie assinado, que só vale por 5 minutos e só nas rotas de passkey. */
export function guardarDesafio(res: NextResponse, req: NextRequest, d: Omit<Desafio, "exp">): boolean {
  const k = chave();
  if (!k) return false;
  const corpo = Buffer.from(JSON.stringify({ ...d, exp: Math.floor(Date.now() / 1000) + VALIDADE_SEGUNDOS })).toString("base64url");
  const assinatura = createHmac("sha256", k).update(corpo).digest("base64url");
  res.cookies.set(COOKIE, `${corpo}.${assinatura}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: origemDe(req).origin.startsWith("https"),
    path: "/api/passkey",
    maxAge: VALIDADE_SEGUNDOS,
  });
  return true;
}

/** Lê e confere o desafio guardado. Devolve null se faltar, estiver adulterado, vencido ou for de outro tipo. */
export function lerDesafio(req: NextRequest, tipo: Desafio["tipo"]): Desafio | null {
  const k = chave();
  const bruto = req.cookies.get(COOKIE)?.value;
  if (!k || !bruto) return null;
  const [corpo, assinatura] = bruto.split(".");
  if (!corpo || !assinatura) return null;
  const esperado = createHmac("sha256", k).update(corpo).digest();
  const recebido = Buffer.from(assinatura, "base64url");
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString()) as Desafio;
    if (d.tipo !== tipo || typeof d.challenge !== "string" || d.exp < Math.floor(Date.now() / 1000)) return null;
    return d;
  } catch {
    return null;
  }
}

/** O desafio vale uma vez só: depois de usado, o cookie é apagado. */
export function apagarDesafio(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/api/passkey", maxAge: 0 });
}

export function nomeSeguro(x: unknown): string {
  const t = typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return t || "Este aparelho";
}
