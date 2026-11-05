"use client";

import type { CotacaoDia } from "@/lib/cotacoes";
import { dateBR } from "@/lib/format";
import { formatarTaxa, simboloDe } from "@/lib/cambio";

const NOMES: Record<string, string> = { USD: "Dólar", EUR: "Euro" };

/** Cotação do dia do dólar e do euro em reais, com a variação sobre o dia útil anterior. */
export default function CotacaoCard({ cotacoes, carregando }: { cotacoes: Record<string, CotacaoDia>; carregando: boolean }) {
  const moedas = ["USD", "EUR"];
  const dia = moedas.map((m) => cotacoes[m]?.dia).find(Boolean);
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="titulo-cotacao">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-cotacao" className="font-display text-base font-semibold">
          Cotação do dia
        </h2>
        {dia && <span className="text-xs text-muted">{dateBR(dia)}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {moedas.map((m) => {
          const c = cotacoes[m];
          const delta = c && c.anterior ? ((c.taxa - c.anterior) / c.anterior) * 100 : null;
          return (
            <div key={m}>
              <p className="label !mb-0.5">
                {NOMES[m]} ({simboloDe(m)})
              </p>
              {c ? (
                <>
                  <p className="num font-display text-2xl">R$ {formatarTaxa(c.taxa)}</p>
                  {delta !== null && (
                    <p className={"num text-xs font-medium " + (delta >= 0 ? "text-accent" : "text-neg")}>
                      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% sobre o dia anterior
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">{carregando ? "Buscando…" : "Indisponível agora"}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
