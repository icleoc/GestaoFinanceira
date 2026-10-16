-- Jarvis Finance: base multiusuário.
-- Cada cliente tem uma CARTEIRA. Todos os dados pertencem a uma carteira e só
-- enxerga quem é MEMBRO dela, com as permissões que o dono der.
-- Permissões: ver, lancar, editar, gerenciar, planejar, equipe.

create table public.carteiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dono_id uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create table public.membros (
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text,
  email text,
  papel text not null default 'membro' check (papel in ('dono', 'admin', 'membro', 'leitor', 'personalizado')),
  permissoes text[] not null default array['ver', 'lancar'],
  criado_em timestamptz not null default now(),
  primary key (carteira_id, user_id),
  constraint membros_permissoes_validas check (permissoes <@ array['ver', 'lancar', 'editar', 'gerenciar', 'planejar', 'equipe'])
);
create index membros_user_idx on public.membros (user_id);

-- Verifica se o usuário logado tem a permissão na carteira.
create or replace function public.tem_perm(c uuid, p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.carteira_id = c and m.user_id = (select auth.uid()) and p = any (m.permissoes)
  );
$$;
revoke all on function public.tem_perm(uuid, text) from public, anon;
grant execute on function public.tem_perm(uuid, text) to authenticated;

-- Carteira de quem já usa o sistema: o único usuário atual passa a ser o dono.
do $$
declare
  u uuid;
  c uuid;
  total int;
begin
  select count(*) into total from auth.users;
  if total <> 1 then
    raise exception 'Esperava exatamente 1 usuário para assumir os dados atuais, encontrei %', total;
  end if;
  select id into u from auth.users;
  insert into public.carteiras (nome, dono_id) values ('Minha carteira', u) returning id into c;
  insert into public.membros (carteira_id, user_id, nome, email, papel, permissoes)
    select c, id, split_part(email, '@', 1), email, 'dono', array['ver', 'lancar', 'editar', 'gerenciar', 'planejar', 'equipe']
    from auth.users where id = u;

  alter table public.contas add column carteira_id uuid references public.carteiras(id) on delete cascade;
  alter table public.categorias add column carteira_id uuid references public.carteiras(id) on delete cascade;
  alter table public.transacoes add column carteira_id uuid references public.carteiras(id) on delete cascade;
  alter table public.despesas_fixas add column carteira_id uuid references public.carteiras(id) on delete cascade;
  update public.contas set carteira_id = c;
  update public.categorias set carteira_id = c;
  update public.transacoes set carteira_id = c;
  update public.despesas_fixas set carteira_id = c;
end $$;

alter table public.contas alter column carteira_id set not null;
alter table public.categorias alter column carteira_id set not null;
alter table public.transacoes alter column carteira_id set not null;
alter table public.despesas_fixas alter column carteira_id set not null;
create index contas_carteira_idx on public.contas (carteira_id);
create index categorias_carteira_idx on public.categorias (carteira_id);
create index transacoes_carteira_data_idx on public.transacoes (carteira_id, data);
create index despesas_fixas_carteira_idx on public.despesas_fixas (carteira_id);

-- O nome da categoria era único no banco inteiro; agora é único por carteira.
alter table public.categorias drop constraint categorias_nome_key;
alter table public.categorias add constraint categorias_carteira_nome_key unique (carteira_id, nome);

-- Câmbio e nota fiscal nos lançamentos.
alter table public.transacoes add column moeda varchar(3) not null default 'BRL';
alter table public.transacoes add column valor_original numeric;
alter table public.transacoes add column taxa_cambio numeric;
alter table public.transacoes add column nota_path text;

-- Pretensões de compra.
create table public.pretensoes (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  nome text not null,
  categoria text,
  valor numeric not null check (valor > 0),
  forma text not null check (forma in ('avista', 'parcelado', 'financiado')),
  parcelas int not null default 1 check (parcelas >= 1 and parcelas <= 480),
  entrada numeric not null default 0 check (entrada >= 0),
  juros_mensal numeric not null default 0 check (juros_mensal >= 0),
  prevista date,
  status text not null default 'desejo' check (status in ('desejo', 'comprada', 'descartada')),
  criado_em timestamptz not null default now()
);
create index pretensoes_carteira_idx on public.pretensoes (carteira_id);

