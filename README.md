# Jarvis Finance

Painel pessoal de contas, cartões, investimentos e lançamentos. Next.js + Tailwind no Vercel, dados no Supabase, com login.

## Como o site é organizado

- `/` é a página inicial pública (landing page, com um simulador de parcelas que usa a mesma conta do sistema).
- `/login` é a entrada.
- `/app` é o painel, só para quem está logado.

O nome do produto fica em `lib/brand.ts`: mude lá e tudo acompanha.

## O que tem

- Patrimônio líquido, com a divisão entre bancos e investimentos e a dívida dos cartões
- Contas correntes, cartões (fatura, limite e vencimento) e investimentos agrupados por instituição
- Lançamento de despesa, receita, transferência (inclui pagar fatura) e investimento/resgate
- Compra parcelada no cartão, com a soma sempre fechando no centavo
- **Assistente financeiro**: onde você mais gasta, o que subiu acima da média, ritmo do mês, limite do cartão e parcelas já comprometidas
- **Receita em outra moeda** (EUR, USD, GBP, CHF): converte pela cotação do dia (Banco Central Europeu, via Frankfurter) e guarda valor original, moeda e taxa. Dá para ajustar a cotação à mão
- **Foto da nota** no lançamento, guardada em bucket privado do Supabase
- **Planejar compras**: lista de desejos (à vista, parcelado, financiado) e análise de quanto cada uma pesa na renda
- **Pessoas e permissões**: cada carteira tem dono e pode convidar familiares com permissões ver, lançar, editar, gerenciar, planejar e equipe
- Extrato com filtros, busca, edição (inclusive em todas as parcelas) e exclusão em lote
- Tema claro e escuro automáticos, e layout para celular

## Como os dados são separados (para vender o sistema)

Cada cliente tem uma **carteira**. Todos os dados (contas, categorias, lançamentos, contas fixas, pretensões e fotos) pertencem a uma carteira e só aparecem para quem é **membro** dela. A separação é feita pelo próprio banco (segurança por linha), então nem um erro no site deixa um cliente ver o outro. Cada membro tem uma lista de permissões e o banco confere cada uma delas.

### Criar um cliente automaticamente depois da compra

O sistema de vendas chama, no servidor:

```
POST https://SEU-DOMINIO/api/provisionar
Authorization: Bearer <PROVISION_SECRET>
Content-Type: application/json

{ "email": "cliente@exemplo.com", "nome": "Maria", "carteira": "Carteira da Maria" }
```

A resposta traz `senhaTemporaria` (envie ao cliente por e-mail; ele pode trocar em "Minha conta > Trocar senha"). A carteira já nasce com categorias iniciais.

## Colocar no ar (Vercel)

1. No Vercel, importe este repositório. O framework é detectado como Next.js sozinho.
2. Em **Settings > Environment Variables**, cadastre (só em Production, marcadas como sensíveis): `SUPABASE_SERVICE_ROLE_KEY` e `PROVISION_SECRET`. Sem elas o site funciona, mas convidar pessoas e criar clientes ficam desligados.
3. Em **Settings > Domains**, vincule o seu domínio.

A URL e a chave **anon** (públicas por natureza) já estão em `.env.production`. Nunca coloque a chave `secret`/`service_role` em arquivo do repositório.

## Banco de dados (Supabase)

Rode **uma vez** `supabase/migrations/001_multiusuario.sql` (SQL Editor). Ela:

- cria carteiras e membros e passa os dados atuais para a carteira do único usuário existente (se houver mais de um usuário, ela se recusa a rodar);
- liga a segurança por linha em todas as tabelas e tira todo acesso do papel `anon`;
- adiciona colunas de câmbio e foto, a tabela de pretensões e o bucket privado `notas`.

Depois, em **Authentication > Sign In / Providers**, deixe desligado **Allow new users to sign up** (as contas passam a ser criadas pelo servidor), gere uma nova **secret key** (a antiga ficou no histórico do Git) e, se o repositório for público, torne-o privado.

## Saldos das contas

O campo `saldo_atual` das contas é atualizado por um *trigger* do banco (`atualiza_saldo_conta`) a cada lançamento. Se os saldos não mudarem depois de um lançamento, o trigger não está ativo.

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave anon
npm run dev                  # http://localhost:3000
npm run check                # testa as regras de parcelas, taxas, resgate e contas fixas
```

## Estrutura

```
app/page.tsx         página inicial (landing)
app/app/             painel
app/login/           entrada
components/          peças da tela
lib/finance.ts       regras de negócio, sem tela nem banco (testadas por npm run check)
lib/assistente.ts    insights do assistente financeiro
lib/planejamento.ts  análise das pretensões de compra
lib/cambio.ts        moedas e conversão
lib/permissoes.ts    papéis e permissões
app/api/             cotação, equipe e provisionamento de clientes
lib/data.ts          leitura e gravação no Supabase
lib/supabase/        clientes do Supabase e proteção de rotas
middleware.ts        manda quem não está logado para /login
supabase/migrations banco multiusuário e segurança por linha
scripts/             testes das regras
```
