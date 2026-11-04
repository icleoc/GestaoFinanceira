import "server-only";
import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Permissao } from "@/lib/types";

export const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Quem {
  userId: string;
  papel: string;
  permissoes: Permissao[];
}

/** Confere que quem pede está logado, é da carteira e pode gerenciar pessoas. */
export async function autorizar(carteiraId: unknown): Promise<{ quem: Quem } | { resposta: NextResponse }> {
  if (typeof carteiraId !== "string" || !UUID.test(carteiraId)) return { resposta: erro("Carteira inválida.", 400) };
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return { resposta: erro("Entre para continuar.", 401) };
  const { data: linha } = await db
    .from("membros")
    .select("papel, permissoes")
    .eq("carteira_id", carteiraId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!linha || !(linha.permissoes as Permissao[]).includes("equipe")) {
    return { resposta: erro("Você não pode gerenciar pessoas nesta carteira.", 403) };
  }
  return { quem: { userId: data.user.id, papel: linha.papel, permissoes: linha.permissoes as Permissao[] } };
}

/** Só dá para conceder o que você mesmo tem. */
export function limitar(pedidas: Permissao[], quem: Quem): Permissao[] {
  return pedidas.filter((p) => quem.permissoes.includes(p));
}


export async function acharUsuarioPorEmail(admin: SupabaseClient, email: string) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 200) return null;
  }
  return null;
}

