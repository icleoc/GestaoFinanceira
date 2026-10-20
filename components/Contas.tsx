import type { Conta } from "@/lib/types";
import { agruparInvestimentos, num, usoCartao } from "@/lib/finance";
import { money } from "@/lib/format";
import { Linha } from "./Razao";

function Painel({
  titulo,
  total,
  vazio,
  children,
}: {
  titulo: string;
  total?: string;
  vazio?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl">{titulo}</h2>
        {total && <span className="num text-sm text-muted">{total}</span>}
      </div>
      {children ?? <p className="mt-3 text-sm text-muted">{vazio}</p>}
    </section>
  );
}

export function Bancos({ contas }: { contas: Conta[] }) {
  const lista = contas.filter((c) => c.tipo === "Corrente");
  const soma = lista.reduce((s, c) => s + num(c.saldo_atual), 0);
  return (
    <Painel
      titulo="Contas correntes"
      total={lista.length > 0 ? money(soma) : undefined}
      vazio="Nenhuma conta ainda. Adicione uma em Gerenciar."
    >
      {lista.length > 0 && (
        <div className="mt-2 divide-y divide-transparent">
          {lista.map((c) => {
            const s = num(c.saldo_atual);
            return <Linha key={c.id} nome={c.nome} valor={<span className={s < 0 ? "text-neg" : ""}>{money(s)}</span>} />;
          })}
        </div>
      )}
    </Painel>
  );
}

export function Cartoes({ contas, membros = [] }: { contas: Conta[]; membros?: { user_id: string; nome: string | null; email: string | null }[] }) {
  const lista = contas.filter((c) => c.tipo === "Crédito");
  const fatura = lista.reduce((s, c) => s + usoCartao(c).usado, 0);
  return (
    <Painel
      titulo="Cartões de crédito"
      total={lista.length > 0 ? `${money(fatura)} em faturas` : undefined}
      vazio="Nenhum cartão ainda. Adicione um em Gerenciar."
    >
      {lista.length > 0 && (
        <ul className="mt-4 space-y-6">
          {lista.map((c) => {
            const u = usoCartao(c);
            const alto = u.pct > 80;
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-semibold">
                    {c.nome}
                    {c.final_cartao && <span className="num ml-2 text-sm font-normal text-muted">•••• {c.final_cartao}</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {c.dia_fechamento ? `fecha dia ${c.dia_fechamento} · ` : ""}
                    {c.dia_vencimento ? `vence dia ${c.dia_vencimento}` : "sem vencimento"}
                  </span>
                </div>
                {(c.bandeira || c.titular_id) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {[c.bandeira, membros.find((m) => m.user_id === c.titular_id)?.nome].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div
                  className="relative mt-2.5 h-1.5 rounded-full bg-sunken"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(u.pct)}
                  aria-label={`${c.nome}: ${Math.round(u.pct)}% do limite usado`}
                >
                  <div
                    className={`h-full rounded-full ${alto ? "bg-neg" : "bg-ink"}`}
                    style={{ width: `${Math.min(100, u.pct)}%` }}
                  />
                  {/* marca dos 80% do limite */}
                  <span className="absolute -top-1 bottom-[-4px] w-px bg-ink/30" style={{ left: "80%" }} aria-hidden />
                </div>
                <p className="num mt-2 flex flex-wrap justify-between gap-x-4 text-sm text-muted">
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
  const soma = contas.filter((c) => c.tipo === "Investimento").reduce((s, c) => s + num(c.saldo_atual), 0);
  return (
    <Painel
      titulo="Investimentos"
      total={!vazio ? money(soma) : undefined}
      vazio="Nenhum investimento ainda. Adicione um em Gerenciar."
    >
      {!vazio && (
        <div className="mt-2 space-y-3">
          {grupos.map((g) => (
            <div key={g.nome}>
              <Linha nome={g.nome} valor={money(g.total)} destaque />
              <div className="ml-3 border-l border-line pl-3 text-sm text-muted">
                {g.itens.map(({ conta, rotulo }) => (
                  <div key={conta.id} className="razao py-1">
                    <span className="min-w-0 truncate">{rotulo}</span>
                    <span className="razao-pontos" aria-hidden />
                    <span className="num shrink-0 font-medium text-ink">{money(num(conta.saldo_atual))}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {avulsos.map((c) => (
            <Linha key={c.id} nome={c.nome} valor={money(num(c.saldo_atual))} destaque />
          ))}
        </div>
      )}
    </Painel>
  );
}