-- O gatilho de saldo precisa mexer em contas mesmo quando quem lança só tem a
-- permissão de lançar; por isso roda com os direitos do dono da função.
create or replace function public.atualiza_saldo_conta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.contas set saldo_atual = saldo_atual + new.valor where id = new.conta_origem_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.contas set saldo_atual = saldo_atual - old.valor where id = old.conta_origem_id;
    return old;
  elsif (tg_op = 'UPDATE') then
    if (old.conta_origem_id is distinct from new.conta_origem_id) then
      update public.contas set saldo_atual = saldo_atual - old.valor where id = old.conta_origem_id;
      update public.contas set saldo_atual = saldo_atual + new.valor where id = new.conta_origem_id;
    else
      update public.contas set saldo_atual = saldo_atual - old.valor + new.valor where id = new.conta_origem_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;
revoke all on function public.atualiza_saldo_conta() from public, anon, authenticated;

-- Funções antigas e sem uso, que ficariam expostas pela API.
drop function if exists public.atualizar_saldo_conta();
drop function if exists public.update_descriptions(text, text);

-- Cria uma carteira nova para um cliente (usada pelo servidor, nunca pelo navegador).
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
    (c, 'Mercado', 'Despesa'), (c, 'Restaurante', 'Despesa'), (c, 'Combustível', 'Despesa'),
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

-- Segurança por linha.
alter table public.carteiras enable row level security;
alter table public.membros enable row level security;
alter table public.contas enable row level security;
alter table public.categorias enable row level security;
alter table public.transacoes enable row level security;
alter table public.despesas_fixas enable row level security;
alter table public.pretensoes enable row level security;

revoke all on all tables in schema public from anon;
grant select on public.carteiras, public.membros to authenticated;
grant select, insert, update, delete on public.contas, public.categorias, public.transacoes, public.despesas_fixas, public.pretensoes to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy carteiras_ver on public.carteiras for select to authenticated
  using (public.tem_perm(id, 'ver'));

-- Cada um vê a própria linha; quem gerencia a equipe vê todas. Escrita só pelo servidor.
create policy membros_ver on public.membros for select to authenticated
  using (user_id = (select auth.uid()) or public.tem_perm(carteira_id, 'equipe'));

create policy contas_ver on public.contas for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy contas_criar on public.contas for insert to authenticated with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy contas_mudar on public.contas for update to authenticated using (public.tem_perm(carteira_id, 'gerenciar')) with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy contas_apagar on public.contas for delete to authenticated using (public.tem_perm(carteira_id, 'gerenciar'));

create policy categorias_ver on public.categorias for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy categorias_criar on public.categorias for insert to authenticated with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy categorias_mudar on public.categorias for update to authenticated using (public.tem_perm(carteira_id, 'gerenciar')) with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy categorias_apagar on public.categorias for delete to authenticated using (public.tem_perm(carteira_id, 'gerenciar'));

create policy fixas_ver on public.despesas_fixas for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy fixas_criar on public.despesas_fixas for insert to authenticated with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy fixas_mudar on public.despesas_fixas for update to authenticated using (public.tem_perm(carteira_id, 'gerenciar')) with check (public.tem_perm(carteira_id, 'gerenciar'));
create policy fixas_apagar on public.despesas_fixas for delete to authenticated using (public.tem_perm(carteira_id, 'gerenciar'));

create policy transacoes_ver on public.transacoes for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy transacoes_criar on public.transacoes for insert to authenticated with check (public.tem_perm(carteira_id, 'lancar'));
create policy transacoes_mudar on public.transacoes for update to authenticated using (public.tem_perm(carteira_id, 'editar')) with check (public.tem_perm(carteira_id, 'editar'));
create policy transacoes_apagar on public.transacoes for delete to authenticated using (public.tem_perm(carteira_id, 'editar'));

create policy pretensoes_ver on public.pretensoes for select to authenticated using (public.tem_perm(carteira_id, 'ver'));
create policy pretensoes_criar on public.pretensoes for insert to authenticated with check (public.tem_perm(carteira_id, 'planejar'));
create policy pretensoes_mudar on public.pretensoes for update to authenticated using (public.tem_perm(carteira_id, 'planejar')) with check (public.tem_perm(carteira_id, 'planejar'));
create policy pretensoes_apagar on public.pretensoes for delete to authenticated using (public.tem_perm(carteira_id, 'planejar'));

-- Fotos das notas: bucket privado; a primeira pasta do caminho é o id da carteira.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas', 'notas', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy notas_ver on storage.objects for select to authenticated
  using (bucket_id = 'notas' and public.tem_perm(((storage.foldername(name))[1])::uuid, 'ver'));
create policy notas_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'notas' and public.tem_perm(((storage.foldername(name))[1])::uuid, 'lancar'));
create policy notas_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'notas' and public.tem_perm(((storage.foldername(name))[1])::uuid, 'editar'));
