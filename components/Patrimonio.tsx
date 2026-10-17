import type { Kpis } from "@/lib/finance";
import { money } from "@/lib/format";
import Guilloche from "./Guilloche";

/**
 * Patrimônio líquido, no formato de um certificado: tinta escura, guilóchê ao fundo e o
 * número em champanhe. A barra mostra como os ativos (bancos + investimentos) se dividem;
 * a dívida dos cartões fica à parte, porque ela abate o patrimônio em vez de fazer parte dele.
 */
export default function Patrimonio({ kpis, animar = false, compacto = false }: { kpis: Kpis; animar?: boolean; compacto?: boolean }) {
  const ativos = Math.max(0, kpis.bancos) + Math.max(0, kpis.investimentos);
  const pctInvest = ativos > 0 ? (Math.max(0, kpis.investimentos) / ativos) * 100 : 0;
  const pctBancos = ativos > 0 ? 100 - pctInvest : 0;
  const dividaSobreAtivos = ativos > 0 ? Math.round((kpis.divida / ativos) * 100) : null;
  const negativo = kpis.patrimonio < 0;

  return (
    <section
      className={`tinta relative overflow-hidden rounded-[1.75rem] border border-gold/20 p-6 text-paper shadow-[0_30px_60px_-30px_rgb(6_38_43/0.55)] ${compacto ? "sm:p-8" : "sm:p-9"}`}
      aria-labelledby="titulo-patrimonio"
    >
      <Guilloche
        animar={animar}
        className={
          compacto
            ? "pointer-events-none absolute -right-24 -top-24 w-[16rem] max-w-none text-gold opacity-[0.1]"
            : "pointer-events-none absolute -right-28 -top-32 w-[30rem] max-w-none text-gold opacity-[0.22] sm:-right-16 sm:-top-40 sm:w-[38rem]"
        }
      />
      <div className="relative">
        <h2 id="titulo-patrimonio" className="text-sm font-medium text-paper/70">
          Patrimônio líquido
        </h2>
        <p
          className={`font-display num mt-2 leading-none ${compacto ? "text-[2.6rem] sm:text-[3.6rem]" : "text-[2.9rem] sm:text-[4.6rem]"} ${negativo ? "text-[rgb(242_120_110)]" : "texto-ouro"}`}
          style={{ fontWeight: 500, letterSpacing: "-0.03em" }}
        >
          {money(kpis.patrimonio)}
        </p>

        <div
          className="mt-8 flex h-1.5 max-w-xl gap-1 overflow-hidden rounded-full"
          role="img"
          aria-label={`Ativos: ${Math.round(pctBancos)}% em bancos e ${Math.round(pctInvest)}% em investimentos`}
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${pctBancos}%` }} />
          <div className="h-full rounded-full bg-[rgb(88_198_168)]" style={{ width: `${pctInvest}%` }} />
        </div>

        <dl className={`mt-6 grid grid-cols-1 gap-y-4 ${compacto ? "gap-x-6 sm:grid-cols-3" : "gap-x-10 sm:grid-cols-3"}`}>
          <Item cor="bg-gold" nome="Bancos" valor={money(kpis.bancos)} compacto={compacto} />
          <Item cor="bg-[rgb(88_198_168)]" nome="Investimentos" valor={money(kpis.investimentos)} compacto={compacto} />
          <Item
            cor="bg-[rgb(242_120_110)]"
            nome="Dívida nos cartões"
            valor={money(kpis.divida)}
            nota={dividaSobreAtivos !== null && kpis.divida > 0 ? `${dividaSobreAtivos}% dos ativos` : undefined}
            negativo={kpis.divida > 0}
            compacto={compacto}
          />
        </dl>
      </div>
    </section>
  );
}

function Item({
  cor,
  nome,
  valor,
  nota,
  negativo,
  compacto,
}: {
  cor: string;
  nome: string;
  valor: string;
  nota?: string;
  negativo?: boolean;
  compacto?: boolean;
}) {
  return (
    <div className="border-t border-paper/15 pt-3">
      <dt className="flex items-center gap-2 text-sm text-paper/70">
        <span className={`inline-block size-2 rounded-full ${cor}`} aria-hidden />
        {nome}
      </dt>
      <dd className={`font-display num mt-1 ${compacto ? "text-xl" : "text-2xl"} ${negativo ? "text-[rgb(242_150_140)]" : "text-paper"}`}>
        {valor}
        {nota && <span className="mt-0.5 block font-sans text-sm font-normal text-paper/60">{nota}</span>}
      </dd>
    </div>
  );
}
