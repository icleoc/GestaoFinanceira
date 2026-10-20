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
    titulo: "Foto da nota e pronto",
    texto: "Escolha de onde saiu o dinheiro e tire a foto. O sistema lê a empresa, os itens e o total, e já registra a despesa. Errou? Um toque em desfazer.",
  },
  {
    titulo: "Categoria automática",
    texto: "Padaria, restaurante e lanchonete viram Alimentação; posto vira Combustível; farmácia vira Saúde. Se a categoria não existir, ela é criada.",
  },
  {
    titulo: "Entre com Face ID",
    texto: "Ative uma vez no celular e abra o app só com o rosto ou a digital, sem digitar e-mail e senha. Funciona também com Touch ID e Windows Hello.",
  },
  {
    titulo: "Assistente que fala",
    texto: "Toque em um botão e ouça o resumo do dia: patrimônio, o que entrou e saiu no mês, onde você mais gastou e o que está por vencer.",
  },
  {
    titulo: "Um assistente que explica seus gastos",
    texto: "Mostra onde você mais gasta, o que subiu acima da média, o ritmo do mês e o que já está comprometido em parcelas.",
  },
  {
    titulo: "Salário em euro, dólar ou outra moeda",
    texto: "Escolha a moeda ao lançar a receita. A conversão usa a cotação do dia e guarda o valor original e a taxa usada.",
  },
  {
    titulo: "Planeje antes de comprar",
    texto: "Liste o que quer comprar, à vista, parcelado ou financiado, e veja quanto cada compra pesa na sua renda.",
  },
  {
    titulo: "Cartões sob controle",
    texto: "Bandeira, final, fechamento, vencimento, fatura e limite disponível de cada cartão, e quanto cada pessoa da família gastou nele.",
  },
  {
    titulo: "Patrimônio de verdade",
    texto: "Bancos mais investimentos, menos a dívida dos cartões. Um número que não esconde a fatura.",
  },
  {
    titulo: "Financiamentos e empréstimos",
    texto: "Informe o valor do bem, as parcelas e o valor delas: o app mostra quanto você paga de juros e o valor final. Dívida que já está andando entra com as parcelas pagas, sem mexer nos relatórios de hoje.",
  },
  {
    titulo: "Edite qualquer lançamento",
    texto: "Errou o valor, a conta ou a categoria? Corrija no extrato, e o saldo se ajusta sozinho.",
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
    titulo: "Extrato com a nota à mão",
    texto: "Veja a foto e os itens lidos de cada compra, corrija valor, categoria ou data, filtre por mês, conta e por quem lançou.",
  },
  {
    titulo: "Instale no celular",
    texto: "Adicione à tela inicial e use como um aplicativo, em tela cheia, com ícone próprio.",
  },
];

const FAMILIA = [
  { nome: "Você", papel: "Dono", detalhe: "Vê e muda tudo", gasto: 2310, limite: 2600 },
  { nome: "Ana", papel: "Administradora", detalhe: "Lança, edita e planeja", gasto: 1150, limite: 2400 },
  { nome: "Pedro", papel: "Filho", detalhe: "Só lança despesas", gasto: 420, limite: 400 },
];

const PASSOS = [
  { titulo: "Cadastre suas contas", texto: "Bancos, cartões (com limite e vencimento) e investimentos." },
  { titulo: "Lance o que entra e sai", texto: "Despesa, receita, transferência ou investimento, à vista ou parcelado." },
  { titulo: "Acompanhe o mês", texto: "Patrimônio, faturas e gastos por categoria atualizados a cada lançamento." },
];

