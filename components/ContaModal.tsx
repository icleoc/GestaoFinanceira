"use client";

import { useMemo, useState } from "react";
import type { Conta, Dados } from "@/lib/types";
import { addMonthsISO, monthOf, num, todayISO, usoCartao } from "@/lib/finance";
import { dateBR, money, monthLabel } from "@/lib/format";
import Modal from "./Modal";

/** Detalhes de uma conta ou cartão: situação, lançamentos do mês, o que ainda vai cair e gastos por categoria. */
export default function ContaModal({
  dados,
  conta,
  onClose,
  onExtrato,
}: {
  dados: Dados;
  conta: Conta;
  onClose: () => void;
  /** Abre o extrato completo (editar e apagar) já filtrado nesta conta. */
  onExtrato: (contaId: string, mes: string) => void;
}) {
  const hoje = todayISO();
  const [mes, setMes] = useState(monthOf(hoje));
  const ehCartao = conta.tipo === "Crédito";
  const nomeCategoria = useMemo(() => new Map(dados.categorias.map((c) => [String(c.id), c.nome])), [dados.categorias]);
  const titular = dados.membros?.find((m) => m.user_id === conta.titular_id);

  const daConta = useMemo(() => dados.transacoes.filter((t) => String(t.conta_origem_id) === String(conta.id)), [dados.transacoes, conta.id]);
  const doMes = useMemo(() => daConta.filter((t) => t.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id))), [daConta, mes]);
  const saidas = doMes.filter((t) => num(t.valor) < 0).reduce((s, t) => s + -num(t.valor), 0);
  const entradas = doMes.filter((t) => num(t.valor) > 0).reduce((s, t) => s + num(t.valor), 0);

  // Parcelas e despesas que ainda vão cair nesta conta (data depois de hoje), por mês.
  const futuras = useMemo(() => {
    const porMes = new Map<string, number>();
    for (const t of daConta) {
      if (t.data <= hoje || num(t.valor) >= 0) continue;
      porMes.set(monthOf(t.data), (porMes.get(monthOf(t.data)) ?? 0) + -num(t.valor));
    }
    return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);
  }, [daConta, hoje]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of doMes) {
      if (num(t.valor) >= 0 || t.categoria_id == null) continue;
      const nome = nomeCategoria.get(String(t.categoria_id)) ?? "Sem categoria";
      m.set(nome, (m.get(nome) ?? 0) + -num(t.valor));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [doMes, nomeCategoria]);

  const trocar = (n: number) => setMes((m) => monthOf(addMonthsISO(`${m}-01`, n)));
  const u = ehCartao ? usoCartao(conta) : null;
  const saldo = num(conta.saldo_atual);

  return (
    <Modal titulo={conta.nome} onClose={onClose} largura="lg">
      <div className="space-y-5 p-5">
        <div>
          <p className="text-sm text-muted">
            {[conta.tipo === "Crédito" ? "Cartão de crédito" : conta.tipo === "Investimento" ? "Investimento" : "Conta corrente", conta.final_cartao ? `•••• ${conta.final_cartao}` : null, conta.bandeira, titular?.nome]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {u ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.pct)} aria-label="Limite usado">
                <div className={`h-full rounded-full ${u.pct > 80 ? "bg-neg" : "bg-ink"}`} style={{ width: `${Math.min(100, u.pct)}%` }} />
              </div>
              <dl className="num mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="label !mb-0.5">Fatura</dt>
                  <dd className="font-display text-xl">{money(u.usado)}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Disponível</dt>
                  <dd className="font-display text-xl text-accent">{money(u.disponivel)}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Limite</dt>
                  <dd className="font-display text-xl">{money(u.limite)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-sm text-muted">
                {conta.dia_fechamento ? `Fecha dia ${conta.dia_fechamento} · ` : ""}
                {conta.dia_vencimento ? `vence dia ${conta.dia_vencimento}` : "sem dia de vencimento cadastrado"}
              </p>
            </>
          ) : (
            <p className={"num mt-2 font-display text-3xl " + (saldo < 0 ? "text-neg" : "")}>{money(saldo)}</p>
          )}
        </div>

        {futuras.length > 0 && (
          <section aria-label="Parcelas que ainda vão cair">
            <h3 className="font-display text-base font-semibold">{ehCartao ? "Parcelas a vencer" : "Lançamentos futuros"}</h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
              {futuras.map(([m, v]) => (
                <li key={m} className="flex justify-between px-3 py-2">
                  <span className="capitalize">{monthLabel(m)}</span>
                  <span className="num font-medium">{money(v)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Lançamentos do mês">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold">Lançamentos</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => trocar(-1)} className="btn btn-quiet px-2.5 py-1" aria-label="Mês anterior">
                ‹
              </button>
              <span className="min-w-28 text-center text-sm font-medium capitalize">{monthLabel(mes)}</span>
              <button onClick={() => trocar(1)} className="btn btn-quiet px-2.5 py-1" aria-label="Próximo mês">
                ›
              </button>
            </div>
          </div>
          <p className="num mt-1 text-sm text-muted">
            {ehCartao ? "Compras" : "Saídas"} <b className="text-ink">{money(saidas)}</b>
            {entradas > 0 && (
              <>
                {" "}
                · {ehCartao ? "Pagamentos e estornos" : "Entradas"} <b className="text-ink">{money(entradas)}</b>
              </>
            )}
          </p>
          {porCategoria.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Mais gastos: {porCategoria.map(([n, v]) => `${n} ${money(v)}`).join(" · ")}
            </p>
          )}
          {doMes.length === 0 ? (
            <p className="mt-3 rounded-xl bg-sunken p-4 text-sm text-muted">Nenhum lançamento neste mês.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {doMes.map((t) => (
                <li key={String(t.id)} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.descricao}</p>
                    <p className="text-xs text-muted">
                      {dateBR(t.data)}
                      {t.categoria_id != null ? ` · ${nomeCategoria.get(String(t.categoria_id)) ?? "Sem categoria"}` : ""}
                      {t.data > hoje ? " · agendada" : ""}
                    </p>
                  </div>
                  <span className={"num shrink-0 font-medium " + (num(t.valor) < 0 ? "" : "text-accent")}>{money(num(t.valor))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button onClick={() => onExtrato(String(conta.id), mes)} className="btn btn-quiet w-full py-3">
          Abrir no extrato completo (editar e apagar)
        </button>
      </div>
    </Modal>
  );
}
