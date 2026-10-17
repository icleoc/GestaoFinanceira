import type { GastoPorCategoria } from "@/lib/finance";
import { money, monthLabel } from "@/lib/format";

interface Props {
  mes: string;
  gastos: GastoPorCategoria[];
  receitas: number;
  despesas: number;
}

/** Para onde o dinheiro foi no mês, da maior categoria para a menor. */
export default function GastosDoMes({ mes, gastos, receitas, despesas }: Props) {
  const total = gastos.reduce((s, g) => s + g.total, 0);
  const maior = gastos[0]?.total ?? 0;
  const resultado = receitas - despesas;

  return (
    <section className="panel p-5 sm:p-7" aria-labelledby="titulo-gastos">
      <h2 id="titulo-gastos" className="font-display text-xl">
        Para onde foi em {monthLabel(mes)}
      </h2>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-line text-sm">
        <Resumo nome="Entrou" valor={money(receitas)} cor="text-accent" />
        <Resumo nome="Saiu" valor={money(despesas)} />
        <Resumo
          nome={resultado >= 0 ? "Sobrou" : "Faltou"}
          valor={money(Math.abs(resultado))}
          cor={resultado >= 0 ? "text-accent" : "text-neg"}
        />
      </dl>

      {gastos.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Nenhuma despesa com categoria neste mês.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {gastos.map((g) => (
            <li key={g.nome}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{g.nome}</span>
                <span className="num shrink-0">
                  {money(g.total)}
                  <span className="ml-2 text-muted">{Math.round((g.total / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-ink" style={{ width: `${(g.total / maior) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Resumo({ nome, valor, cor = "" }: { nome: string; valor: string; cor?: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <dt className="text-muted">{nome}</dt>
      <dd className={`num font-display mt-0.5 text-lg sm:text-xl ${cor}`}>{valor}</dd>
    </div>
  );
}
