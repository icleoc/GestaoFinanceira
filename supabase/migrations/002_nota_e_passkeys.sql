-- Jarvis Finance, migração 002: dados lidos da nota fiscal e Face ID (passkeys).
-- Rode UMA vez no SQL Editor do projeto Gestao_Financeira, depois da 001.

-- Empresa, itens e total lidos da foto da nota (JSON), guardados junto do lançamento.
alter table public.transacoes add column if not exists nota_dados jsonb;

-- Chaves de acesso por biometria (Face ID, Touch ID, Windows Hello).
-- Guardam só a chave PÚBLICA do aparelho; a privada nunca sai dele.
-- Sem nenhuma permissão para anon/authenticated: só o servidor (chave de serviço) lê e grava.
create table if not exists public.passkeys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  nome text,
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz
);
create index if not exists passkeys_user_idx on public.passkeys (user_id);
alter table public.passkeys enable row level security;
revoke all on public.passkeys from anon, authenticated;
