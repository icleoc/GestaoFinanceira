-- Jarvis Finance, migração 005: avisos de vencimento por pessoa.
-- Cada pessoa da carteira pode receber avisos (7, 4, 1 dia antes e no dia) de todas as contas
-- ou só de algumas, no calendário do celular (link de agenda .ics). Rode UMA vez.

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  -- Quantos dias antes do vencimento avisar (0 = no dia).
  dias int[] not null default '{7,4,1,0}',
  -- Contas escolhidas: 'fixa:<id>' ou 'divida:<id>'. Nulo = todas.
  contas text[],
  -- Segredo do link do calendário. Só o próprio dono lê (função abaixo).
  token uuid not null default gen_random_uuid() unique,
  atualizado_em timestamptz not null default now(),
  unique (carteira_id, user_id),
  constraint avisos_dias_validos check (cardinality(dias) <= 8 and dias <@ array[0,1,2,3,4,5,6,7,10,14,15,30])
);

alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;
grant select (id, carteira_id, user_id, ativo, dias, contas, atualizado_em) on public.avisos to authenticated;
grant insert (carteira_id, user_id, ativo, dias, contas, atualizado_em) on public.avisos to authenticated;
grant update (ativo, dias, contas, atualizado_em) on public.avisos to authenticated;
grant delete on public.avisos to authenticated;

drop policy if exists avisos_ver on public.avisos;
drop policy if exists avisos_criar on public.avisos;
drop policy if exists avisos_mudar on public.avisos;
drop policy if exists avisos_apagar on public.avisos;
create policy avisos_ver on public.avisos for select to authenticated
  using (user_id = auth.uid() or public.tem_perm(carteira_id, 'equipe'));
create policy avisos_criar on public.avisos for insert to authenticated
  with check (
    exists (select 1 from public.membros m where m.carteira_id = avisos.carteira_id and m.user_id = avisos.user_id)
    and ((user_id = auth.uid() and public.tem_perm(carteira_id, 'ver')) or public.tem_perm(carteira_id, 'equipe'))
  );
create policy avisos_mudar on public.avisos for update to authenticated
  using ((user_id = auth.uid() and public.tem_perm(carteira_id, 'ver')) or public.tem_perm(carteira_id, 'equipe'))
  with check ((user_id = auth.uid() and public.tem_perm(carteira_id, 'ver')) or public.tem_perm(carteira_id, 'equipe'));
create policy avisos_apagar on public.avisos for delete to authenticated
  using (user_id = auth.uid() or public.tem_perm(carteira_id, 'equipe'));

-- O link do calendário de quem está logado (null se ainda não tem avisos).
create or replace function public.meu_token_aviso(p_carteira uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select token from public.avisos where carteira_id = p_carteira and user_id = auth.uid();
$$;

-- Gera um link novo (o antigo para de funcionar). Útil se o link vazou.
create or replace function public.renovar_token_aviso(p_carteira uuid)
returns uuid
language sql security definer set search_path = ''
as $$
  update public.avisos set token = gen_random_uuid(), atualizado_em = now()
    where carteira_id = p_carteira and user_id = auth.uid()
    returning token;
$$;

revoke all on function public.meu_token_aviso(uuid), public.renovar_token_aviso(uuid) from public, anon;
grant execute on function public.meu_token_aviso(uuid), public.renovar_token_aviso(uuid) to authenticated;
