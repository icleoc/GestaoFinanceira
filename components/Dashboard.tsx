"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dados } from "@/lib/types";
import {
  calcularKpis,
  contasFixasPendentes,
  gastosPorCategoria,
  mesesDisponiveis,
  monthOf,
  todayISO,
  totaisDoMes,
  type ContaFixaPendente,
} from "@/lib/finance";
import { carregarDados, sair } from "@/lib/data";
import { monthLabel } from "@/lib/format";
import Patrimonio from "./Patrimonio";
import { Bancos, Cartoes, Investimentos } from "./Contas";
import GastosDoMes from "./GastosDoMes";
import ContasFixasPendentes from "./ContasFixas";
import LancamentoForm, { type Prefill } from "./LancamentoForm";
import ExtratoModal from "./ExtratoModal";
import GerenciarModal from "./GerenciarModal";

type Janela = "extrato" | "gerenciar" | null;

export default function Dashboard() {
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [mes, setMes] = useState(monthOf(todayISO()));
  const [janela, setJanela] = useState<Janela>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [aviso, setAviso] = useState("");

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarDados());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os dados.");
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const depoisDeMudar = useCallback(
    (mensagem: string) => {
      setAviso(mensagem);
      recarregar();
    },
    [recarregar],
  );

  const hoje = todayISO();
  const resumo = useMemo(() => {
    if (!dados) return null;
    const meses = mesesDisponiveis(dados.transacoes, hoje);
    return {
      kpis: calcularKpis(dados.contas),
      meses: meses.includes(mes) ? meses : [mes, ...meses],
      gastos: gastosPorCategoria(dados.transacoes, dados.categorias, mes),
      totais: totaisDoMes(dados.transacoes, dados.categorias, mes),
      pendentes: contasFixasPendentes(dados.fixas, dados.transacoes, hoje),
    };
  }, [dados, hoje, mes]);

  function lancarFixa(p: ContaFixaPendente) {
    setPrefill({ chave: Date.now(), nome: p.fixa.nome, valor: Number(p.fixa.valor) || 0 });
  }

  async function deslogar() {
    await sair();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Gestão Financeira</h1>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Ações">
          {resumo && (
            <>
              <label htmlFor="mes" className="sr-only">
                Mês do resumo
              </label>
              <select id="mes" value={mes} onChange={(e) => setMes(e.target.value)} className="field w-auto py-2 pr-8 text-sm">
                {resumo.meses.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </>
          )}
          <button onClick={() => setJanela("extrato")} disabled={!dados} className="btn btn-quiet">
            Extrato
          </button>
          <button onClick={() => setJanela("gerenciar")} disabled={!dados} className="btn btn-quiet">
            Gerenciar
          </button>
          <button onClick={deslogar} className="btn btn-quiet">
            Sair
          </button>
        </nav>
      </header>

      {erro && (
        <div role="alert" className="panel mb-6 flex flex-wrap items-center justify-between gap-3 border-neg/40 p-4">
          <p className="text-sm font-medium text-neg">{erro}</p>
          <button onClick={recarregar} className="btn btn-quiet px-3 py-1.5">
            Tentar de novo
          </button>
        </div>
      )}

      {!dados || !resumo ? (
        !erro && (
          <p className="py-20 text-center text-muted" role="status">
            Carregando suas contas…
          </p>
        )
      ) : (
        <div className="space-y-6">
          <ContasFixasPendentes pendentes={resumo.pendentes} onLancar={lancarFixa} />
          <Patrimonio kpis={resumo.kpis} />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <Bancos contas={dados.contas} />
              <Cartoes contas={dados.contas} />
              <Investimentos contas={dados.contas} />
            </div>
            <div className="space-y-6 lg:col-span-5">
              <LancamentoForm dados={dados} prefill={prefill} onSalvo={depoisDeMudar} />
              <GastosDoMes mes={mes} gastos={resumo.gastos} receitas={resumo.totais.receitas} despesas={resumo.totais.despesas} />
            </div>
          </div>
        </div>
      )}

      {janela === "extrato" && dados && (
        <ExtratoModal dados={dados} mesInicial={mes} onClose={() => setJanela(null)} onMudou={depoisDeMudar} />
      )}
      {janela === "gerenciar" && dados && (
        <GerenciarModal dados={dados} onClose={() => setJanela(null)} onMudou={depoisDeMudar} />
      )}

      {aviso && (
        <div
          role="status"
          className="pop-in fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-xl"
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
