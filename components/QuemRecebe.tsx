"use client";

import type { Dados } from "@/lib/types";

type Pessoa = NonNullable<Dados["membros"]>[number];

/**
 * Escolha de quem recebe o alerta de uma conta. `valor` nulo = todas as pessoas da carteira.
 * Com uma pessoa só, não há o que escolher e nada aparece.
 */
export default function QuemRecebe({
  membros,
  valor,
  onChange,
  idBase,
}: {
  membros: Pessoa[];
  valor: string[] | null;
  onChange: (v: string[] | null) => void;
  idBase: string;
}) {
  if (membros.length < 2) return null;
  const todas = valor === null;
  const nomeDe = (m: Pessoa) => m.nome || m.email || "Pessoa";

  function alternar(id: string) {
    const atual = valor ?? membros.map((m) => m.user_id);
    const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
    // Todos marcados volta a ser "todas as pessoas" (inclusive quem entrar depois).
    onChange(novo.length === membros.length ? null : novo);
  }

  return (
    <fieldset>
      <legend className="label">Quem recebe o alerta de vencimento</legend>
      <label htmlFor={`${idBase}-todas`} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
        <input
          id={`${idBase}-todas`}
          type="checkbox"
          checked={todas}
          onChange={(e) => onChange(e.target.checked ? null : [])}
          className="size-4 accent-[rgb(var(--accent))]"
        />
        Todas as pessoas
      </label>
      <ul className="ml-6 space-y-0.5">
        {membros.map((m) => (
          <li key={m.user_id}>
            <label htmlFor={`${idBase}-${m.user_id}`} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
              <input
                id={`${idBase}-${m.user_id}`}
                type="checkbox"
                checked={todas || (valor?.includes(m.user_id) ?? false)}
                onChange={() => alternar(m.user_id)}
                className="size-4 accent-[rgb(var(--accent))]"
              />
              {nomeDe(m)}
            </label>
          </li>
        ))}
      </ul>
      {valor !== null && valor.length === 0 && <p className="mt-1 text-xs font-medium text-warn">Escolha pelo menos uma pessoa. Sem escolha, todas recebem.</p>}
    </fieldset>
  );
}
