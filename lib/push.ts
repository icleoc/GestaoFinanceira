// Notificações no celular (Web Push). O aparelho se inscreve uma vez; o servidor manda os avisos todo dia às 8h.

import { supabaseBrowser } from "./supabase/client";

const CHAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type EstadoPush = "indisponivel" | "sem-chave" | "negado" | "desligado" | "ligado";

function paraBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const saida = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) saida[i] = bin.charCodeAt(i);
  return saida;
}

export function ehIphoneSemApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const instalado = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "indisponivel";
  if (!CHAVE) return "sem-chave";
  if (Notification.permission === "denied") return "negado";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "ligado" : "desligado";
  } catch {
    return "desligado";
  }
}

export async function ativarPush(): Promise<void> {
  if (!CHAVE) throw new Error("As notificações ainda não estão configuradas no servidor.");
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Você não permitiu as notificações. Libere nas configurações do navegador e tente de novo.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(CHAVE) });
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("O navegador não devolveu os dados da inscrição.");
  const db = supabaseBrowser();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("Entre para continuar.");
  const { error } = await db
    .from("push_inscricoes")
    .upsert({ user_id: auth.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparelho: nomeCurto() }, { onConflict: "endpoint" });
  if (error) throw new Error(/push_inscricoes|schema cache|does not exist/i.test(error.message) ? "Os avisos no celular precisam da atualização 006 do banco." : `Não foi possível salvar: ${error.message}`);
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabaseBrowser().from("push_inscricoes").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function enviarTeste(): Promise<void> {
  const r = await fetch("/api/push/teste", { method: "POST" });
  const j = (await r.json().catch(() => ({}))) as { erro?: string };
  if (!r.ok) throw new Error(j.erro ?? "Não foi possível enviar o teste.");
}

function nomeCurto(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  return "Aparelho";
}
