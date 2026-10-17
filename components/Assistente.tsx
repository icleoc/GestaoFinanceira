"use client";

import { useState } from "react";
import type { Destino, Insight, Nivel } from "@/lib/assistente";

const ESTILO: Record<Nivel, { barra: string; ponto: string; rotulo: string }> = {
  alerta: { barra: "border-l-neg", ponto: "bg-neg", rotulo: "Urgente" },
  atencao: { barra: "border-l-warn", ponto: "bg-warn", rotulo: "Atenção" },
  info: { barra: "border-l-primary", ponto: "bg-primary", rotulo: "Para saber" },
  bom: { barra: "border-l-accent", ponto: "bg-accent", rotulo: "Boa notícia" },
};

const ACAO: Record<Destino, string> = {
  extrato: "Ver no extrato",
  planejar: "Abrir planejamento",
  gerenciar: "Gerenciar",
  lancar: "Lançar agora",
};

interface Props {
  insights: Insight[];
  onIr: (destino: Destino) => void;
  /** Destinos que a pessoa pode usar (os outros não mostram botão). */
  permitidos: Destino[];
}

/** O que o assistente enxergou nos seus números, do mais urgente ao menos. */
export default function Assistente({ insights, onIr, permitidos }: Props) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? insights : insights.slice(0, 4);

  return (
    <section aria-labelledby="titulo-assistente">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="titulo-assistente" className="font-display text-xl font-semibold tracking-tight">
            Seu assistente financeiro
          </h2>
          <p className="text-sm text-muted">O que eu enxerguei nos seus números hoje.</p>
        </div>
        {insights.length > 4 && (
          <button onClick={() => setTodos((v) => !v)} className="btn btn-quiet px-3 py-1.5">
            {todos ? "Mostrar menos" : `Ver todos (${insights.length})`}
          </button>
        )}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {lista.map((i) => {
          const e = ESTILO[i.nivel];
          return (
            <li key={i.id} className={`panel pop-in border-l-4 p-4 ${e.barra}`}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <span className={`size-2 rounded-full ${e.ponto}`} aria-hidden />
                {e.rotulo}
              </p>
              <h3 className="mt-1.5 font-display text-base font-semibold leading-snug">{i.titulo}</h3>
              <p className="mt-1 text-sm text-muted">{i.texto}</p>
              {i.destino && permitidos.includes(i.destino) && (
                <button onClick={() => onIr(i.destino!)} className="mt-3 text-sm font-semibold text-accent hover:underline">
                  {ACAO[i.destino]} →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
