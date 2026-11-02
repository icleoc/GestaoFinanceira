import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DespesaFixa, Divida, Transacao } from "./types";

/** Tudo o que a agenda de vencimentos precisa de uma carteira, lido com a chave de serviço. */
export async function entradaDaCarteira(admin: SupabaseClient, carteiraId: string, hoje: string) {
  const mes = hoje.slice(0, 7);
  const [{ data: fixas }, { data: dividas }, { data: transacoes }] = await Promise.all([
    admin.from("despesas_fixas").select("*").eq("carteira_id", carteiraId),
    admin.from("dividas").select("*").eq("carteira_id", carteiraId),
    admin.from("transacoes").select("id, data, descricao, valor").eq("carteira_id", carteiraId).gte("data", `${mes}-01`).lt("valor", 0),
  ]);
  return {
    fixas: (fixas ?? []) as DespesaFixa[],
    dividas: (dividas ?? []) as Divida[],
    transacoes: (transacoes ?? []) as unknown as Transacao[],
  };
}

/** Data de hoje no horário de Brasília. */
export function hojeEmBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
