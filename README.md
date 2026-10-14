# Gestão Financeira

Painel pessoal de contas, cartões, investimentos e lançamentos. Next.js + Tailwind no Vercel, dados no Supabase, com login.

## O que tem

- Patrimônio líquido, com a divisão entre bancos e investimentos e a dívida dos cartões
- Contas correntes, cartões (fatura, limite e vencimento) e investimentos agrupados por instituição
- Lançamento de despesa, receita, transferência (inclui pagar fatura) e investimento/resgate
- Compra parcelada no cartão, com a soma sempre fechando no centavo
- Taxa ou juros cobrados por cima, registrados à parte
- Aviso de contas fixas do mês ainda sem lançamento, com botão para lançar
- Extrato com filtros, busca, edição (inclusive em todas as parcelas) e exclusão em lote
- Resumo por mês: quanto entrou, quanto saiu e para onde foi
- Tema claro e escuro automáticos, e layout para celular

## Colocar no ar (Vercel)

1. No Vercel, importe este repositório. O framework é detectado como Next.js sozinho.
2. Faça o deploy e, em **Settings > Domains**, vincule o seu domínio.

Não precisa cadastrar variáveis de ambiente: a URL e a chave **anon** (públicas por natureza) já estão em `.env.production`. Se mudar de projeto no Supabase, edite esse arquivo, ou cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no Vercel (elas têm prioridade).

Nunca coloque a chave `service_role` nem a `secret` em nenhum desses lugares.

## Segurança (faça nesta ordem)

1. Publique esta versão e confirme que a tela de login abre.
2. No Supabase, crie o seu usuário em **Authentication > Users > Add user**.
3. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**.
4. Rode `supabase/rls.sql` no **SQL Editor**. Ele liga a segurança por linha e tira o acesso de quem não está logado.
5. Em **Project Settings > API Keys**, gere uma nova **secret key**, o que revoga a antiga. A chave antiga ficou escrita em arquivos deste repositório (`app.py` e `.streamlit/secrets.toml`) e continua visível no histórico do Git, então considere-a vazada.

Se o repositório for público, torne-o privado em **Settings > General > Danger Zone**. O Vercel funciona normalmente com repositório privado.

## Saldos das contas

O sistema só grava lançamentos na tabela `transacoes`. O campo `saldo_atual` das contas precisa ser atualizado pelo próprio banco (um *trigger* no Supabase). Era assim na versão anterior e continua igual. Se os saldos não mudarem depois de um lançamento, o trigger não existe ou não está ativo.

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave anon
npm run dev                  # http://localhost:3000
npm run check                # testa as regras de parcelas, taxas, resgate e contas fixas
```

## Estrutura

```
app/                 telas (painel e login)
components/          peças da tela
lib/finance.ts       regras de negócio, sem tela nem banco (testadas por npm run check)
lib/data.ts          leitura e gravação no Supabase
lib/supabase/        clientes do Supabase e proteção de rotas
middleware.ts        manda quem não está logado para /login
supabase/rls.sql     regras de segurança do banco
scripts/             testes das regras
```
