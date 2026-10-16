import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente do servidor que age como a pessoa logada (lê o login dos cookies). */
export async function supabaseServidor() {
  const guarda = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => guarda.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => guarda.set(name, value, options));
        } catch {
          /* chamado de um lugar onde não dá para gravar cookies: o middleware renova */
        }
      },
    },
  });
}
