"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dados, Sessao } from "@/lib/types";
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
import { gerarInsights, serieMensal, type Destino } from "@/lib/assistente";
import { carregarDados, carregarSessao, sair, usarCarteira } from "@/lib/data";
import { monthLabel } from "@/lib/format";
import { nomeDoPapel, pode } from "@/lib/permissoes";
import Logo from "./Logo";
import Patrimonio from "./Patrimonio";
import { Bancos, Cartoes, Investimentos } from "./Contas";
import GastosDoMes from "./GastosDoMes";
import ContasFixasPendentes from "./ContasFixas";
import LancamentoForm, { type Prefill } from "./LancamentoForm";
import ExtratoModal from "./ExtratoModal";
import GerenciarModal from "./GerenciarModal";
import Assistente from "./Assistente";
import Evolucao from "./Evolucao";
import Planejar from "./Planejar";
import Equipe from "./Equipe";
import TrocarSenha from "./TrocarSenha";
import Modal from "./Modal";

type Aba = "inicio" | "planejar" | "pessoas";
type Janela = "extrato" | "gerenciar" | "lancar" | "senha" | null;

export default function Dashboard() {
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("inicio");
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

  // Descobre quem é a pessoa, em qual carteira e com quais permissões; só então carrega os dados.
  useEffect(() => {
    let vivo = true;
    carregarSessao()
      .then((s) => {
        if (!vivo) return;
        setSessao(s);
        if (s) recarregar();
      })
      .catch((e) => {
        if (!vivo) return;
        setSessao(null);
        setErro(e instanceof Error ? e.message : "Não foi possível carregar o seu acesso.");
      });
    return () => {
      vivo = false;
    };
  }, [recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3800);
    return () => clearTimeout(t);
  }, [aviso]);

  const depoisDeMudar = useCallback(
    (mensagem: string) => {
      setAviso(mensagem);
      setJanela((j) => (j === "lancar" ? null : j));
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
      insights: gerarInsights(dados, hoje),
      serie: serieMensal(dados.transacoes, dados.categorias, monthOf(hoje), 6),
    };
  }, [dados, hoje, mes]);

  const permissoes = sessao?.permissoes ?? [];
  const podeLancar = pode(permissoes, "lancar");
  const podeEditar = pode(permissoes, "editar");
  const podeGerenciar = pode(permissoes, "gerenciar");
  const podePlanejar = pode(permissoes, "planejar");
  const podeEquipe = pode(permissoes, "equipe");

  const fechar = useCallback(() => setJanela(null), []);

  function lancarFixa(p: ContaFixaPendente) {
    setPrefill({ chave: Date.now(), nome: p.fixa.nome, valor: Number(p.fixa.valor) || 0 });
    setJanela("lancar");
  }

  function irPara(d: Destino) {
    if (d === "extrato") setJanela("extrato");
    else if (d === "gerenciar") setJanela("gerenciar");
    else if (d === "lancar") setJanela("lancar");
    else setAba("planejar");
  }

  const destinosPermitidos: Destino[] = [
    "extrato",
    ...(podeGerenciar ? (["gerenciar"] as Destino[]) : []),
    ...(podeLancar ? (["lancar"] as Destino[]) : []),
    "planejar",
  ];

  async function deslogar() {
    await sair();
    router.replace("/login");
    router.refresh();
  }

  function trocarCarteira(id: string) {
    usarCarteira(id);
    setDados(null);
    carregarSessao().then((s) => {
      setSessao(s);
      setAba("inicio");
      recarregar();
    });
  }

  /* ---------- estados de carregamento e erro ---------- */

  if (sessao === undefined) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <p className="text-muted" role="status">
          {erro || "Carregando…"}
        </p>
      </div>
    );
  }

  if (sessao === null) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4">
        <div className="panel w-full p-6 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-5 font-display text-xl font-semibold">Sua conta ainda não tem uma carteira</h1>
          <p className="mt-2 text-sm text-muted">
            {erro || "Peça a quem administra o sistema para liberar o seu acesso e tente de novo."}
          </p>
          <button onClick={deslogar} className="btn btn-quiet mt-5">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const abas: { id: Aba; nome: string }[] = [
    { id: "inicio", nome: "Início" },
    { id: "planejar", nome: "Planejar" },
    ...(podeEquipe ? ([{ id: "pessoas", nome: "Pessoas" }] as { id: Aba; nome: string }[]) : []),
  ];
  const inicial = (sessao.email || "?").charAt(0).toUpperCase();

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Logo tamanho={34} />
            {sessao.carteiras.length > 1 && (
              <>
                <label htmlFor="carteira" className="sr-only">
                  Carteira
                </label>
                <select
                  id="carteira"
                  value={sessao.carteiraId}
                  onChange={(e) => trocarCarteira(e.target.value)}
                  className="field w-auto py-1.5 pr-8 text-sm"
                >
                  {sessao.carteiras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <nav className="flex shrink-0 items-center gap-2" aria-label="Ações">
            <button onClick={() => setJanela("extrato")} disabled={!dados} className="btn btn-quiet">
              Extrato
            </button>
            {podeGerenciar && (
              <button onClick={() => setJanela("gerenciar")} disabled={!dados} className="btn btn-quiet hidden sm:inline-flex">
                Gerenciar
              </button>
            )}
            <details className="relative">
              <summary
                className="grid size-10 cursor-pointer list-none place-items-center rounded-full bg-deep text-sm font-semibold text-gold-hi ring-1 ring-gold/40 [&::-webkit-details-marker]:hidden"
                aria-label="Minha conta"
              >
                {inicial}
              </summary>
              <div className="panel absolute right-0 z-40 mt-2 w-64 p-3 shadow-xl">
                <p className="truncate text-sm font-medium">{sessao.email}</p>
                <p className="text-xs text-muted">
                  {nomeDoPapel(sessao.papel)} em {sessao.carteiraNome}
                </p>
                <div className="mt-3 grid gap-1.5">
                  {podeGerenciar && (
                    <button onClick={() => setJanela("gerenciar")} className="btn btn-quiet justify-start sm:hidden">
                      Gerenciar contas
                    </button>
                  )}
                  <button onClick={() => setJanela("senha")} className="btn btn-quiet justify-start">
                    Trocar senha
                  </button>
                  <button onClick={deslogar} className="btn btn-quiet justify-start">
                    Sair
                  </button>
                </div>
              </div>
            </details>
          </nav>
        </div>

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div role="tablist" aria-label="Seções" className="flex min-w-0 gap-0.5 sm:gap-1">
            {abas.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`-mb-px border-b-2 px-2.5 py-2.5 text-sm sm:px-3 font-semibold transition-colors ${
                  aba === a.id ? "border-gold-lo text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {a.nome}
              </button>
            ))}
          </div>
          {aba === "inicio" && resumo && (
            <>
              <label htmlFor="mes" className="sr-only">
                Mês do resumo
              </label>
              <select id="mes" value={mes} onChange={(e) => setMes(e.target.value)} className="field my-1 w-auto max-w-[8.5rem] shrink-0 py-1.5 pr-8 text-sm sm:max-w-none">
                {resumo.meses.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {erro && (
          <div role="alert" className="panel mb-6 flex flex-wrap items-center justify-between gap-3 border-neg/40 p-4">
            <p className="text-sm font-medium text-neg">{erro}</p>
            <button onClick={recarregar} className="btn btn-quiet px-3 py-1.5">
              Tentar de novo
            </button>
          </div>
        )}

        {aba === "pessoas" && podeEquipe ? (
          <Equipe sessao={sessao} onAviso={setAviso} />
        ) : !dados || !resumo ? (
          !erro && (
            <p className="py-20 text-center text-muted" role="status">
              Carregando suas contas…
            </p>
          )
        ) : aba === "planejar" ? (
          <Planejar dados={dados} podeEditar={podePlanejar} onMudou={depoisDeMudar} />
        ) : (
          <div className="space-y-6">
            <ContasFixasPendentes pendentes={resumo.pendentes} onLancar={podeLancar ? lancarFixa : undefined} />
            <Assistente insights={resumo.insights} onIr={irPara} permitidos={destinosPermitidos} />
            <Patrimonio kpis={resumo.kpis} />

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <Bancos contas={dados.contas} />
                <Cartoes contas={dados.contas} />
                <Investimentos contas={dados.contas} />
              </div>
              <div className="space-y-6 lg:col-span-5">
                <GastosDoMes mes={mes} gastos={resumo.gastos} receitas={resumo.totais.receitas} despesas={resumo.totais.despesas} />
                <Evolucao serie={resumo.serie} mesAtual={mes} />
              </div>
            </div>
          </div>
        )}
      </main>

      {podeLancar && dados && aba !== "pessoas" && (
        <button
          onClick={() => {
            setPrefill(null);
            setJanela("lancar");
          }}
          className="btn btn-gold fixed bottom-5 right-4 z-30 gap-2 px-6 py-3.5 text-base sm:right-8"
        >
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
          Lançar
        </button>
      )}

      {janela === "lancar" && dados && (
        <Modal titulo="Novo lançamento" onClose={fechar}>
          <LancamentoForm dados={dados} prefill={prefill} onSalvo={depoisDeMudar} semMoldura />
        </Modal>
      )}
      {janela === "extrato" && dados && (
        <ExtratoModal dados={dados} mesInicial={mes} podeEditar={podeEditar} onClose={fechar} onMudou={depoisDeMudar} />
      )}
      {janela === "gerenciar" && dados && podeGerenciar && (
        <GerenciarModal dados={dados} onClose={fechar} onMudou={depoisDeMudar} />
      )}
      {janela === "senha" && (
        <TrocarSenha
          onClose={fechar}
          onFeito={() => {
            setJanela(null);
            setAviso("Senha alterada.");
          }}
        />
      )}

      {aviso && (
        <div
          role="status"
          className="pop-in fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-xl"
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
