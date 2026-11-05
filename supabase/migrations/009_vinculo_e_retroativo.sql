-- Jarvis Finance, migração 009: transferências vinculadas e lançamentos retroativos.
-- Rode UMA vez.

-- vinculo: as duas pontas de uma transferência compartilham o mesmo uuid.
-- sem_saldo: lançamento de histórico (ex.: justificar a fatura atual); não mexe no saldo da conta.
alter table public.transacoes add column if not exists vinculo uuid;
alter table public.transacoes add column if not exists sem_saldo boolean not null default false;
create index if not exists transacoes_vinculo_idx on public.transacoes (vinculo) where vinculo is not null;

create or replace function public.atualiza_saldo_conta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    if not new.sem_saldo then
      perform public.aplica_movimento(new.conta_origem_id, new.valor, new.valor_conta, 1);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if not old.sem_saldo then
      perform public.aplica_movimento(old.conta_origem_id, old.valor, old.valor_conta, -1);
    end if;
    return old;
  elsif (tg_op = 'UPDATE') then
    if not old.sem_saldo then
      perform public.aplica_movimento(old.conta_origem_id, old.valor, old.valor_conta, -1);
    end if;
    if not new.sem_saldo then
      perform public.aplica_movimento(new.conta_origem_id, new.valor, new.valor_conta, 1);
    end if;
    return new;
  end if;
  return null;
end;
$$;
