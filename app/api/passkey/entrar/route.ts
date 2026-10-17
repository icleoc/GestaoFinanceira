import { NextResponse, type NextRequest } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { SEM_CHAVE_DE_SERVICO, supabaseAdmin } from "@/lib/supabase/admin";
import { apagarDesafio, guardarDesafio, lerDesafio, origemDe } from "@/lib/passkey-servidor";

export const dynamic = "force-dynamic";

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

/**
 * Entrada com Face ID / biometria, sem digitar nada. Não exige login (é o próprio login).
 * "opcoes": gera o desafio. "verificar": confere a assinatura do aparelho e devolve um
 * código de uso único que o navegador troca por uma sessão normal do Supabase.
 */
export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as { etapa?: string; resposta?: unknown } | null;
  if (!corpo) return erro("Pedido inválido.", 400);
  const admin = supabaseAdmin();
  if (!admin) return erro("Entrar com Face ID ainda não está ligado neste servidor.", 501);
  const { rpID, origin } = origemDe(req);

  if (corpo.etapa === "opcoes") {
    const opcoes = await generateAuthenticationOptions({ rpID, userVerification: "required" });
    const res = NextResponse.json(opcoes);
    if (!guardarDesafio(res, req, { challenge: opcoes.challenge, tipo: "ent" })) return erro(SEM_CHAVE_DE_SERVICO, 501);
    return res;
  }

  if (corpo.etapa === "verificar") {
    const desafio = lerDesafio(req, "ent");
    if (!desafio) return erro("O pedido expirou. Toque em entrar de novo.", 400);
    const resposta = corpo.resposta as AuthenticationResponseJSON | undefined;
    if (!resposta || typeof resposta.id !== "string" || resposta.id.length > 600) return erro("Pedido inválido.", 400);

    const { data: pk } = await admin.from("passkeys").select("*").eq("id", resposta.id).maybeSingle();
    if (!pk) return erro("Este aparelho não tem Face ID cadastrado. Entre com a senha e ative em Minha conta.", 401);

    let verificacao;
    try {
      verificacao = await verifyAuthenticationResponse({
        response: resposta,
        expectedChallenge: desafio.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: pk.id as string,
          publicKey: new Uint8Array(Buffer.from(pk.public_key as string, "base64url")),
          counter: Number(pk.counter),
          transports: (pk.transports as string[] | null) ?? undefined,
        },
      });
    } catch {
      return erro("Não foi possível confirmar o seu Face ID.", 401);
    }
    if (!verificacao.verified) return erro("Não foi possível confirmar o seu Face ID.", 401);

    // A chave do aparelho tem que ser da pessoa dona do cadastro.
    const dono = resposta.response.userHandle ? Buffer.from(resposta.response.userHandle, "base64url").toString() : null;
    if (dono && dono !== pk.user_id) return erro("Não foi possível confirmar o seu Face ID.", 401);

    await admin
      .from("passkeys")
      .update({ counter: verificacao.authenticationInfo.newCounter, ultimo_uso: new Date().toISOString() })
      .eq("id", pk.id as string);

    const { data: usuario } = await admin.auth.admin.getUserById(pk.user_id as string);
    const email = usuario.user?.email;
    if (!email) return erro("Não foi possível entrar com este acesso.", 401);
    const { data: link, error: erroLink } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const token = link?.properties?.hashed_token;
    if (erroLink || !token) return erro("Não foi possível iniciar a sessão. Entre com a senha.", 500);

    const res = NextResponse.json({ token_hash: token });
    apagarDesafio(res);
    return res;
  }

  return erro("Pedido inválido.", 400);
}
