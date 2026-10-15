"use client";

import { useState } from "react";
import { num, round2, splitInstallments } from "@/lib/finance";
import { money } from "@/lib/format";

/** Aceita "1234.56", "1234,56" e "1.234,56". */
function lerValor(texto: string): number {
  const s = texto.trim();
  if (!s) return 0;
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

function quando(i: number): string {
  if (i === 0) return "Hoje";
  return `Daqui a ${i} ${i === 1 ? "mês" : "meses"}`;
}

/**
 * Mostra, com a mesma conta que o sistema usa de verdade, como uma compra
 * parcelada vira uma linha por mês e a soma fecha no centavo.
 */
export default function Simulador() {
  const [valor, setValor] = useState("1000");
  const [parcelas, setParcelas] = useState(3);

  const total = round2(lerValor(valor));
  const partes = total > 0 ? splitInstallments(total, parcelas) : [];
  const soma = round2(partes.reduce((s, p) => s + p, 0));
  const temCentavos = partes.length > 1 && new Set(partes).size > 1;

  return (
    <section className="panel p-5 text-ink shadow-2xl sm:p-6" aria-labelledby="titulo-simulador">
      <h2 id="titulo-simulador" className="font-display text-lg font-semibold">
        Simule uma compra no cartão
      </h2>
      <p className="mt-1 text-sm text-muted">É assim que o sistema divide cada compra parcelada.</p>

      <div className="mt-5 grid grid-cols-5 items-end gap-3">
        <div className="col-span-2">
          <label htmlFor="sim-valor" className="label">
            Valor (R$)
          </label>
          <input
            id="sim-valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="field num"
          />
        </div>
        <div className="col-span-3">
          <label htmlFor="sim-parcelas" className="label">
            Parcelas: <b className="num font-semibold text-ink">{parcelas === 1 ? "à vista" : `${parcelas}x`}</b>
          </label>
          <input
            id="sim-parcelas"
            type="range"
            min={1}
            max={24}
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value))}
            className="h-11 w-full cursor-pointer accent-[rgb(var(--accent))]"
          />
        </div>
      </div>

      {partes.length === 0 ? (
        <p className="mt-5 rounded-xl bg-sunken p-4 text-sm text-muted">Digite um valor maior que zero para ver as parcelas.</p>
      ) : (
        <>
          <ol className="mt-5 max-h-52 divide-y divide-line overflow-y-auto rounded-xl bg-sunken px-4" aria-live="polite">
            {partes.map((p, i) => (
              <li
                key={`${parcelas}-${i}`}
                className="pop-in flex items-baseline justify-between gap-3 py-2 text-sm"
                style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
              >
                <span>
                  <span className="num font-medium">
                    {i + 1}/{partes.length}
                  </span>
                  <span className="ml-2 text-muted">{quando(i)}</span>
                </span>
                <span className="num font-semibold">{money(p)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted">Soma das parcelas</span>
            <span className="num font-display text-lg font-semibold">{money(soma)}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {temCentavos
              ? "Os centavos que sobram da divisão vão para as primeiras parcelas, e o total bate exato."
              : "Divisão exata: todas as parcelas têm o mesmo valor."}
          </p>
        </>
      )}
    </section>
  );
}
