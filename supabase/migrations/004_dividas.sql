-- Jarvis Finance, migração 004: financiamentos e empréstimos.
-- Rode UMA vez no SQL Editor do projeto Gestao_Financeira (não depende da 003).

create table if not exists public.dividas (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  tipo text not null check (tipo in ('financiamento', 'emprestimo')),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  -- Valor do bem financiado ou valor emprestado.
  valor_bem numeric(14,2) not null check (valor_bem > 0),
  entrada numeric(14,2) not null default 0 check (entrada >= 0),
  parcelas int not null check (parcelas between 1 and 600),
  valor_parcela numeric(14,2) not null check (valor_parcela > 0),
  -- Vencimento da 1ª parcela (pode ser no passado: dívida que já estava em andamento).
  primeira_parcela date not null,
  -- Parcelas já pagas, inclusive as de antes de usar o app. Elas não viram lançamentos.
  parcelas_pagas int not null default 0,
  conta_id bigint references public.contas(id) on delete set null,
  categoria_id bigint references public.categorias(id) on delete set null,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint dividas_entrada_menor check (entrada < valor_bem),
  constraint dividas_pagas_validas check (parcelas_pagas between 0 and parcelas)
);
create index if not exists dividas_carteira_idx on public.dividas (carteira_id);

alter table public.dividas enable row level security;
revoke all on public.dividas from anon;
grant select, insert, update, delete on public.dividas to authenticated;
drop policy if exists dividas_ver on public.dividas;
drop policy if exists dividas_criar on public.dividas;
drop policy if exists dividas_mudar on public.dividas;
drop policy if exists dividas_apagar on public.dividas;
create policy dividas_ver on public.dividas for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy dividas_criar on public.dividas for insert to authenticated with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy dividas_mudar on public.dividas for update to authenticated
  using (public.tem_perm(carteira_id, 'gerenciar')) with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy dividas_apagar on public.dividas for delete to authenticated using (public.tem_perm(carteira_id, 'gerenciar'));

-- Marca a próxima parcela como paga. Quem só tem a permissão de lançar também pode pagar,
-- mas só avançar uma parcela por vez, sem mexer em mais nada da dívida.
create or replace function public.pagar_parcela(p_id uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  c uuid;
  n int;
begin
  select carteira_id into c from public.dividas where id = p_id;
  if c is null or not public.tem_perm(c, 'lancar') then
    raise exception 'Sem permissão';
  end if;
  update public.dividas set parcelas_pagas = parcelas_pagas + 1
    where id = p_id and parcelas_pagas < parcelas
    returning parcelas_pagas into n;
  if n is null then
    raise exception 'Todas as parcelas já foram pagas';
  end if;
  return n;
end;
$$;
revoke all on function public.pagar_parcela(uuid) from public, anon;
grant execute on function public.pagar_parcela(uuid) to authenticated;

-- Desfaz o último pagamento marcado (para quando o lançamento da parcela não pôde ser gravado).
create or replace function public.desfazer_parcela(p_id uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  c uuid;
  n int;
begin
  select carteira_id into c from public.dividas where id = p_id;
  if c is null or not public.tem_perm(c, 'lancar') then
    raise exception 'Sem permissão';
  end if;
  update public.dividas set parcelas_pagas = parcelas_pagas - 1
    where id = p_id and parcelas_pagas > 0
    returning parcelas_pagas into n;
  return coalesce(n, 0);
end;
$$;
revoke all on function public.desfazer_parcela(uuid) from public, anon;
grant execute on function public.desfazer_parcela(uuid) to authenticated;
