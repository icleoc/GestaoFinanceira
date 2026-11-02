import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let pronto = false;
/** Liga o envio de notificações. Falso se as chaves ainda não foram cadastradas no servidor. */
export function pushConfigurado(): boolean {
  if (pronto) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@leonardorodrigues.site", pub, priv);
  pronto = true;
  return true;
}

export interface Notificacao {
  titulo: string;
  corpo: string;
  url?: string;
}

/** Manda a notificação para todos os aparelhos da pessoa. Devolve quantos receberam. Remove os que não existem mais. */
export async function enviarPush(admin: SupabaseClient, userId: string, n: Notificacao): Promise<number> {
  if (!pushConfigurado()) return 0;
  const { data } = await admin.from("push_inscricoes").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let enviados = 0;
  const mortos: string[] = [];
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          JSON.stringify({ titulo: n.titulo, corpo: n.corpo, url: n.url ?? "/app" }),
          { TTL: 60 * 60 * 12 },
        );
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) mortos.push(s.id as string);
      }
    }),
  );
  if (mortos.length) await admin.from("push_inscricoes").delete().in("id", mortos);
  return enviados;
}
