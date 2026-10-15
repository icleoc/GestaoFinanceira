import type { Metadata } from "next";
import Link from "next/link";
import Simulador from "@/components/landing/Simulador";
import Previa from "@/components/landing/Previa";
import { MARCA } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${MARCA.nome}: quanto você tem de verdade`,
  description: MARCA.descricao,
  robots: { index: true, follow: true },
};

const RECURSOS = [
  {
    titulo: "Patrimônio de verdade",
    texto: "Bancos mais investimentos, menos a dívida dos cartões. Um número que não esconde a fatura.",
  },
  {
    titulo: "Cartões sob controle",
    texto: "Fatura, limite disponível e dia de vencimento de cada cartão, com a barra ficando vermelha quando passa de 80% do limite.",
  },
  {
    titulo: "Parcelas que fecham no centavo",
    texto: "Cada compra parcelada vira uma linha por mês e a soma sempre bate com o total. Dia 31 num mês curto cai no último dia do mês.",
  },
  {
    titulo: "Taxas e juros à parte",
    texto: "Quando a operadora cobra por cima, a taxa vai para uma linha própria e o valor líquido da compra continua limpo.",
  },
  {
    titulo: "Contas fixas que não passam batido",
    texto: "Aluguel, internet, academia: o painel mostra o que já venceu e ainda não foi lançado, com um botão para lançar na hora.",
  },
  {
    titulo: "Extrato que dá para editar",
    texto: "Filtre por mês, conta e tipo. Mudou um valor? Aplique em todas as parcelas da compra de uma vez, ou exclua vários lançamentos juntos.",
  },
];

const PASSOS = [
  { titulo: "Cadastre suas contas", texto: "Bancos, cartões (com limite e vencimento) e investimentos." },
  { titulo: "Lance o que entra e sai", texto: "Despesa, receita, transferência ou investimento, à vista ou parcelado." },
  { titulo: "Acompanhe o mês", texto: "Patrimônio, faturas e gastos por categoria atualizados a cada lançamento." },
];

const GARANTIAS = [
  { titulo: "Login com e-mail e senha", texto: "Sem entrar, nenhuma tela do painel abre." },
  { titulo: "Cadastro fechado", texto: "Só existe conta para quem você criar. Ninguém se cadastra sozinho." },
  { titulo: "Regras de segurança no próprio banco", texto: "Mesmo conhecendo o endereço do banco, quem não está logado não lê nem altera nada." },
  { titulo: "Chaves secretas fora do navegador", texto: "O navegador só recebe a chave pública, que sozinha não abre nenhum dado." },
];

const PERGUNTAS = [
  {
    p: "Preciso ligar minha conta de banco?",
    r: "Não. Você lança as movimentações em segundos e nada pede a senha do seu banco. O sistema só conhece o que você registrar.",
  },
  {
    p: "Posso criar minha conta agora?",
    r: "O acesso é restrito por enquanto: contas novas são criadas por quem administra o sistema.",
  },
  {
    p: "Como as parcelas são divididas?",
    r: "Em centavos exatos. Se 1.000 reais em 3 vezes não divide certinho, os centavos que sobram vão para as primeiras parcelas e a soma fecha. Teste no simulador no topo da página.",
  },
  {
    p: "Funciona no celular?",
    r: "Sim. O layout se adapta à tela, e o tema claro ou escuro segue a configuração do seu aparelho.",
  },
  {
    p: "O que acontece quando o cartão cobra juros ou taxa?",
    r: "Você informa o total cobrado. O valor da compra fica como está, e a diferença é registrada numa linha separada de taxa.",
  },
];

export default function PaginaInicial() {
  return (
    <>
      <div className="bg-deep text-paper">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex items-center justify-between py-5" aria-label="Principal">
            <span className="font-display text-lg font-semibold">{MARCA.nome}</span>
            <div className="flex items-center gap-5 text-sm">
              <a href="#como-funciona" className="hidden text-paper/75 hover:text-paper sm:inline">
                Como funciona
              </a>
              <a href="#seguranca" className="hidden text-paper/75 hover:text-paper sm:inline">
                Segurança
              </a>
              <Link href="/login" className="btn border border-paper/30 px-4 py-2 text-paper hover:bg-paper/10">
                Entrar
              </Link>
            </div>
          </nav>

          <div className="grid items-center gap-10 pb-16 pt-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-24 lg:pt-14">
            <div>
              <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Quanto você tem de verdade, já descontando o cartão?
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/80">
                Contas, cartões e investimentos num só painel. Lance um gasto em segundos e veja o patrimônio se ajustar na hora.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn bg-paper px-6 py-3 text-base text-deep hover:opacity-90">
                  Acessar o painel
                </Link>
                <a href="#painel" className="btn border border-paper/30 px-6 py-3 text-base text-paper hover:bg-paper/10">
                  Ver o painel
                </a>
              </div>
              <p className="mt-4 text-sm text-paper/60">Acesso restrito por enquanto.</p>
            </div>
            <Simulador />
          </div>
        </div>
      </div>

      <main>
        <section id="painel" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="titulo-painel">
          <h2 id="titulo-painel" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Tudo o que você tem, e tudo o que você deve, numa tela só.
          </h2>
          <p className="mt-4 max-w-xl text-muted">
            Este é o painel que você abre todo dia, aqui com dados de exemplo.
          </p>
          <div className="mt-10">
            <Previa />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24" aria-labelledby="titulo-recursos">
          <h2 id="titulo-recursos" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Feito para quem lança gasto todo dia.
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-0 md:grid-cols-2">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="border-t border-line py-6">
                <dt className="font-display text-xl font-semibold">{r.titulo}</dt>
                <dd className="mt-2 max-w-md text-muted">{r.texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="como-funciona" className="bg-sunken" aria-labelledby="titulo-passos">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 id="titulo-passos" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Em três passos você está usando.
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {PASSOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-4 md:block">
                  <span className="font-display num text-5xl font-semibold leading-none text-accent md:text-6xl">{i + 1}</span>
                  <div className="md:mt-4">
                    <h3 className="font-display text-xl font-semibold">{p.titulo}</h3>
                    <p className="mt-1.5 max-w-xs text-muted">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="seguranca" className="bg-deep text-paper" aria-labelledby="titulo-seguranca">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <h2 id="titulo-seguranca" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Seus números ficam atrás de uma porta trancada.
              </h2>
              <p className="mt-4 max-w-md text-paper/75">
                Dinheiro é assunto pessoal. Por isso o acesso é fechado e a proteção existe em duas camadas: no site e no banco de dados.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {GARANTIAS.map((g) => (
                <div key={g.titulo} className="border-t border-paper/20 py-5">
                  <dt className="font-semibold">{g.titulo}</dt>
                  <dd className="mt-1.5 text-sm text-paper/70">{g.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="titulo-faq">
          <h2 id="titulo-faq" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {PERGUNTAS.map((q) => (
              <details key={q.p} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <span className="shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-xl text-muted">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="rounded-3xl bg-deep px-6 py-12 text-paper sm:px-12 sm:py-16">
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Pronto para ver o seu número real?
            </h2>
            <Link href="/login" className="btn mt-8 bg-paper px-6 py-3 text-base text-deep hover:opacity-90">
              Acessar o painel
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <span className="font-display font-semibold text-ink">{MARCA.nome}</span>
          <span>© {new Date().getFullYear()}. Todos os direitos reservados.</span>
        </div>
      </footer>
    </>
  );
}
