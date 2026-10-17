// Face ID / biometria no navegador (WebAuthn). A parte do servidor está em /api/passkey/*.

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { supabaseBrowser } from "./supabase/client";

export interface Aparelho {
  id: string;
  nome: string | null;
  criado_em: string;
  ultimo_uso: string | null;
}

/** Nome da biometria que a pessoa vai ver no aparelho dela. */
export function rotuloBiometria(): string {
  if (typeof navigator === "undefined") return "biometria";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  if (/Windows/i.test(ua)) return "Windows Hello";
  return "biometria";
}

export function nomeDoAparelho(): string {
  if (typeof navigator === "undefined") return "Este aparelho";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Este aparelho";
}

/** True se este aparelho/navegador consegue usar Face ID, digital ou similar. */
export async function biometriaDisponivel(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

function traduzir(e: unknown): string {
  const nome = (e as { name?: string })?.name;
  if (nome === "NotAllowedError" || nome === "AbortError") return "Cancelado. Nada foi alterado.";
  if (nome === "InvalidStateError") return "Este aparelho já está cadastrado.";
  if (nome === "SecurityError") return "O navegador bloqueou o Face ID neste endereço.";
  return e instanceof Error ? e.message : "Não foi possível usar o Face ID agora.";
}

async function chamar<T>(url: string, corpo: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  const json = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(json.erro ?? "Não foi possível concluir.");
  return json;
}

/** Cadastra o Face ID deste aparelho (precisa estar logado). */
export async function ativarBiometria(): Promise<void> {
  try {
    const optionsJSON = await chamar<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/passkey/registrar", { etapa: "opcoes" });
    const resposta = await startRegistration({ optionsJSON });
    await chamar("/api/passkey/registrar", { etapa: "verificar", resposta, nome: nomeDoAparelho() });
  } catch (e) {
    throw new Error(traduzir(e));
  }
}

/** Entra com o Face ID, sem digitar nada. Ao terminar, a sessão já está aberta. */
export async function entrarComBiometria(): Promise<void> {
  try {
    const optionsJSON = await chamar<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/passkey/entrar", { etapa: "opcoes" });
    const resposta = await startAuthentication({ optionsJSON });
    const { token_hash } = await chamar<{ token_hash: string }>("/api/passkey/entrar", { etapa: "verificar", resposta });
    const { error } = await supabaseBrowser().auth.verifyOtp({ token_hash, type: "magiclink" });
    if (error) throw new Error("Não foi possível iniciar a sessão. Entre com a senha.");
  } catch (e) {
    throw new Error(traduzir(e));
  }
}

export async function listarAparelhos(): Promise<Aparelho[]> {
  const r = await fetch("/api/passkey", { cache: "no-store" });
  const json = (await r.json().catch(() => ({}))) as { aparelhos?: Aparelho[]; erro?: string };
  if (!r.ok) throw new Error(json.erro ?? "Não foi possível carregar os aparelhos.");
  return json.aparelhos ?? [];
}

export async function removerAparelho(id: string): Promise<void> {
  const r = await fetch("/api/passkey", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  if (!r.ok) {
    const json = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new Error(json.erro ?? "Não foi possível remover.");
  }
}
