-- Jarvis Finance, migração 003: limite de gasto por membro, quem lançou, dados dos cartões e categoria Alimentação.
-- Rode UMA vez no SQL Editor do projeto Gestao_Financeira, depois da 001 e da 002.

-- Quem fez cada lançamento (para o limite e o extrato por pessoa).
alter table public.transacoes add column if not exists criado_por uuid default auth.uid() references auth.users(id) on delete set null;
create index if not exists transacoes_criado_por_idx on public.transacoes (carteira_id, criado_por);

-- Dados do cartão (só os 4 últimos dígitos, nunca o número completo) e quem é o titular.
alter table public.contas add column if not exists bandeira text;
alter table public.contas add column if not exists final_cartao text check (final_cartao is null or final_cartao ~ '^[0-9]{4}$');
alter table public.contas add column if not exists dia_fechamento int check (dia_fechamento is null or dia_fechamento between 1 and 31);
alter table public.contas add column if not exists titular_id uuid references auth.users(id) on delete set null;

-- Limite mensal de gasto por pessoa da carteira.
create table if not exists public.limites (
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  valor_mensal numeric(14,2) not null check (valor_mensal > 0),
  primary key (carteira_id, user_id)
);
alter table public.limites enable row level security;
revoke all on public.limites from anon;
grant select, insert, update, delete on public.limites to authenticated;
drop policy if exists limites_ver on public.limites;
drop policy if exists limites_criar on public.limites;
drop policy if exists limites_mudar on public.limites;
drop policy if exists limites_apagar on public.limites;
create policy limites_ver on public.limites for select to authenticated
  using (user_id = (select auth.uid()) or public.tem_perm(carteira_id, 'equipe'));
create policy limites_criar on public.limites for insert to authenticated with check (public.tem_perm(carteira_id, 'equipe'));
create policy limites_mudar on public.limites for update to authenticated
  using (public.tem_perm(carteira_id, 'equipe')) with check (public.tem_perm(carteira_id, 'equipe'));
create policy limites_apagar on public.limites for delete to authenticated using (public.tem_perm(carteira_id, 'equipe'));

-- Categoria Alimentação nas carteiras que já existem (padaria, restaurante, lanchonete).
insert into public.categorias (carteira_id, nome, tipo)
  select id, 'Alimentação', 'Despesa' from public.carteiras
  on conflict (carteira_id, nome) do nothing;

-- Carteiras novas já nascem com Alimentação.
create or replace function public.nova_carteira(p_dono uuid, p_nome text, p_membro_nome text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c uuid;
  em text;
begin
  select email into em from auth.users where id = p_dono;
  if not found then
    raise exception 'Usuário não existe';
  end if;
  insert into public.carteiras (nome, dono_id) values (coalesce(nullif(trim(p_nome), ''), 'Minha carteira'), p_dono) returning id into c;
  insert into public.membros (carteira_id, user_id, nome, email, papel, permissoes)
    values (c, p_dono, coalesce(p_membro_nome, split_part(em, '@', 1)), em, 'dono', array['ver', 'lancar', 'editar', 'gerenciar', 'planejar', 'equipe']);
  insert into public.categorias (carteira_id, nome, tipo) values
    (c, 'Mercado', 'Despesa'), (c, 'Alimentação', 'Despesa'), (c, 'Restaurante', 'Despesa'), (c, 'Combustível', 'Despesa'),
    (c, 'Transporte', 'Despesa'), (c, 'Saúde', 'Despesa'), (c, 'Moradia', 'Despesa'),
    (c, 'Energia', 'Despesa'), (c, 'Água', 'Despesa'), (c, 'Internet', 'Despesa'),
    (c, 'Assinaturas', 'Despesa'), (c, 'Lazer', 'Despesa'), (c, 'Educação', 'Despesa'),
    (c, 'Compras', 'Despesa'), (c, 'Presente', 'Despesa'), (c, 'Outros', 'Despesa'),
    (c, 'Salário', 'Receita'), (c, 'Rendimentos', 'Receita'), (c, 'Outras receitas', 'Receita'),
    (c, 'Aporte / Resgate', 'Investimento');
  return c;
end;
$$;
revoke all on function public.nova_carteira(uuid, text, text) from public, anon, authenticated;
