import { NextResponse, type NextRequest } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { NOME_DO_APP, apagarDesafio, guardarDesafio, lerDesafio, nomeSeguro, origemDe } from "@/lib/passkey-servidor";

export const dynamic = "force-dynamic";

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

/**
 * Cadastra o Face ID / biometria deste aparelho. Precisa estar logado.
 * Duas etapas: "opcoes" (gera o desafio) e "verificar" (confere a resposta do aparelho).
 */
export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as { etapa?: string; resposta?: unknown; nome?: unknown } | null;
  if (!corpo) return erro("Pedido inválido.", 400);

  const db = await supabaseServidor();
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) return erro("Entre com a senha para ativar o Face ID.", 401);
  const admin = supabaseAdmin();
  if (!admin) return erro(SEM_CHAVE_DE_SERVICO, 501);
  const { rpID, origin } = origemDe(req);

  if (corpo.etapa === "opcoes") {
    const { data: existentes } = await admin.from("passkeys").select("id, transports").eq("user_id", user.id);
    const opcoes = await generateRegistrationOptions({
      rpName: NOME_DO_APP,
      rpID,
      userName: user.email ?? user.id,
      userDisplayName: user.email ?? "Jarvis Finance",
      userID: new TextEncoder().encode(user.id),
      attestationType: "none",
      excludeCredentials: (existentes ?? []).map((p) => ({ id: p.id as string, transports: (p.transports as string[] | null) ?? undefined })),
      // Biometria do próprio aparelho (Face ID, Touch ID), com chave que permite entrar sem digitar e-mail.
      authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    });
    const res = NextResponse.json(opcoes);
    if (!guardarDesafio(res, req, { challenge: opcoes.challenge, tipo: "reg", uid: user.id })) return erro(SEM_CHAVE_DE_SERVICO, 501);
    return res;
  }

  if (corpo.etapa === "verificar") {
    const desafio = lerDesafio(req, "reg");
    if (!desafio || desafio.uid !== user.id) return erro("O pedido expirou. Toque em ativar de novo.", 400);
    let verificacao;
    try {
      verificacao = await verifyRegistrationResponse({
        response: corpo.resposta as RegistrationResponseJSON,
        expectedChallenge: desafio.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      return erro("Não foi possível confirmar o Face ID deste aparelho.", 400);
    }
    if (!verificacao.verified || !verificacao.registrationInfo) return erro("Não foi possível confirmar o Face ID deste aparelho.", 400);
    const { credential } = verificacao.registrationInfo;
    const { error } = await admin.from("passkeys").insert({
      id: credential.id,
      user_id: user.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      nome: nomeSeguro(corpo.nome),
    });
    if (error) return erro(error.code === "23505" ? "Este aparelho já está cadastrado." : "Não foi possível salvar o Face ID.", 400);
    const res = NextResponse.json({ ok: true });
    apagarDesafio(res);
    return res;
  }

  return erro("Pedido inválido.", 400);
}
