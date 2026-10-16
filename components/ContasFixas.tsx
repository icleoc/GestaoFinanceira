"use client";

import { useState } from "react";
import type { ContaFixaPendente } from "@/lib/finance";
import { num } from "@/lib/finance";
import { money } from "@/lib/format";

interface Props {
  pendentes: ContaFixaPendente[];
  onLancar?: (p: ContaFixaPendente) => void;
}

/** Aviso fixo no topo (sem pulsar nem cobrir a tela) com as contas fixas do mês ainda sem lançamento. */
export default function ContasFixasPendentes({ pendentes, onLancar }: Props) {
  const [dispensado, setDispensado] = useState(false);
  if (pendentes.length === 0 || dispensado) return null;

  return (
    <section className="panel border-l-4 border-l-warn p-4 sm:p-5" aria-labelledby="titulo-pendentes">
      <div className="flex items-start justify-between gap-4">
        <h2 id="titulo-pendentes" className="font-display text-base font-semibold">
          {pendentes.length === 1 ? "1 conta fixa sem lançamento neste mês" : `${pendentes.length} contas fixas sem lançamento neste mês`}
        </h2>
        <button onClick={() => setDispensado(true)} className="text-sm text-muted underline-offset-2 hover:underline">
          Ocultar
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {pendentes.map((p) => (
          <li key={p.fixa.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
            <div>
              <span className="font-medium">{p.fixa.nome}</span>
              <span className="num ml-2 text-muted">{money(num(p.fixa.valor))}</span>
              <p className="text-sm text-muted">
                {p.atraso === 0 ? `vence hoje (dia ${p.fixa.dia_vencimento})` : `venceu dia ${p.fixa.dia_vencimento}, há ${p.atraso} ${p.atraso === 1 ? "dia" : "dias"}`}
              </p>
            </div>
            {onLancar && (
              <button onClick={() => onLancar(p)} className="btn btn-quiet px-3 py-1.5">
                Lançar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
