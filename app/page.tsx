import type { Metadata } from "next";
import Link from "next/link";
import Simulador from "@/components/landing/Simulador";
import Previa, { kpisDeExemplo } from "@/components/landing/Previa";
import Patrimonio from "@/components/Patrimonio";
import Guilloche from "@/components/Guilloche";
import Logo from "@/components/Logo";
import { MARCA } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${MARCA.nome}: quanto você tem de verdade`,
  description: MARCA.descricao,
  robots: { index: true, follow: true },
};

const RECURSOS = [
  {
    titulo: "Um assistente que explica seus gastos",
    texto: "Mostra onde você mais gasta, o que subiu acima da média, o ritmo do mês e o que já está comprometido em parcelas.",
  },
  {
    titulo: "Salário em euro, dólar ou outra moeda",
    texto: "Escolha a moeda ao lançar a receita. A conversão usa a cotação do dia e guarda o valor original e a taxa usada.",
  },
  {
    titulo: "Foto da nota na hora da compra",
    texto: "Tire a foto, escolha a categoria e informe o valor. A nota fica guardada no lançamento, só para quem tem permissão.",
  },
  {
    titulo: "Planeje antes de comprar",
    texto: "Liste o que quer comprar, à vista, parcelado ou financiado, e veja quanto cada compra pesa na sua renda.",
  },
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
  { titulo: "Dados separados por cliente", texto: "Cada carteira só aparece para as pessoas que fazem parte dela. Ninguém vê a carteira de outro cliente." },
  { titulo: "Família com permissões", texto: "Convide pessoas e escolha o que cada uma pode fazer: só ver, lançar, editar, gerenciar contas ou planejar." },
  { titulo: "Acesso por convite", texto: "Ninguém se cadastra sozinho. A conta nasce na compra ou é criada por quem administra a carteira." },
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
    r: "Em centavos exatos. Se 1.000 reais em 3 vezes não divide certinho, os centavos que sobram vão para as primeiras parcelas e a soma fecha. Teste no simulador desta página.",
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
      <div className="tinta relative overflow-hidden text-paper">
        <Guilloche className="pointer-events-none absolute -bottom-64 -left-40 w-[46rem] max-w-none text-gold opacity-[0.07]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex items-center justify-between py-6" aria-label="Principal">
            <Logo tom="claro" tamanho={42} />
            <div className="flex items-center gap-6 text-sm">
              <a href="#como-funciona" className="hidden text-paper/75 hover:text-paper sm:inline">
                Como funciona
              </a>
              <a href="#seguranca" className="hidden text-paper/75 hover:text-paper sm:inline">
                Segurança
              </a>
              <Link href="/login" className="btn border border-gold/50 px-5 py-2 text-gold-hi hover:bg-gold/10">
                Entrar
              </Link>
            </div>
          </nav>

          <div className="grid items-center gap-12 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-16">
            <div>
              <h1 className="font-display text-[2.8rem] leading-[1.02] sm:text-[4.2rem]" style={{ letterSpacing: "-0.03em" }}>
                Quanto você tem de verdade, já descontando o cartão?
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-paper/75">
                Contas, cartões e investimentos num só painel. Lance um gasto em segundos e veja o patrimônio se ajustar na hora.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link href="/login" className="btn btn-gold px-7 py-3.5 text-base">
                  Acessar o painel
                </Link>
                <a href="#painel" className="text-sm font-semibold text-paper/80 underline decoration-gold/60 underline-offset-4 hover:text-paper">
                  Ver como é por dentro
                </a>
              </div>
              <p className="mt-5 text-sm text-paper/55">Acesso restrito por enquanto.</p>
            </div>
            <div>
              <Patrimonio kpis={kpisDeExemplo()} animar compacto />
              <p className="mt-3 text-center text-xs text-paper/50">Dados de exemplo</p>
            </div>
          </div>
        </div>
      </div>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <div>
            <h2 className="font-display max-w-md text-4xl leading-[1.08] sm:text-5xl">Parcelas que fecham no centavo.</h2>
            <p className="mt-5 max-w-md text-lg text-muted">
              Cada compra parcelada vira uma linha por mês e a soma sempre bate com o total. Experimente: o simulador usa a mesma
              conta do sistema.
            </p>
          </div>
          <Simulador />
        </section>

        <section id="painel" className="border-y border-line bg-sunken" aria-labelledby="titulo-painel">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <h2 id="titulo-painel" className="font-display max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
              Tudo o que você tem, e tudo o que você deve, numa tela só.
            </h2>
            <p className="mt-4 max-w-xl text-muted">Este é o painel que você abre todo dia, aqui com dados de exemplo.</p>
            <div className="mt-12">
              <Previa />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="titulo-recursos">
          <h2 id="titulo-recursos" className="font-display max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
            Feito para quem lança gasto todo dia.
          </h2>
          <dl className="mt-14 grid gap-x-16 md:grid-cols-2">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="border-t border-line py-7">
                <dt className="font-display text-2xl">{r.titulo}</dt>
                <dd className="mt-2 max-w-md text-muted">{r.texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="como-funciona" className="border-y border-line bg-sunken" aria-labelledby="titulo-passos">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <h2 id="titulo-passos" className="font-display max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
              Em três passos você está usando.
            </h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {PASSOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-5 md:block">
                  <span className="font-display num text-6xl leading-none text-gold-lo md:text-7xl" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="md:mt-5">
                    <h3 className="font-display text-2xl">{p.titulo}</h3>
                    <p className="mt-2 max-w-xs text-muted">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="seguranca" className="tinta relative overflow-hidden text-paper" aria-labelledby="titulo-seguranca">
          <Guilloche className="pointer-events-none absolute -right-40 -top-40 w-[44rem] max-w-none text-gold opacity-[0.08]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
            <div>
              <h2 id="titulo-seguranca" className="font-display text-4xl leading-[1.08] sm:text-5xl">
                Seus números ficam atrás de uma porta trancada.
              </h2>
              <p className="mt-5 max-w-md text-paper/70">
                Dinheiro é assunto pessoal. Por isso o acesso é fechado e a proteção existe em duas camadas: no site e no banco de dados.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {GARANTIAS.map((g) => (
                <div key={g.titulo} className="border-t border-gold/25 py-5">
                  <dt className="font-semibold text-gold-hi">{g.titulo}</dt>
                  <dd className="mt-1.5 text-sm text-paper/70">{g.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="titulo-faq">
          <h2 id="titulo-faq" className="font-display text-4xl sm:text-5xl">
            Perguntas frequentes
          </h2>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {PERGUNTAS.map((q) => (
              <details key={q.p} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <span className="shrink-0 text-2xl leading-none text-gold-lo transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-xl text-muted">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="tinta relative overflow-hidden rounded-[2rem] border border-gold/20 px-6 py-16 text-paper sm:px-14 sm:py-20">
            <Guilloche className="pointer-events-none absolute -right-24 -top-32 w-[34rem] max-w-none text-gold opacity-[0.12]" />
            <div className="relative">
              <h2 className="font-display max-w-xl text-4xl leading-[1.08] sm:text-5xl">Pronto para ver o seu número real?</h2>
              <Link href="/login" className="btn btn-gold mt-9 px-7 py-3.5 text-base">
                Acessar o painel
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-sm text-muted sm:px-6">
          <Logo tamanho={30} />
          <span>© {new Date().getFullYear()}. Todos os direitos reservados.</span>
        </div>
      </footer>
    </>
  );
}
