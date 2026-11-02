"use client";

import { useMemo, useState } from "react";
import type { Dados } from "@/lib/types";
import { addMonthsISO, daysInMonth, monthOf, parseISO } from "@/lib/finance";
import { vencimentosDoMes, type VencimentoDoMes } from "@/lib/vencimentos";
import { dateBR, money } from "@/lib/format";
import Modal from "./Modal";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const pad = (n: number) => String(n).padStart(2, "0");

const COR: Record<VencimentoDoMes["estado"], string> = { paga: "bg-accent", atrasada: "bg-neg", aberta: "bg-warn" };
const ROTULO: Record<VencimentoDoMes["estado"], string> = { paga: "paga", atrasada: "atrasada", aberta: "a vencer" };

/** Calendário do mês com as contas de cada dia. Toque num dia para ver os detalhes. */
export default function CalendarioVencimentos({ dados, hoje }: { dados: Dados; hoje: string }) {
  const [ym, setYm] = useState(monthOf(hoje));
  const [dia, setDia] = useState<string | null>(null);
  const itens = useMemo(() => vencimentosDoMes({ fixas: dados.fixas, transacoes: dados.transacoes, dividas: dados.dividas }, ym, hoje), [dados, ym, hoje]);
  const porDia = useMemo(() => {
    const m = new Map<string, VencimentoDoMes[]>();
    for (const v of itens) m.set(v.data, [...(m.get(v.data) ?? []), v]);
    return m;
  }, [itens]);

  const [y, m] = parseISO(`${ym}-01`);
  const primeiroDiaSemana = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const total = daysInMonth(y, m);
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const mover = (n: number) => setYm(monthOf(addMonthsISO(`${ym}-01`, n)));
  const doDia = dia ? (porDia.get(dia) ?? []) : [];
  const abertos = itens.filter((v) => v.estado !== "paga");
  const totalAberto = abertos.reduce((s, v) => s + v.valor, 0);

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="titulo-calendario">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-calendario" className="font-display text-base font-semibold">
            Calendário de vencimentos
          </h2>
          <p className="text-sm text-muted">
            {abertos.length === 0 ? "Nada em aberto neste mês." : `${abertos.length} ${abertos.length === 1 ? "conta em aberto" : "contas em aberto"} neste mês, ${money(totalAberto)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => mover(-1)} className="btn btn-quiet px-3 py-1.5" aria-label="Mês anterior">
            ‹
          </button>
          <span className="min-w-[8.5rem] text-center font-medium capitalize">
            {MESES[m - 1]} de {y}
          </span>
          <button onClick={() => mover(1)} className="btn btn-quiet px-3 py-1.5" aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wide text-muted" aria-hidden="true">
        {DIAS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celulas.map((n, i) => {
          if (n === null) return <span key={`v${i}`} />;
          const data = `${ym}-${pad(n)}`;
          const lista = porDia.get(data) ?? [];
          const ehHoje = data === hoje;
          const base = "flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors ";
          if (lista.length === 0) {
            return (
              <span key={n} className={base + (ehHoje ? "bg-sunken font-semibold ring-1 ring-gold" : "text-muted")}>
                {n}
              </span>
            );
          }
          const estados = [...new Set(lista.map((v) => v.estado))];
          return (
            <button
              key={n}
              onClick={() => setDia(data)}
              className={base + "bg-sunken font-semibold hover:bg-line " + (ehHoje ? "ring-1 ring-gold" : "")}
              aria-label={`Dia ${n}: ${lista.length} ${lista.length === 1 ? "conta" : "contas"}`}
            >
              {n}
              <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
                {estados.map((e) => (
                  <span key={e} className={`size-1.5 rounded-full ${COR[e]}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" />a vencer</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neg" />atrasada</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />paga</span>
      </p>

      {dia && (
        <Modal titulo={dateBR(dia)} onClose={() => setDia(null)} largura="md">
          <div className="p-5">
            {doDia.length === 0 ? (
              <p className="text-muted">Nenhuma conta neste dia.</p>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {doDia.map((v, i) => (
                    <li key={`${v.chave}-${i}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{v.nome}</p>
                        <p className="text-sm text-muted">
                          {v.origem === "divida" ? `Parcela ${v.indice}/${v.total}` : "Conta fixa"}
                          {v.origem === "fixa" && dados.fixas.find((f) => `fixa:${f.id}` === v.chave)?.flutuante ? " · valor variável" : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num font-medium">{money(v.valor)}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${v.estado === "paga" ? "bg-accent/10 text-accent" : v.estado === "atrasada" ? "bg-neg/10 text-neg" : "bg-warn/15 text-warn"}`}>
                          {ROTULO[v.estado]}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
                  <span>Total do dia</span>
                  <span className="num">{money(doDia.reduce((s, v) => s + v.valor, 0))}</span>
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
