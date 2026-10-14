import type { Kpis } from "@/lib/finance";
import { money } from "@/lib/format";

/**
 * Patrimônio líquido e de onde ele vem. A barra mostra como os ativos
 * (bancos + investimentos) se dividem; a dívida dos cartões fica à parte,
 * porque ela abate o patrimônio em vez de fazer parte dele.
 */
export default function Patrimonio({ kpis }: { kpis: Kpis }) {
  const ativos = Math.max(0, kpis.bancos) + Math.max(0, kpis.investimentos);
  const pctInvest = ativos > 0 ? (Math.max(0, kpis.investimentos) / ativos) * 100 : 0;
  const pctBancos = ativos > 0 ? 100 - pctInvest : 0;
  const dividaSobreAtivos = ativos > 0 ? Math.round((kpis.divida / ativos) * 100) : null;

  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="titulo-patrimonio">
      <h2 id="titulo-patrimonio" className="text-sm font-medium text-muted">
        Patrimônio líquido
      </h2>
      <p
        className={`font-display num mt-1 text-[2.6rem] font-semibold leading-none tracking-tight sm:text-6xl ${
          kpis.patrimonio < 0 ? "text-neg" : ""
        }`}
      >
        {money(kpis.patrimonio)}
      </p>

      <div
        className="mt-7 flex h-3 overflow-hidden rounded-full bg-sunken"
        role="img"
        aria-label={`Ativos: ${Math.round(pctBancos)}% em bancos e ${Math.round(pctInvest)}% em investimentos`}
      >
        <div className="h-full bg-accent" style={{ width: `${pctBancos}%` }} />
        <div className="h-full bg-primary" style={{ width: `${pctInvest}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <Item cor="bg-accent" nome="Bancos" valor={money(kpis.bancos)} />
        <Item cor="bg-primary" nome="Investimentos" valor={money(kpis.investimentos)} />
        <Item
          cor="bg-neg"
          nome="Dívida nos cartões"
          valor={money(kpis.divida)}
          nota={dividaSobreAtivos !== null && kpis.divida > 0 ? `${dividaSobreAtivos}% dos ativos` : undefined}
          negativo={kpis.divida > 0}
        />
      </dl>
    </section>
  );
}

function Item({
  cor,
  nome,
  valor,
  nota,
  negativo,
}: {
  cor: string;
  nome: string;
  valor: string;
  nota?: string;
  negativo?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-muted">
        <span className={`inline-block size-2.5 rounded-full ${cor}`} aria-hidden />
        {nome}
      </dt>
      <dd className={`font-display num mt-0.5 text-xl font-semibold ${negativo ? "text-neg" : ""}`}>
        {valor}
        {nota && <span className="ml-2 font-sans text-sm font-normal text-muted">{nota}</span>}
      </dd>
    </div>
  );
}
