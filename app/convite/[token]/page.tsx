"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ROTULO_PERMISSAO, nomeDoPapel } from "@/lib/permissoes";
import type { Papel, Permissao } from "@/lib/types";

interface Info {
  carteira: string;
  nome: string | null;
  email: string | null;
  permissoes: Permissao[];
  papel: Papel;
  logadoComo: string | null;
}

/** Página aberta pelo link de convite: a pessoa vê o acesso que vai ter e escolhe nome e senha. */
export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [problema, setProblema] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [jaTemConta, setJaTemConta] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/convite/${token}`);
        const j = (await r.json().catch(() => ({}))) as Partial<Info> & { erro?: string };
        if (!vivo) return;
        if (!r.ok) return setProblema(j.erro ?? "Convite inválido.");
        const dados = j as Info;
        setInfo(dados);
        setNome(dados.nome ?? "");
        setEmail(dados.email ?? "");
      } catch {
        if (vivo) setProblema("Sem conexão com o servidor. Tente de novo.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  async function aceitar(e: React.FormEvent, modo?: "logado") {
    e.preventDefault();
    setErro("");
    setJaTemConta(false);
    setEnviando(true);
    try {
      const r = await fetch(`/api/convite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modo ? { modo } : { nome, email, senha }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; email?: string };
      if (!r.ok) {
        if (r.status === 409) setJaTemConta(true);
        setErro(j.erro ?? "Não foi possível aceitar o convite.");
        return;
      }
      if (!modo) {
        const { error } = await supabaseBrowser().auth.signInWithPassword({ email: (j.email ?? email).trim(), password: senha });
        if (error) {
          setErro("Acesso criado, mas não consegui entrar sozinho. Use a tela de login com o seu e-mail e a senha que você escolheu.");
          return;
        }
      }
      router.replace("/app");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12 sm:px-14">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-8 inline-block" aria-label="Página inicial">
          <Logo tamanho={42} />
        </Link>

        {problema ? (
          <div role="alert">
            <h1 className="font-display text-3xl" style={{ letterSpacing: "-0.03em" }}>
              Convite indisponível
            </h1>
            <p className="mt-3 text-muted">{problema}</p>
            <Link href="/login" className="btn btn-quiet mt-6 inline-flex">
              Ir para o login
            </Link>
          </div>
        ) : !info ? (
          <p className="text-muted">Abrindo o convite…</p>
        ) : (
          <>
            <h1 className="font-display text-3xl" style={{ letterSpacing: "-0.03em" }}>
              Você foi convidado
            </h1>
            <p className="mt-2 text-muted">
              Para acompanhar a carteira <b className="text-ink">{info.carteira}</b> como <b className="text-ink">{nomeDoPapel(info.papel)}</b>.
            </p>
            <p className="mt-2 text-sm text-muted">{info.permissoes.map((p) => ROTULO_PERMISSAO[p].nome).join(" · ")}</p>

            {info.logadoComo && (
              <div className="panel mt-6 p-4">
                <p className="text-sm">
                  Você está logado como <b>{info.logadoComo}</b>.
                </p>
                <button onClick={(e) => void aceitar(e, "logado")} disabled={enviando} className="btn btn-primary mt-3 w-full py-3">
                  {enviando ? "Entrando…" : "Aceitar com esta conta"}
                </button>
                <p className="mt-3 text-center text-xs uppercase tracking-widest text-muted">ou crie um acesso novo</p>
              </div>
            )}

            <form onSubmit={(e) => void aceitar(e)} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="c-nome" className="label">
                  Seu nome
                </label>
                <input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" autoComplete="name" />
              </div>
              <div>
                <label htmlFor="c-email" className="label">
                  E-mail
                </label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                  autoComplete="email"
                  readOnly={!!info.email}
                />
              </div>
              <div>
                <label htmlFor="c-senha" className="label">
                  Crie uma senha (mínimo 8 caracteres)
                </label>
                <input id="c-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="field" autoComplete="new-password" />
              </div>
              {erro && (
                <p role="alert" className="text-sm font-medium text-neg">
                  {erro}
                </p>
              )}
              {jaTemConta && (
                <Link href={`/login?next=/convite/${token}`} className="btn btn-quiet inline-flex">
                  Entrar com minha conta
                </Link>
              )}
              <button type="submit" disabled={enviando} className="btn btn-primary w-full py-3.5 text-base">
                {enviando ? "Criando acesso…" : "Criar acesso e entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
