-- Jarvis Finance, migração 006: contas fixas (início, baixa, valor variável), consórcio,
-- nome de exibição e notificações no celular. Rode UMA vez no SQL Editor.

-- 1) Contas fixas
alter table public.despesas_fixas add column if not exists flutuante boolean not null default false;
alter table public.despesas_fixas add column if not exists inicio date;
alter table public.despesas_fixas add column if not exists baixa_mes text;
-- Quem está começando do zero não deve ver como atrasado o que venceu antes de cadastrar.
update public.despesas_fixas set inicio = current_date where inicio is null;
alter table public.despesas_fixas alter column inicio set default current_date;

-- 2) Consórcio entre os tipos de dívida
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.dividas'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%financiamento%'
  loop
    execute format('alter table public.dividas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.dividas add constraint dividas_tipo_check check (tipo in ('financiamento', 'emprestimo', 'consorcio'));

-- 3) Nome de exibição: cada pessoa troca o próprio nome em todas as carteiras dela.
create or replace function public.atualizar_meu_nome(p_nome text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_nome is null or char_length(btrim(p_nome)) not between 2 and 60 then
    raise exception 'Nome inválido';
  end if;
  update public.membros set nome = btrim(p_nome) where user_id = auth.uid();
end;
$$;
revoke all on function public.atualizar_meu_nome(text) from public, anon;
grant execute on function public.atualizar_meu_nome(text) to authenticated;

-- 4) Aparelhos que recebem notificação no celular (cada pessoa só mexe nos seus).
create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon;
grant select, insert, update, delete on public.push_inscricoes to authenticated;
drop policy if exists push_ver on public.push_inscricoes;
drop policy if exists push_criar on public.push_inscricoes;
drop policy if exists push_mudar on public.push_inscricoes;
drop policy if exists push_apagar on public.push_inscricoes;
create policy push_ver on public.push_inscricoes for select to authenticated using (user_id = auth.uid());
create policy push_criar on public.push_inscricoes for insert to authenticated with check (user_id = auth.uid());
create policy push_mudar on public.push_inscricoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_apagar on public.push_inscricoes for delete to authenticated using (user_id = auth.uid());
