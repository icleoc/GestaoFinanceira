"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, supabaseConfigurado } from "@/lib/supabase/client";
import Link from "next/link";
import Logo from "@/components/Logo";
import Guilloche from "@/components/Guilloche";

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme o e-mail pelo link que o Supabase enviou.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet.";
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setErro(traduzErro(error.message));
      setEnviando(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="tinta relative hidden overflow-hidden text-paper lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Guilloche className="pointer-events-none absolute -bottom-48 -left-32 w-[44rem] max-w-none text-gold opacity-[0.14]" />
        <Link href="/" className="relative w-fit" aria-label="Voltar à página inicial">
          <Logo tom="claro" tamanho={46} />
        </Link>
        <p className="font-display relative max-w-md text-5xl leading-[1.05]" style={{ letterSpacing: "-0.03em" }}>
          O seu patrimônio de verdade, num só lugar.
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden" aria-label="Voltar à página inicial">
            <Logo tamanho={42} />
          </Link>
          <h1 className="font-display text-4xl" style={{ letterSpacing: "-0.03em" }}>
            Entrar
          </h1>
          <p className="mt-2 text-muted">Veja suas contas e lance movimentações.</p>

          {!supabaseConfigurado ? (
            <div className="panel mt-8 border-warn/40 p-4 text-sm" role="alert">
              <p className="font-semibold text-warn">Falta configurar o Supabase.</p>
              <p className="mt-1 text-muted">
                Cadastre <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> nas variáveis de
                ambiente do Vercel (ou em <code>.env.local</code>) e publique de novo.
              </p>
            </div>
          ) : (
            <form onSubmit={entrar} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="senha" className="label">
                  Senha
                </label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="field"
                />
              </div>
              {erro && (
                <p role="alert" className="text-sm font-medium text-neg">
                  {erro}
                </p>
              )}
              <button type="submit" disabled={enviando} className="btn btn-primary w-full py-3.5 text-base">
                {enviando ? "Entrando…" : "Entrar"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
