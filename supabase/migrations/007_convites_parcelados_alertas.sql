-- Jarvis Finance, migração 007: convite de pessoas por link, compras parceladas (Pix/boleto)
-- e alertas de vencimento por despesa. Rode UMA vez.

-- 1) Convites: o dono gera um link com o tipo de acesso; a pessoa preenche nome e senha.
-- Só o servidor (chave de serviço) mexe nesta tabela.
create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  nome text,
  email text,
  permissoes text[] not null default array['ver', 'lancar'],
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  constraint convites_permissoes_validas check (permissoes <@ array['ver', 'lancar', 'editar', 'gerenciar', 'planejar', 'equipe'])
);
create index if not exists convites_carteira_idx on public.convites (carteira_id);
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;

-- 2) Compra parcelada em Pix ou boleto (serviço de advogado, curso, reforma…)
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
alter table public.dividas add constraint dividas_tipo_check check (tipo in ('financiamento', 'emprestimo', 'consorcio', 'parcelado'));
alter table public.dividas add column if not exists forma text;
alter table public.dividas drop constraint if exists dividas_forma_check;
alter table public.dividas add constraint dividas_forma_check check (forma is null or forma in ('pix', 'boleto'));

-- 3) Alertas por despesa: quem recebe (nulo = todas as pessoas da carteira)
alter table public.despesas_fixas add column if not exists avisar uuid[];
alter table public.dividas add column if not exists avisar uuid[];

-- 4) Todo mundo da carteira já nasce com os avisos ligados (7, 4, 1 dia antes e no dia)
insert into public.avisos (carteira_id, user_id)
  select carteira_id, user_id from public.membros
  on conflict (carteira_id, user_id) do nothing;

create or replace function public.membro_novo_com_avisos()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.avisos (carteira_id, user_id) values (new.carteira_id, new.user_id)
    on conflict (carteira_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists membro_novo_com_avisos on public.membros;
create trigger membro_novo_com_avisos after insert on public.membros
  for each row execute function public.membro_novo_com_avisos();
