import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço: ignora todas as regras de segurança.
 * Só existe no servidor e só é usado depois de conferir quem está pedindo.
 * A chave vem da variável SUPABASE_SERVICE_ROLE_KEY (nunca vai para o navegador).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const SEM_CHAVE_DE_SERVICO =
  "O servidor ainda não tem a chave de serviço do Supabase. Cadastre SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do Vercel.";
