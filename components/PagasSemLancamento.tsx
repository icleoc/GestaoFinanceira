"use client";

import type { Dados, DespesaFixa } from "@/lib/types";
import { monthOf, num } from "@/lib/finance";
import { money, monthLabel } from "@/lib/format";

/** Contas fixas marcadas como pagas (no "Já paguei" antigo) sem nenhum lançamento: não aparecem no extrato nem têm conta de origem. */
export function fixasPagasSemLancamento(dados: Dados): DespesaFixa[] {
  return dados.fixas.filter((f) => {
    if (!f.baixa_mes) return false;
    const nome = f.nome.trim().toLowerCase();
    if (!nome) return false;
    return !dados.transacoes.some((t) => num(t.valor) < 0 && t.data.startsWith(f.baixa_mes as string) && t.descricao.toLowerCase().includes(nome));
  });
}

export default function PagasSemLancamento({ dados, hoje, onRegistrar }: { dados: Dados; hoje: string; onRegistrar: (f: DespesaFixa) => void }) {
  const lista = fixasPagasSemLancamento(dados);
  if (lista.length === 0) return null;
  return (
    <section className="panel border-l-4 border-l-warn p-5" aria-labelledby="titulo-pagas-sem">
      <h2 id="titulo-pagas-sem" className="font-display text-lg font-semibold">
        Pagas sem registro no extrato
      </h2>
      <p className="mt-1 text-sm text-muted">
        Estas contas foram marcadas como pagas, mas ninguém informou de onde saiu o dinheiro. Registre para elas aparecerem no extrato e descontarem do saldo.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {lista.map((f) => (
          <li key={String(f.id)} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-medium">{f.nome}</p>
              <p className="text-sm text-muted">
                Paga em {monthLabel((f.baixa_mes as string) || monthOf(hoje))} · {money(Number(f.valor) || 0)}
              </p>
            </div>
            <button onClick={() => onRegistrar(f)} className="btn btn-primary shrink-0 px-3 py-1.5">
              Informar de onde saiu
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
