"use client";

import { useMemo, useState } from "react";
import type { Dados, Divida } from "@/lib/types";
import { calcular, resumir, situacao } from "@/lib/divida";
import { excluirDivida, pagarParcela } from "@/lib/data";
import { dateBR, money } from "@/lib/format";
import { num, todayISO } from "@/lib/finance";
import { Linha } from "./Razao";

interface Props {
  dados: Dados;
  podeGerenciar: boolean;
  podeLancar: boolean;
  onNova: () => void;
  onEditar: (d: Divida) => void;
  onMudou: (mensagem: string) => void;
}

/** Área de financiamentos e empréstimos: o que falta pagar, os juros e a próxima parcela de cada um. */
export default function Dividas({ dados, podeGerenciar, podeLancar, onNova, onEditar, onMudou }: Props) {
  const hoje = todayISO();
  const dividas = dados.dividas ?? [];
  const resumo = useMemo(() => resumir(dividas, hoje), [dividas, hoje]);
  const abertas = dividas.filter((d) => !situacao(d, hoje).quitada);
  const quitadas = dividas.filter((d) => situacao(d, hoje).quitada);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl" style={{ letterSpacing: "-0.02em" }}>
            Financiamentos e empréstimos
          </h2>
          <p className="mt-1 max-w-xl text-muted">O que você deve, quanto de juros está pagando e quando vence a próxima parcela.</p>
        </div>
        {podeGerenciar && (
          <button onClick={onNova} className="btn btn-primary">
            + Adicionar
          </button>
        )}
      </div>

      {dividas.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-xl">Nenhum financiamento ou empréstimo ainda.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Já tem um em andamento? Cadastre com a data da 1ª parcela e marque as antigas como pagas depois. Elas não entram no extrato nem nos relatórios do mês.
          </p>
          {podeGerenciar && (
            <button onClick={onNova} className="btn btn-primary mt-5">
              Cadastrar o primeiro
            </button>
          )}
        </div>
      ) : (
        <>
          <section className="panel p-5" aria-label="Resumo das dívidas">
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="label">Você paga por mês</p>
                <p className="num font-display text-3xl">{money(resumo.mensal)}</p>
              </div>
              <div>
                <p className="label">Falta pagar</p>
                <p className="num font-display text-3xl">{money(resumo.faltaPagar)}</p>
              </div>
              <div>
                <p className="label">Juros ainda por pagar</p>
                <p className="num font-display text-3xl text-neg">{money(resumo.jurosRestantes)}</p>
              </div>
            </div>
            {resumo.atrasadas > 0 && (
              <p role="alert" className="mt-4 text-sm font-semibold text-neg">
                {resumo.atrasadas === 1 ? "1 parcela venceu" : `${resumo.atrasadas} parcelas venceram`} e não consta como paga.
              </p>
            )}
          </section>

          <ul className="grid gap-5 lg:grid-cols-2">
            {abertas.map((d) => (
              <Cartao key={d.id} d={d} dados={dados} hoje={hoje} podeGerenciar={podeGerenciar} podeLancar={podeLancar} onEditar={onEditar} onMudou={onMudou} />
            ))}
          </ul>

          {quitadas.length > 0 && (
            <details className="panel p-5">
              <summary className="cursor-pointer font-semibold">Quitados ({quitadas.length})</summary>
              <ul className="mt-4 grid gap-5 lg:grid-cols-2">
                {quitadas.map((d) => (
                  <Cartao key={d.id} d={d} dados={dados} hoje={hoje} podeGerenciar={podeGerenciar} podeLancar={podeLancar} onEditar={onEditar} onMudou={onMudou} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Cartao({ d, dados, hoje, podeGerenciar, podeLancar, onEditar, onMudou }: { d: Divida; dados: Dados; hoje: string; podeGerenciar: boolean; podeLancar: boolean } & Pick<Props, "onEditar" | "onMudou">) {
  const s = situacao(d, hoje);
  const c = calcular({ valorBem: num(d.valor_bem), entrada: num(d.entrada), parcelas: d.parcelas, valorParcela: num(d.valor_parcela) });
  const [pagando, setPagando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const contas = dados.contas.filter((x) => x.tipo !== "Investimento");
  const [lancar, setLancar] = useState(true);
  const [contaId, setContaId] = useState(d.conta_id != null ? String(d.conta_id) : contas[0] ? String(contas[0].id) : "");
  const [data, setData] = useState(hoje);
  const [qtd, setQtd] = useState("1");

  async function pagar() {
    setErro("");
    const conta = contas.find((x) => String(x.id) === contaId);
    if (lancar && !conta) return setErro("Escolha a conta de onde saiu o pagamento.");
    const quantas = lancar ? 1 : Math.min(s.restantes, Math.max(1, Math.trunc(Number(qtd) || 1)));
    setOcupado(true);
    let feitas = 0;
    try {
      for (let i = 0; i < quantas; i++) {
        await pagarParcela({ ...d, parcelas_pagas: d.parcelas_pagas + i }, { lancar, contaId: conta?.id ?? null, categoriaId: d.categoria_id ?? null, data });
        feitas++;
      }
      setPagando(false);
      onMudou(lancar ? `Parcela ${s.pagas + 1}/${s.total} paga e lançada no extrato.` : quantas === 1 ? `Parcela ${s.pagas + 1}/${s.total} marcada como paga.` : `${quantas} parcelas marcadas como pagas.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pagar.");
      if (feitas > 0) onMudou(`${feitas} parcela(s) marcada(s) antes do erro.`);
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    try {
      await excluirDivida(d.id);
      onMudou("Removido. Os lançamentos já feitos continuam no extrato.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
      setOcupado(false);
    }
  }

  return (
    <li className="panel list-none p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-2xl">{d.nome}</h3>
          <p className="text-sm text-muted">{d.tipo === "emprestimo" ? "Empréstimo" : "Financiamento"}</p>
        </div>
        <div className="text-right">
          <p className="num font-display text-2xl">
            {s.pagas}/{s.total}
          </p>
          <p className="text-xs text-muted">parcelas pagas</p>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${s.pctPago}% pago`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${s.pctPago}%` }} />
      </div>

      {s.proxima ? (
        <p className={`mt-4 rounded-xl p-3 text-sm ${s.atrasadas > 0 ? "bg-neg/10 text-neg" : "bg-sunken"}`}>
          {s.atrasadas > 0 ? (
            <strong>{s.atrasadas === 1 ? "Parcela atrasada" : `${s.atrasadas} parcelas atrasadas`}: </strong>
          ) : (
            <strong>Próxima parcela: </strong>
          )}
          {s.proxima.indice}/{s.total} em {dateBR(s.proxima.data)}, <span className="num font-semibold">{money(num(d.valor_parcela))}</span>
        </p>
      ) : (
        <p className="mt-4 rounded-xl bg-accent/10 p-3 text-sm font-semibold text-accent">Quitado. Todas as parcelas foram pagas.</p>
      )}

      <div className="mt-3 divide-y divide-line">
        <Linha nome="Falta pagar" valor={money(s.faltaPagar)} />
        {!s.quitada && <Linha nome="Para quitar hoje (sem juros futuros)" valor={money(s.saldoParaQuitar)} />}
        <Linha nome={d.tipo === "emprestimo" ? "Valor emprestado" : "Valor do bem"} valor={money(num(d.valor_bem))} />
        {num(d.entrada) > 0 && <Linha nome="Entrada" valor={money(num(d.entrada))} />}
        <Linha nome="Juros do contrato" valor={money(Math.max(0, c.juros))} nota={c.taxaMensalPct > 0 ? `${c.jurosPct.toLocaleString("pt-BR")}% sobre o valor financiado · ${c.taxaMensalPct.toLocaleString("pt-BR")}% ao mês` : undefined} />
        <Linha nome="Valor final" valor={money(c.totalPago)} destaque />
      </div>

      {pagando && (
        <div className="mt-4 space-y-3 rounded-xl border border-line p-4">
          <p className="font-semibold">
            Pagar a parcela {s.proxima?.indice}/{s.total}
          </p>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name={`modo-${d.id}`} checked={lancar} onChange={() => setLancar(true)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
            <span>
              Lançar no extrato
              <span className="block text-muted">Tira {money(num(d.valor_parcela))} da conta e entra nos relatórios deste mês.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name={`modo-${d.id}`} checked={!lancar} onChange={() => { setLancar(false); setQtd(String(Math.max(1, s.atrasadas))); }} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
            <span>
              Só marcar como paga
              <span className="block text-muted">Para parcelas que você já pagou antes de usar o app. Não mexe em saldo nem em relatório.</span>
            </span>
          </label>
          {!lancar && s.restantes > 1 && (
            <div>
              <label htmlFor={`qtd-${d.id}`} className="label">
                Quantas parcelas marcar como pagas
              </label>
              <input id={`qtd-${d.id}`} inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} className="field num" />
            </div>
          )}
          {lancar && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`conta-${d.id}`} className="label">
                  Conta
                </label>
                <select id={`conta-${d.id}`} value={contaId} onChange={(e) => setContaId(e.target.value)} className="field">
                  {contas.map((x) => (
                    <option key={String(x.id)} value={String(x.id)}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`data-${d.id}`} className="label">
                  Data do pagamento
                </label>
                <input id={`data-${d.id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} className="field" />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setPagando(false)} disabled={ocupado} className="btn btn-quiet flex-1">
              Cancelar
            </button>
            <button onClick={pagar} disabled={ocupado} className="btn btn-primary flex-1">
              {ocupado ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm font-medium text-neg">
          {erro}
        </p>
      )}

      {!pagando && (
        <div className="mt-4 flex flex-wrap gap-2">
          {podeLancar && s.proxima && (
            <button onClick={() => { setLancar(true); setErro(""); setPagando(true); }} className="btn btn-primary px-4 py-2">
              Pagar parcela
            </button>
          )}
          {podeGerenciar && (
            <button onClick={() => onEditar(d)} className="btn btn-quiet px-4 py-2">
              Editar
            </button>
          )}
          {podeGerenciar &&
            (apagando ? (
              <>
                <button onClick={() => setApagando(false)} disabled={ocupado} className="btn btn-quiet px-4 py-2">
                  Cancelar
                </button>
                <button onClick={apagar} disabled={ocupado} className="btn btn-danger px-4 py-2">
                  {ocupado ? "Excluindo…" : "Confirmar exclusão"}
                </button>
              </>
            ) : (
              <button onClick={() => setApagando(true)} className="btn btn-quiet px-4 py-2 text-neg">
                Excluir
              </button>
            ))}
        </div>
      )}
    </li>
  );
}

/** Resumo curto para a tela inicial: quanto vai por mês e a próxima parcela que vence. */
export function ResumoDividas({ dados, onAbrir }: { dados: Dados; onAbrir: () => void }) {
  const hoje = todayISO();
  const dividas = dados.dividas ?? [];
  const r = resumir(dividas, hoje);
  if (r.emAberto === 0) return null;
  const proximas = dividas
    .map((d) => ({ d, s: situacao(d, hoje) }))
    .filter((x) => x.s.proxima)
    .sort((a, b) => a.s.proxima!.data.localeCompare(b.s.proxima!.data));
  const prox = proximas[0];
  return (
    <section className="panel p-4" aria-label="Financiamentos e empréstimos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">Financiamentos e empréstimos</p>
          <p className="mt-0.5">
            <span className="num font-display text-2xl">{money(r.mensal)}</span> <span className="text-sm text-muted">por mês · faltam {money(r.faltaPagar)}</span>
          </p>
          {prox && (
            <p className={`mt-1 text-sm ${prox.s.atrasadas > 0 ? "font-semibold text-neg" : "text-muted"}`}>
              {prox.s.atrasadas > 0 ? "Atrasada: " : "Próxima: "}
              {prox.d.nome} {prox.s.proxima!.indice}/{prox.s.total}, {dateBR(prox.s.proxima!.data)}, {money(num(prox.d.valor_parcela))}
            </p>
          )}
        </div>
        <button onClick={onAbrir} className="btn btn-quiet">
          Ver detalhes
        </button>
      </div>
    </section>
  );
}
