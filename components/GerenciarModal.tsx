"use client";

import { useState } from "react";
import type { Dados, Id, TipoCategoria, TipoConta } from "@/lib/types";
import { num } from "@/lib/finance";
import {
  criarCategoria,
  criarConta,
  criarFixa,
  excluirCategoria,
  excluirConta,
  excluirFixa,
} from "@/lib/data";
import { money } from "@/lib/format";
import Modal from "./Modal";

interface Props {
  dados: Dados;
  onClose: () => void;
  onMudou: (mensagem: string) => void;
}

type Aba = "contas" | "fixas" | "categorias";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "contas", nome: "Contas e cartões" },
  { id: "fixas", nome: "Contas fixas" },
  { id: "categorias", nome: "Categorias" },
];

function lerValor(t: string): number {
  const s = t.trim();
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

export default function GerenciarModal({ dados, onClose, onMudou }: Props) {
  const [aba, setAba] = useState<Aba>("contas");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
      setConfirmando(null);
      onMudou(mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setOcupado(false);
    }
  }

  function Excluir({ chave, acao, mensagem, aviso }: { chave: string; acao: () => Promise<void>; mensagem: string; aviso?: string }) {
    return confirmando === chave ? (
      <span className="flex items-center gap-2">
        {aviso && <span className="hidden text-sm text-muted sm:inline">{aviso}</span>}
        <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setConfirmando(null)} disabled={ocupado}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger px-3 py-1.5" onClick={() => executar(acao, mensagem)} disabled={ocupado}>
          Excluir
        </button>
      </span>
    ) : (
      <button type="button" className="btn btn-quiet px-3 py-1.5 text-neg" onClick={() => setConfirmando(chave)}>
        Excluir
      </button>
    );
  }

  return (
    <Modal titulo="Gerenciar" onClose={onClose} largura="lg">
      <div role="tablist" className="flex gap-1 border-b border-line px-4 pt-3">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => {
              setAba(a.id);
              setErro("");
              setConfirmando(null);
            }}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${
              aba === a.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="p-5">
        {erro && (
          <p role="alert" className="mb-4 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm font-medium text-neg">
            {erro}
          </p>
        )}

        {aba === "contas" && (
          <>
            <NovaConta ocupado={ocupado} onCriar={(c) => executar(() => criarConta(c), "Conta criada.")} />
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {dados.contas.length === 0 && <li className="p-4 text-sm text-muted">Nenhuma conta ainda.</li>}
              {dados.contas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    <p className="num text-sm text-muted">
                      {c.tipo}
                      {c.tipo === "Crédito" ? ` · limite ${money(num(c.limite_total))}` : ` · ${money(num(c.saldo_atual))}`}
                    </p>
                  </div>
                  <Excluir
                    chave={`c${c.id}`}
                    acao={() => excluirConta(c.id as Id)}
                    mensagem="Conta excluída."
                    aviso="Os lançamentos dela podem impedir a exclusão."
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {aba === "fixas" && (
          <>
            <NovaFixa ocupado={ocupado} onCriar={(f) => executar(() => criarFixa(f), "Conta fixa criada.")} />
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {dados.fixas.length === 0 && <li className="p-4 text-sm text-muted">Nenhuma conta fixa ainda.</li>}
              {dados.fixas.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{f.nome}</p>
                    <p className="num text-sm text-muted">
                      {money(num(f.valor))} · vence dia {f.dia_vencimento}
                    </p>
                  </div>
                  <Excluir chave={`f${f.id}`} acao={() => excluirFixa(f.id as Id)} mensagem="Conta fixa excluída." />
                </li>
              ))}
            </ul>
          </>
        )}

        {aba === "categorias" && (
          <>
            <NovaCategoria ocupado={ocupado} onCriar={(c) => executar(async () => void (await criarCategoria(c)), "Categoria criada.")} />
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {dados.categorias.length === 0 && <li className="p-4 text-sm text-muted">Nenhuma categoria ainda.</li>}
              {dados.categorias.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p>
                    <span className="font-medium">{c.nome}</span>
                    <span className="ml-2 text-sm text-muted">{c.tipo}</span>
                  </p>
                  <Excluir
                    chave={`k${c.id}`}
                    acao={() => excluirCategoria(c.id as Id)}
                    mensagem="Categoria excluída."
                    aviso="Pode estar em uso em lançamentos."
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

function NovaConta({ ocupado, onCriar }: { ocupado: boolean; onCriar: (c: { nome: string; tipo: TipoConta; valor: number; diaVencimento: number | null }) => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConta>("Corrente");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("");
  const [erro, setErro] = useState("");

  const rotuloValor = tipo === "Crédito" ? "Limite do cartão (R$)" : tipo === "Investimento" ? "Valor investido (R$)" : "Saldo atual (R$)";

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    const d = dia ? Math.trunc(Number(dia)) : null;
    if (tipo === "Crédito" && (!d || d < 1 || d > 31)) return setErro("Informe o dia de vencimento da fatura (1 a 31).");
    setErro("");
    onCriar({ nome: nome.trim(), tipo, valor: lerValor(valor), diaVencimento: tipo === "Crédito" ? d : null });
    setNome("");
    setValor("");
    setDia("");
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-2 gap-3" noValidate>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="n-nome" className="label">
          Nome
        </label>
        <input id="n-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: Nubank" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="n-tipo" className="label">
          Tipo
        </label>
        <select id="n-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)} className="field">
          <option value="Corrente">Conta corrente</option>
          <option value="Crédito">Cartão de crédito</option>
          <option value="Investimento">Investimento</option>
        </select>
      </div>
      <div className={tipo === "Crédito" ? "col-span-1" : "col-span-2"}>
        <label htmlFor="n-valor" className="label">
          {rotuloValor}
        </label>
        <input id="n-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" placeholder="0,00" />
      </div>
      {tipo === "Crédito" && (
        <div>
          <label htmlFor="n-dia" className="label">
            Vence no dia
          </label>
          <input id="n-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="field num" placeholder="10" />
        </div>
      )}
      {erro && (
        <p role="alert" className="col-span-2 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <button type="submit" disabled={ocupado} className="btn btn-primary col-span-2">
        Adicionar conta
      </button>
    </form>
  );
}

function NovaFixa({ ocupado, onCriar }: { ocupado: boolean; onCriar: (f: { nome: string; valor: number; dia: number }) => void }) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("");
  const [erro, setErro] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    const d = Math.trunc(Number(dia));
    if (!nome.trim()) return setErro("Informe o nome.");
    if (!(v > 0)) return setErro("Informe um valor maior que zero.");
    if (!(d >= 1 && d <= 31)) return setErro("Informe o dia de vencimento (1 a 31).");
    setErro("");
    onCriar({ nome: nome.trim(), valor: v, dia: d });
    setNome("");
    setValor("");
    setDia("");
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-5 gap-3" noValidate>
      <div className="col-span-5 sm:col-span-3">
        <label htmlFor="x-nome" className="label">
          Nome
        </label>
        <input id="x-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: Aluguel" />
        <p className="mt-1 text-sm text-muted">Use o mesmo nome de uma categoria para preencher o valor ao lançar.</p>
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label htmlFor="x-valor" className="label">
          Valor (R$)
        </label>
        <input id="x-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="x-dia" className="label">
          Dia
        </label>
        <input id="x-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="field num" placeholder="5" />
      </div>
      {erro && (
        <p role="alert" className="col-span-5 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <button type="submit" disabled={ocupado} className="btn btn-primary col-span-5">
        Adicionar conta fixa
      </button>
    </form>
  );
}

function NovaCategoria({ ocupado, onCriar }: { ocupado: boolean; onCriar: (c: { nome: string; tipo: TipoCategoria }) => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("Despesa");
  const [erro, setErro] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    setErro("");
    onCriar({ nome: nome.trim(), tipo });
    setNome("");
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-3 gap-3" noValidate>
      <div className="col-span-3 sm:col-span-2">
        <label htmlFor="k-nome" className="label">
          Nome
        </label>
        <input id="k-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: Mercado" />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label htmlFor="k-tipo" className="label">
          Tipo
        </label>
        <select id="k-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)} className="field">
          <option value="Despesa">Despesa</option>
          <option value="Receita">Receita</option>
        </select>
      </div>
      {erro && (
        <p role="alert" className="col-span-3 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <button type="submit" disabled={ocupado} className="btn btn-primary col-span-3">
        Adicionar categoria
      </button>
    </form>
  );
}
