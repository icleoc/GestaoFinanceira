import type { PontoMensal } from "@/lib/assistente";
import { moneyShort } from "@/lib/format";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Receitas e despesas dos últimos meses, lado a lado. */
export default function Evolucao({ serie, mesAtual }: { serie: PontoMensal[]; mesAtual: string }) {
  const maximo = Math.max(1, ...serie.flatMap((p) => [p.receitas, p.despesas]));
  const L = 560;
  const A = 190;
  const base = A - 26;
  const largura = L / serie.length;
  const altura = (v: number) => Math.max(v > 0 ? 3 : 0, (v / maximo) * (base - 18));

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="titulo-evolucao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-evolucao" className="font-display text-lg font-semibold">
          Entradas e saídas
        </h2>
        <p className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent" aria-hidden /> Receitas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-neg/80" aria-hidden /> Despesas
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} className="mt-3 w-full" role="img" aria-label="Receitas e despesas dos últimos meses">
        <line x1="0" x2={L} y1={base} y2={base} stroke="rgb(var(--line))" />
        {serie.map((p, i) => {
          const x = i * largura;
          const ativo = p.mes === mesAtual;
          const hR = altura(p.receitas);
          const hD = altura(p.despesas);
          const bw = Math.min(26, largura / 3);
          const [, m] = p.mes.split("-").map(Number);
          return (
            <g key={p.mes} opacity={ativo ? 1 : 0.78}>
              <rect x={x + largura / 2 - bw - 2} y={base - hR} width={bw} height={hR} rx="4" fill="rgb(var(--accent))" />
              <rect x={x + largura / 2 + 2} y={base - hD} width={bw} height={hD} rx="4" fill="rgb(var(--neg))" opacity="0.8" />
              {p.receitas > 0 && (
                <text x={x + largura / 2 - bw / 2 - 2} y={base - hR - 5} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
                  {moneyShort(p.receitas).replace("R$", "").trim()}
                </text>
              )}
              {p.despesas > 0 && (
                <text x={x + largura / 2 + bw / 2 + 2} y={base - hD - 5} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
                  {moneyShort(p.despesas).replace("R$", "").trim()}
                </text>
              )}
              <text x={x + largura / 2} y={A - 8} textAnchor="middle" fontSize="12" fontWeight={ativo ? 700 : 400} fill="rgb(var(--ink))">
                {MESES[m - 1]}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
