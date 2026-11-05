-- Jarvis Finance, migração 008: contas em dólar, euro etc. com saldo na própria moeda e custo em reais
-- (para mostrar a variação cambial). Rode UMA vez.

alter table public.contas add column if not exists moeda text not null default 'BRL';
alter table public.contas drop constraint if exists contas_moeda_valida;
alter table public.contas add constraint contas_moeda_valida check (moeda in ('BRL', 'USD', 'EUR', 'GBP', 'CHF'));
-- Quanto custou, em reais, o saldo atual de uma conta em moeda estrangeira (custo médio).
alter table public.contas add column if not exists custo_brl numeric(16,2) not null default 0;
-- Valor do lançamento na moeda da conta (com sinal). Em contas em reais fica vazio.
alter table public.transacoes add column if not exists valor_conta numeric(16,4);

-- Aplica um lançamento (ou desfaz, com sinal -1) no saldo da conta.
-- Conta em reais: soma o valor. Conta em moeda estrangeira: soma o valor_conta e mantém o custo médio em reais.
create or replace function public.aplica_movimento(p_conta bigint, p_valor numeric, p_valor_conta numeric, p_sinal int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m text;
  s numeric;
  k numeric;
  d numeric;
begin
  if p_conta is null then
    return;
  end if;
  select moeda, saldo_atual, custo_brl into m, s, k from public.contas where id = p_conta for update;
  if not found then
    return;
  end if;
  if m = 'BRL' then
    update public.contas set saldo_atual = saldo_atual + p_sinal * p_valor where id = p_conta;
    return;
  end if;
  d := p_sinal * coalesce(p_valor_conta, p_valor);
  if d >= 0 then
    k := k + abs(p_valor);
  elsif s > 0 then
    k := k * greatest(0, (s + d) / s);
  else
    k := 0;
  end if;
  update public.contas set saldo_atual = s + d, custo_brl = round(k, 2) where id = p_conta;
end;
$$;
revoke all on function public.aplica_movimento(bigint, numeric, numeric, int) from public, anon, authenticated;

create or replace function public.atualiza_saldo_conta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.aplica_movimento(new.conta_origem_id, new.valor, new.valor_conta, 1);
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.aplica_movimento(old.conta_origem_id, old.valor, old.valor_conta, -1);
    return old;
  elsif (tg_op = 'UPDATE') then
    perform public.aplica_movimento(old.conta_origem_id, old.valor, old.valor_conta, -1);
    perform public.aplica_movimento(new.conta_origem_id, new.valor, new.valor_conta, 1);
    return new;
  end if;
  return null;
end;
$$;
