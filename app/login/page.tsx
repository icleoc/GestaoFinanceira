"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, supabaseConfigurado } from "@/lib/supabase/client";
import { MARCA } from "@/lib/brand";

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{MARCA.nome}</h1>
      <p className="mt-2 text-muted">Entre para ver suas contas e lançar movimentações.</p>

      {!supabaseConfigurado ? (
        <div className="panel mt-8 border-warn/40 p-4 text-sm" role="alert">
          <p className="font-semibold text-warn">Falta configurar o Supabase.</p>
          <p className="mt-1 text-muted">
            Cadastre <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            nas variáveis de ambiente do Vercel (ou em <code>.env.local</code>) e publique de novo.
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
          <button type="submit" disabled={enviando} className="btn btn-primary w-full py-3">
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      )}
    </main>
  );
}
