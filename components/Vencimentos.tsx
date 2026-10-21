"use client";

import { useEffect, useMemo, useState } from "react";
import type { Aviso, Dados, Sessao } from "@/lib/types";
import { DIAS_PADRAO, filtrarPorAviso, proximosVencimentos, quandoVence, type Vencimento } from "@/lib/vencimentos";
import { salvarAviso, tokenAviso } from "@/lib/data";
import { dateBR, money } from "@/lib/format";
import Modal from "./Modal";

const OPCOES_DIAS = [14, 7, 4, 3, 1, 0];
const rotuloDias = (d: number) => (d === 0 ? "No dia" : d === 1 ? "1 dia antes" : `${d} dias antes`);

function corDe(dias: number) {
  if (dias < 0) return "bg-neg/10 text-neg";
  if (dias <= 1) return "bg-warn/15 text-warn";
  return "bg-sunken text-muted";
}

/** Contas a vencer (fixas e parcelas de financiamento) e a configuração de quem é avisado e de quê. */
export default function Vencimentos({ dados, sessao, hoje, onAviso }: { dados: Dados; sessao: Sessao; hoje: string; onAviso: (m: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [todas, setTodas] = useState(false);
  const todos = useMemo(() => proximosVencimentos({ fixas: dados.fixas, transacoes: dados.transacoes, dividas: dados.dividas }, hoje, 30), [dados, hoje]);
  const meu = (dados.avisos ?? []).find((a) => a.user_id === sessao.userId);
  const meus = meu ? filtrarPorAviso(todos, meu) : todos;
  const lista = todas ? meus : meus.slice(0, 6);
  const podeEquipe = sessao.permissoes.includes("equipe");
  if (todos.length === 0 && !podeEquipe && !meu) return null;

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="titulo-vencimentos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-vencimentos" className="font-display text-base font-semibold">
            Contas a vencer
          </h2>
          <p className="text-sm text-muted">
            Próximos 30 dias · {meu?.ativo ? "avisos ligados no seu calendário" : "avisos desligados para você"}
          </p>
        </div>
        <button onClick={() => setAberto(true)} className="btn btn-quiet px-3 py-1.5">
          Configurar avisos
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nada vence nos próximos 30 dias.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {lista.map((v, i) => (
            <li key={`${v.chave}-${v.data}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {v.nome}
                  {v.indice ? <span className="ml-1.5 text-sm font-normal text-muted">parcela {v.indice}/{v.total}</span> : null}
                </p>
                <p className="text-sm text-muted">
                  {dateBR(v.data)} · {v.origem === "divida" ? "financiamento/empréstimo" : "conta fixa"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num font-medium">{money(v.valor)}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${corDe(v.dias)}`}>{quandoVence(v.dias)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {meus.length > 6 && (
        <button onClick={() => setTodas((t) => !t)} className="mt-2 text-sm text-muted underline-offset-2 hover:underline">
          {todas ? "Mostrar menos" : `Ver todas (${meus.length})`}
        </button>
      )}
      {aberto && <AvisosModal dados={dados} sessao={sessao} onClose={() => setAberto(false)} onMudou={onAviso} />}
    </section>
  );
}

function AvisosModal({ dados, sessao, onClose, onMudou }: { dados: Dados; sessao: Sessao; onClose: () => void; onMudou: (m: string) => void }) {
  const podeEquipe = sessao.permissoes.includes("equipe");
  const membros = (dados.membros ?? []).filter((m) => podeEquipe || m.user_id === sessao.userId);
  const opcoes = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const base = proximosVencimentos({ fixas: dados.fixas, transacoes: [], dividas: dados.dividas }, hoje, 0);
    const vistos = new Map<string, string>();
    for (const f of dados.fixas) vistos.set(`fixa:${f.id}`, `${f.nome} (conta fixa)`);
    for (const d of dados.dividas ?? []) if (base.some((b) => b.chave === `divida:${d.id}`)) vistos.set(`divida:${d.id}`, `${d.nome} (parcelas)`);
    return [...vistos.entries()].map(([chave, nome]) => ({ chave, nome }));
  }, [dados]);

  return (
    <Modal titulo="Avisos de vencimento" onClose={onClose} largura="lg">
      <div className="space-y-5 p-5">
        <p className="text-sm text-muted">
          Cada pessoa escolhe quando ser avisada e de quais contas. O aviso chega como alarme no calendário do celular (veja o link de cada pessoa abaixo).
          {podeEquipe ? " Você pode ajustar os avisos de todos." : ""}
        </p>
        {opcoes.length === 0 && <p className="rounded-xl bg-sunken p-3 text-sm">Cadastre uma conta fixa (em Contas) ou um financiamento para poder escolher o que avisar.</p>}
        {membros.map((m) => (
          <CartaoPessoa
            key={m.user_id}
            nome={m.nome || m.email || "Pessoa"}
            eu={m.user_id === sessao.userId}
            userId={m.user_id}
            atual={(dados.avisos ?? []).find((a) => a.user_id === m.user_id)}
            opcoes={opcoes}
            onSalvo={onMudou}
          />
        ))}
      </div>
    </Modal>
  );
}

function CartaoPessoa({ nome, eu, userId, atual, opcoes, onSalvo }: { nome: string; eu: boolean; userId: string; atual: Aviso | undefined; opcoes: { chave: string; nome: string }[]; onSalvo: (m: string) => void }) {
  const [ativo, setAtivo] = useState(atual?.ativo ?? false);
  const [dias, setDias] = useState<number[]>(atual?.dias ?? DIAS_PADRAO);
  const [todas, setTodas] = useState(atual?.contas == null);
  const [contas, setContas] = useState<string[]>(atual?.contas ?? []);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!eu || !atual) return;
    let vivo = true;
    tokenAviso().then((t) => vivo && setToken(t)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [eu, atual]);

  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  async function salvar() {
    setErro("");
    if (ativo && dias.length === 0) return setErro("Marque pelo menos um aviso (por exemplo, 7 dias antes).");
    if (ativo && !todas && contas.length === 0) return setErro("Escolha pelo menos uma conta, ou marque “Todas”.");
    setOcupado(true);
    try {
      await salvarAviso(userId, { ativo, dias: [...dias].sort((a, b) => b - a), contas: todas ? null : contas });
      onSalvo(`Avisos de ${eu ? "você" : nome} salvos.`);
      if (eu) setToken(await tokenAviso().catch(() => null));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function novoLink() {
    setOcupado(true);
    try {
      setToken(await tokenAviso(true));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setOcupado(false);
    }
  }

  const base = typeof window === "undefined" ? "" : window.location.origin;
  const https = token ? `${base}/api/calendario/${token}.ics` : "";
  const webcal = https.replace(/^https?:/, "webcal:");

  return (
    <div className="rounded-xl border border-line p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="font-semibold">
          {nome}
          {eu && <span className="ml-1.5 text-sm font-normal text-muted">(você)</span>}
        </span>
        <span className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" aria-label={`Receber avisos: ${nome}`} />
          Receber avisos
        </span>
      </label>
      {ativo && (
        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="label">Quando avisar</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {OPCOES_DIAS.map((d) => (
                <label key={d} className={"cursor-pointer rounded-full border px-3 py-1 text-sm " + (dias.includes(d) ? "border-accent bg-accent/10 font-medium" : "border-line text-muted")}>
                  <input type="checkbox" className="sr-only" checked={dias.includes(d)} onChange={() => setDias((x) => alternar(x, d))} />
                  {rotuloDias(d)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">De quais contas</legend>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />
              Todas as contas
            </label>
            {!todas && (
              <ul className="mt-2 space-y-1.5">
                {opcoes.map((o) => (
                  <li key={o.chave}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={contas.includes(o.chave)} onChange={() => setContas((x) => alternar(x, o.chave))} className="size-4 accent-[rgb(var(--accent))]" />
                      {o.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <button onClick={salvar} disabled={ocupado} className="btn btn-primary mt-4 px-4 py-2">
        {ocupado ? "Salvando…" : "Salvar"}
      </button>
      {eu && atual?.ativo && token && (
        <div className="mt-4 rounded-xl bg-sunken p-3 text-sm">
          <p className="font-semibold">Seu calendário de vencimentos</p>
          <p className="mt-1 text-muted">Assine uma vez e os alarmes passam a tocar no celular. Não compartilhe este link: quem tem o link vê suas contas a vencer.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={webcal} className="btn btn-gold px-3 py-1.5">
              Adicionar ao calendário
            </a>
            <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer" className="btn btn-quiet px-3 py-1.5">
              Google Agenda
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(https).then(() => setCopiado(true))}
              className="btn btn-quiet px-3 py-1.5"
            >
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            <button onClick={novoLink} disabled={ocupado} className="btn btn-quiet px-3 py-1.5 text-neg">
              Gerar novo link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { Vencimento };
