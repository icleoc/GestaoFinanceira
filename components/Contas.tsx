import type { Conta } from "@/lib/types";
import { agruparInvestimentos, num, usoCartao } from "@/lib/finance";
import { money } from "@/lib/format";

function Painel({ titulo, vazio, children }: { titulo: string; vazio?: string; children?: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{titulo}</h2>
      {children ?? <p className="mt-3 text-sm text-muted">{vazio}</p>}
    </section>
  );
}

export function Bancos({ contas }: { contas: Conta[] }) {
  const lista = contas.filter((c) => c.tipo === "Corrente");
  return (
    <Painel titulo="Contas correntes" vazio="Nenhuma conta ainda. Adicione uma em Gerenciar.">
      {lista.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {lista.map((c) => {
            const s = num(c.saldo_atual);
            return (
              <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <span>{c.nome}</span>
                <span className={`num font-semibold ${s < 0 ? "text-neg" : ""}`}>{money(s)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Painel>
  );
}

export function Cartoes({ contas }: { contas: Conta[] }) {
  const lista = contas.filter((c) => c.tipo === "Crédito");
  return (
    <Painel titulo="Cartões de crédito" vazio="Nenhum cartão ainda. Adicione um em Gerenciar.">
      {lista.length > 0 && (
        <ul className="mt-3 space-y-5">
          {lista.map((c) => {
            const u = usoCartao(c);
            const alto = u.pct > 80;
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-sm text-muted">
                    {c.dia_vencimento ? `vence dia ${c.dia_vencimento}` : "sem vencimento"}
                  </span>
                </div>
                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(u.pct)}
                  aria-label={`${c.nome}: ${Math.round(u.pct)}% do limite usado`}
                >
                  <div className={`h-full rounded-full ${alto ? "bg-neg" : "bg-primary"}`} style={{ width: `${u.pct}%` }} />
                </div>
                <p className="num mt-1.5 flex flex-wrap justify-between gap-x-4 text-sm text-muted">
                  <span>
                    Fatura <b className={`font-semibold ${u.usado > 0 ? "text-ink" : ""}`}>{money(u.usado)}</b>
                  </span>
                  <span>
                    Disponível <b className="font-semibold text-accent">{money(u.disponivel)}</b> de {money(u.limite)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Painel>
  );
}

export function Investimentos({ contas }: { contas: Conta[] }) {
  const { grupos, avulsos } = agruparInvestimentos(contas);
  const vazio = grupos.length === 0 && avulsos.length === 0;
  return (
    <Painel titulo="Investimentos" vazio="Nenhum investimento ainda. Adicione um em Gerenciar.">
      {!vazio && (
        <div className="mt-3 space-y-4">
          {grupos.map((g) => (
            <div key={g.nome} className="rounded-xl bg-sunken p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-semibold">{g.nome}</span>
                <span className="num font-display text-lg font-semibold">{money(g.total)}</span>
              </div>
              <ul className="mt-2 space-y-1 border-l-2 border-line pl-3">
                {g.itens.map(({ conta, rotulo }) => (
                  <li key={conta.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-muted">{rotulo}</span>
                    <span className="num font-medium">{money(num(conta.saldo_atual))}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {avulsos.length > 0 && (
            <ul className="divide-y divide-line">
              {avulsos.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span>{c.nome}</span>
                  <span className="num font-semibold">{money(num(c.saldo_atual))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Painel>
  );
}
