import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão a cada visita e manda quem não está logado para /login.
 * Sem as variáveis de ambiente, deixa passar para a tela mostrar o aviso de configuração.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida o token no servidor do Supabase (getSession só leria o cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const noLogin = caminho.startsWith("/login");
  // A página inicial é aberta a todos. O provisionamento é chamado pelo sistema de
  // vendas (sem login) e se protege sozinho com um segredo.
  const paginaPublica = caminho === "/" || caminho === "/api/provisionar";

  if (!user && !noLogin && !paginaPublica) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (user && noLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/app";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}
