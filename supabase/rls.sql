-- Segurança do banco: só quem está logado lê ou altera os dados.
--
-- COMO USAR
--   1. Publique a versão nova do site e confirme que o login funciona.
--   2. No Supabase: Authentication > Users > Add user, e crie o seu usuário (e-mail e senha).
--   3. No Supabase: Authentication > Sign In / Providers, desligue "Allow new users to sign up".
--      (Isso é essencial: as tabelas não têm dono por linha, então qualquer usuário
--      cadastrado enxergaria tudo. Com o cadastro fechado, só existe o seu.)
--   4. Cole este arquivo em SQL Editor e clique em Run.
--
-- ATENÇÃO: depois de rodar, a versão antiga do site (index.html, sem login) deixa de funcionar.
-- É o objetivo, mas por isso o passo 1 vem primeiro.
--
-- Pode rodar de novo sem problema: o script se refaz.

do $$
declare
  t text;
begin
  foreach t in array array['contas', 'categorias', 'transacoes', 'despesas_fixas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "somente usuarios logados" on public.%I', t);
    execute format(
      'create policy "somente usuarios logados" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
    -- Visitante sem login (chave pública "anon") não tem acesso nenhum.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$$;

-- Conferência: as quatro linhas devem mostrar rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('contas', 'categorias', 'transacoes', 'despesas_fixas')
order by tablename;