const GARANTIAS = [
  { titulo: "Login com e-mail e senha", texto: "Sem entrar, nenhuma tela do painel abre." },
  { titulo: "Dados separados por cliente", texto: "Cada carteira só aparece para as pessoas que fazem parte dela. Ninguém vê a carteira de outro cliente." },
  { titulo: "Família com permissões e limite", texto: "Convide pessoas, escolha o que cada uma pode fazer e defina quanto cada uma pode gastar por mês." },
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
    p: "Dá para pagar com o celular, por aproximação?",
    r: "Não. O Jarvis Finance é para controlar e entender os gastos, não é um meio de pagamento. Você paga com o cartão ou a carteira digital de sempre e registra no sistema, de preferência com a foto da nota.",
  },
  {
    p: "Posso ter minha família no mesmo painel?",
    r: "Sim. Você convida cada pessoa, escolhe o que ela pode fazer e pode definir um limite de gasto mensal para ela. Quando o limite é atingido, a pessoa vê o aviso.",
  },
  {
    p: "Posso ver como é antes de contratar?",
    r: "Sim. A demonstração abre o painel completo com uma família fictícia. Você pode lançar, editar e testar tudo; nada é salvo.",
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
              <a href="#familia" className="hidden text-paper/75 hover:text-paper sm:inline">
                Família
              </a>
              <a href="#seguranca" className="hidden text-paper/75 hover:text-paper sm:inline">
                Segurança
              </a>
              <Link href="/demo" className="hidden text-paper/75 hover:text-paper sm:inline">
                Demonstração
              </Link>
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
                <Link href="/demo" className="btn btn-gold px-7 py-3.5 text-base">
                  Ver a demonstração
                </Link>
                <Link href="/login" className="text-sm font-semibold text-paper/80 underline decoration-gold/60 underline-offset-4 hover:text-paper">
                  Já tenho acesso
                </Link>
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

        <section id="familia" className="border-y border-line bg-sunken" aria-labelledby="titulo-familia">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <h2 id="titulo-familia" className="font-display max-w-md text-4xl leading-[1.08] sm:text-5xl">
                A família inteira no mesmo painel, cada um no seu limite.
              </h2>
              <p className="mt-5 max-w-md text-lg text-muted">
                Convide o cônjuge, os filhos ou quem ajuda a cuidar das contas. Você escolhe o que cada pessoa pode fazer e quanto ela pode gastar por mês.
              </p>
              <ul className="mt-6 max-w-md space-y-3 text-muted">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-lo" aria-hidden />
                  Permissões por pessoa: só ver, lançar, editar, gerenciar contas ou planejar.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-lo" aria-hidden />
                  Limite de gasto mensal: a pessoa vê &ldquo;você atingiu seu limite de gasto mensal&rdquo; ao chegar lá.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-lo" aria-hidden />
                  Extrato mostra quem lançou cada compra, e cada cartão mostra quem gastou quanto.
                </li>
              </ul>
              <Link href="/demo" className="btn btn-primary mt-8 px-6 py-3">
                Ver na demonstração
              </Link>
            </div>
            <div className="panel space-y-5 p-6" aria-label="Exemplo de limites da família">
              {FAMILIA.map((m) => {
                const pct = Math.round((m.gasto / m.limite) * 100);
                const estourou = pct >= 100;
                const perto = pct >= 80;
                return (
                  <div key={m.nome}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">
                        {m.nome} <span className="text-sm text-muted">· {m.papel}</span>
                      </p>
                      <p className="num text-sm text-muted">
                        R$ {m.gasto.toLocaleString("pt-BR")} de R$ {m.limite.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${pct}% do limite`}>
                      <div className={`h-full rounded-full ${estourou ? "bg-neg" : perto ? "bg-gold-lo" : "bg-accent"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className={`mt-1.5 text-sm ${estourou ? "font-semibold text-neg" : "text-muted"}`}>
                      {estourou ? "Você atingiu seu limite de gasto mensal." : m.detalhe}
                    </p>
                  </div>
                );
              })}
              <p className="text-xs text-muted">Exemplo ilustrativo.</p>
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="titulo-passos">
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
              <h2 id="comecar" className="font-display max-w-xl text-4xl leading-[1.08] sm:text-5xl">
                Pronto para ver o seu número real?
              </h2>
              <p className="mt-4 max-w-lg text-paper/70">
                Abra o painel completo com uma família fictícia e mexa em tudo: lance despesas, leia uma nota, defina limites. Nada é salvo.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link href="/demo" className="btn btn-gold px-7 py-3.5 text-base">
                  Experimentar o painel agora
                </Link>
                <Link href="/login" className="btn border border-gold/50 px-7 py-3.5 text-base text-gold-hi hover:bg-gold/10">
                  Já tenho acesso
                </Link>
              </div>
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
