"use client";

import { useMemo, useState } from "react";
import type { Dados, DadosNota, Transacao } from "@/lib/types";
import { mesesDisponiveis, montarEdicao, num, parseParcela, todayISO } from "@/lib/finance";
import { atualizarTransacoes, excluirTransacoes, mudarCategoria, removerNotas } from "@/lib/data";
import { dateBR, money, monthLabel } from "@/lib/format";
import { formatarEstrangeira, formatarTaxa } from "@/lib/cambio";
import Modal from "./Modal";
import NotaViewer from "./NotaViewer";

interface Props {
  dados: Dados;
  mesInicial: string;
  /** Pode corrigir e apagar lançamentos. */
  podeEditar: boolean;
  onClose: () => void;
  onMudou: (mensagem: string) => void;
}

const POR_PAGINA = 100;

export default function ExtratoModal({ dados, mesInicial, podeEditar, onClose, onMudou }: Props) {
  const { contas, categorias, transacoes } = dados;
  const [conta, setConta] = useState("todas");
  const [tipo, setTipo] = useState<"todos" | "despesa" | "receita">("todos");
  const [mes, setMes] = useState(mesInicial);
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState("todas");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ caminho: string; titulo: string; dados?: DadosNota | null } | null>(null);

  const nomeConta = useMemo(() => new Map(contas.map((c) => [String(c.id), c.nome])), [contas]);
  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [String(c.id), c.nome])), [categorias]);
  const meses = useMemo(() => mesesDisponiveis(transacoes, todayISO()), [transacoes]);
  const nomePessoa = useMemo(() => new Map((dados.membros ?? []).map((m) => [m.user_id, m.nome || m.email || "Pessoa"])), [dados.membros]);
  // O filtro por pessoa só aparece quando há lançamentos de mais de uma pessoa.
  const autores = useMemo(() => [...new Set(transacoes.map((t) => t.criado_por).filter((x): x is string => Boolean(x)))], [transacoes]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return transacoes.filter((t) => {
      if (mes !== "todos" && !t.data.startsWith(mes)) return false;
      if (conta === "sem-conta" ? t.conta_origem_id != null : conta !== "todas" && String(t.conta_origem_id) !== conta) return false;
      const v = num(t.valor);
      if (tipo === "despesa" && v >= 0) return false;
      if (tipo === "receita" && v <= 0) return false;
      if (q && !t.descricao.toLowerCase().includes(q)) return false;
      if (pessoa !== "todas" && t.criado_por !== pessoa) return false;
      return true;
    });
  }, [transacoes, mes, conta, tipo, busca, pessoa]);

  const visiveis = filtradas.slice(0, limite);
  const todosMarcados = visiveis.length > 0 && visiveis.every((t) => marcados.has(String(t.id)));

  function alternar(id: string) {
    setConfirmando(false);
    setMarcados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function alternarTodos() {
    setConfirmando(false);
    setMarcados(todosMarcados ? new Set() : new Set(visiveis.map((t) => String(t.id))));
  }

  async function excluir() {
    setOcupado(true);
    setErro("");
    try {
      const apagadas = transacoes.filter((t) => marcados.has(String(t.id)));
      const ids = apagadas.map((t) => t.id);
      await excluirTransacoes(ids);
      // Foto de nota que nenhum outro lançamento usa mais também sai do armazenamento.
      const restantes = new Set(transacoes.filter((t) => !marcados.has(String(t.id))).map((t) => t.nota_path).filter(Boolean));
      const orfas = [...new Set(apagadas.map((t) => t.nota_path).filter((c): c is string => Boolean(c) && !restantes.has(c)))];
      await removerNotas(orfas).catch(() => undefined);
      setMarcados(new Set());
      setConfirmando(false);
      onMudou(ids.length === 1 ? "Lançamento excluído." : `${ids.length} lançamentos excluídos.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setOcupado(false);
    }
  }

  if (nota) return <NotaViewer caminho={nota.caminho} titulo={nota.titulo} dados={nota.dados} onClose={() => setNota(null)} />;

  if (editando) {
    return (
      <Modal titulo="Editar lançamento" onClose={onClose} largura="md">
        <Edicao
          t={editando}
          todas={transacoes}
          categorias={categorias}
          contas={contas}
          onVerNota={
            editando.nota_path
              ? () => setNota({ caminho: editando.nota_path as string, titulo: editando.descricao, dados: editando.nota_dados })
              : undefined
          }
          onVoltar={() => setEditando(null)}
          onSalvo={(m) => {
            setEditando(null);
            onMudou(m);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal titulo="Extrato" onClose={onClose} largura="xl">
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-sunken p-4 md:grid-cols-4">
        <div>
          <label htmlFor="x-mes" className="label">
            Mês
          </label>
          <select id="x-mes" value={mes} onChange={(e) => setMes(e.target.value)} className="field">
            <option value="todos">Todos os meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="x-conta" className="label">
            Conta
          </label>
          <select id="x-conta" value={conta} onChange={(e) => setConta(e.target.value)} className="field">
            <option value="todas">Todas</option>
            {contas.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
            <option value="sem-conta">Sem conta (taxas)</option>
          </select>
        </div>
        <div>
          <label htmlFor="x-tipo" className="label">
            Tipo
          </label>
          <select id="x-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="field">
            <option value="todos">Entradas e saídas</option>
            <option value="despesa">Só saídas</option>
            <option value="receita">Só entradas</option>
          </select>
        </div>
        {autores.length > 1 && (
          <div>
            <label htmlFor="x-pessoa" className="label">
              Quem lançou
            </label>
            <select id="x-pessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="field">
              <option value="todas">Todos</option>
              {autores.map((id) => (
                <option key={id} value={id}>
                  {nomePessoa.get(id) ?? "Outra pessoa"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="x-busca" className="label">
            Buscar
          </label>
          <input id="x-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição" className="field" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        {podeEditar ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} className="size-4 accent-[rgb(var(--accent))]" />
            Selecionar tudo que aparece
          </label>
        ) : (
          <span className="text-sm text-muted">{filtradas.length} lançamentos</span>
        )}
        <div className="flex items-center gap-2">
          {erro && (
            <span role="alert" className="text-sm font-medium text-neg">
              {erro}
            </span>
          )}
          {marcados.size > 0 &&
            (confirmando ? (
              <>
                <button onClick={() => setConfirmando(false)} className="btn btn-quiet px-3 py-1.5" disabled={ocupado}>
                  Cancelar
                </button>
                <button onClick={excluir} className="btn btn-danger px-3 py-1.5" disabled={ocupado}>
                  {ocupado ? "Excluindo…" : `Confirmar exclusão de ${marcados.size}`}
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmando(true)} className="btn btn-quiet px-3 py-1.5 text-neg">
                Excluir {marcados.size} {marcados.size === 1 ? "selecionado" : "selecionados"}
              </button>
            ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">Nenhum lançamento com esses filtros.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visiveis.map((t) => {
            const v = num(t.valor);
            const p = parseParcela(t.descricao);
            const id = String(t.id);
            const cat = t.categoria_id != null ? nomeCategoria.get(String(t.categoria_id)) : undefined;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
                {podeEditar && (
                  <input
                    type="checkbox"
                    checked={marcados.has(id)}
                    onChange={() => alternar(id)}
                    aria-label={`Selecionar ${t.descricao}`}
                    className="size-4 shrink-0 accent-[rgb(var(--accent))]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p ? p.base : t.descricao}
                    {p && (
                      <span className="num ml-2 rounded-md bg-sunken px-1.5 py-0.5 text-xs font-medium text-muted">
                        {p.indice}/{p.total}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {dateBR(t.data)} · {t.conta_origem_id != null ? (nomeConta.get(String(t.conta_origem_id)) ?? "Conta removida") : "Sem conta"}
                    {cat ? ` · ${cat}` : ""}
                    {autores.length > 1 && t.criado_por ? ` · ${nomePessoa.get(t.criado_por) ?? "outra pessoa"}` : ""}
                    {t.moeda && t.moeda !== "BRL" && t.valor_original != null && num(t.taxa_cambio) > 0
                      ? ` · ${formatarEstrangeira(num(t.valor_original), t.moeda)} a ${formatarTaxa(num(t.taxa_cambio))}`
                      : ""}
                  </p>
                </div>
                {t.nota_path && (
                  <button
                    onClick={() => setNota({ caminho: t.nota_path as string, titulo: p ? p.base : t.descricao, dados: t.nota_dados })}
                    className="btn btn-quiet shrink-0 gap-1.5 px-2.5 py-1.5 text-sm"
                    aria-label={`Ver a foto da nota de ${t.descricao}`}
                    title="Ver foto da nota"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                      <circle cx="12" cy="13" r="3.5" />
                    </svg>
                    <span className="hidden sm:inline">Nota</span>
                  </button>
                )}
                <span className={`num shrink-0 font-semibold ${v < 0 ? "text-neg" : "text-accent"}`}>
                  {v > 0 ? "+" : "−"}
                  {money(Math.abs(v))}
                </span>
                {podeEditar && (
                  <button onClick={() => setEditando(t)} className="btn btn-quiet shrink-0 px-3 py-1.5" aria-label={`Editar ${t.descricao}`}>
                    Editar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filtradas.length > limite && (
        <div className="border-t border-line p-4 text-center">
          <button onClick={() => setLimite((l) => l + POR_PAGINA)} className="btn btn-quiet">
            Mostrar mais ({filtradas.length - limite} restantes)
          </button>
        </div>
      )}
    </Modal>
  );
}

function Edicao({
  t,
  todas,
  categorias,
  contas,
  onVerNota,
  onVoltar,
  onSalvo,
}: {
  t: Transacao;
  todas: Transacao[];
  categorias: Dados["categorias"];
  contas: Dados["contas"];
  onVerNota?: () => void;
  onVoltar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const info = parseParcela(t.descricao);
  const [data, setData] = useState(t.data);
  const [descricao, setDescricao] = useState(info ? info.base : t.descricao);
  const [valor, setValor] = useState(String(Math.abs(num(t.valor)).toFixed(2)));
  const [cascata, setCascata] = useState(false);
  const [categoriaId, setCategoriaId] = useState(t.categoria_id != null ? String(t.categoria_id) : "");
  // Conta e tipo (entrada/saída) só mudam em lançamentos comuns; transferências e aportes têm dois lados e ficam como estão.
  const catAtual = categorias.find((c) => String(c.id) === String(t.categoria_id));
  const comum = catAtual?.tipo === "Despesa" || catAtual?.tipo === "Receita";
  const [tipoLanc, setTipoLanc] = useState<"saida" | "entrada">(num(t.valor) < 0 ? "saida" : "entrada");
  const [contaId, setContaId] = useState(t.conta_origem_id != null ? String(t.conta_origem_id) : "");
  const tipoCat = tipoLanc === "saida" ? "Despesa" : "Receita";
  const opcoesCat = categorias.filter((c) => c.tipo === tipoCat || (tipoLanc === (num(t.valor) < 0 ? "saida" : "entrada") && String(c.id) === String(t.categoria_id)));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const irmas = info
    ? todas.filter((x) => {
        const p = parseParcela(x.descricao);
        return p && p.base === info.base && p.total === info.total && String(x.conta_origem_id) === String(t.conta_origem_id);
      }).length
    : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = num(valor.includes(",") ? valor.replace(/\./g, "").replace(",", ".") : valor);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!(v > 0)) return setErro("Informe um valor maior que zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data.");
    setSalvando(true);
    setErro("");
    try {
      const mudouConta = comum && contaId !== (t.conta_origem_id != null ? String(t.conta_origem_id) : "");
      const novaConta = contas.find((c) => String(c.id) === contaId)?.id ?? null;
      const mudouTipo = comum && tipoLanc !== (num(t.valor) < 0 ? "saida" : "entrada");
      const itens = montarEdicao(t, todas, { data, descricao, valorAbs: v }, cascata).map((i) => ({
        ...i,
        ...(mudouTipo ? { valor: (tipoLanc === "saida" ? -1 : 1) * Math.abs(i.valor) } : {}),
        ...(mudouConta ? { conta_origem_id: novaConta } : {}),
      }));
      await atualizarTransacoes(itens);
      if (categoriaId !== (t.categoria_id != null ? String(t.categoria_id) : "")) {
        const nova = categorias.find((c) => String(c.id) === categoriaId)?.id ?? null;
        await mudarCategoria(itens.map((i) => i.id), nova);
      }
      onSalvo(itens.length > 1 ? `${itens.length} parcelas atualizadas.` : "Lançamento atualizado.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 p-5" noValidate>
      <div>
        <label htmlFor="e-data" className="label">
          Data{info ? ` desta parcela (${info.indice}/${info.total})` : ""}
        </label>
        <input id="e-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="field" />
      </div>
      {comum && (
        <div role="radiogroup" aria-label="Tipo do lançamento" className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
          {(
            [
              ["saida", "Saída (despesa)"],
              ["entrada", "Entrada (receita)"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tipoLanc === id}
              onClick={() => {
                setTipoLanc(id);
                setCategoriaId("");
              }}
              className={"rounded-lg px-2 py-2 text-sm font-medium transition-colors " + (tipoLanc === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="e-desc" className="label">
          Descrição
        </label>
        <input id="e-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="e-valor" className="label">
          Valor (R$)
        </label>
        <input id="e-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" />
        {!comum && <p className="mt-1 text-sm text-muted">{num(t.valor) < 0 ? "Continua como saída." : "Continua como entrada."}</p>}
      </div>
      {comum && (
        <div>
          <label htmlFor="e-conta" className="label">
            Conta
          </label>
          <select id="e-conta" value={contaId} onChange={(e) => setContaId(e.target.value)} className="field">
            {contas.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted">Trocar a conta ajusta o saldo das duas contas.</p>
        </div>
      )}
      <div>
        <label htmlFor="e-cat" className="label">
          Categoria
        </label>
        <select id="e-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="field">
          <option value="">Sem categoria</option>
          {opcoesCat.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      {onVerNota && (
        <button type="button" onClick={onVerNota} className="btn btn-quiet w-full">
          Ver a foto da nota e os itens lidos
        </button>
      )}
      {irmas > 1 && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-sunken p-3 text-sm">
          <input type="checkbox" checked={cascata} onChange={(e) => setCascata(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
          <span>
            Aplicar nas {irmas} parcelas desta compra
            <span className="block text-muted">As outras parcelas mantêm o intervalo de um mês entre si.</span>
          </span>
        </label>
      )}
      {erro && (
        <p role="alert" className="text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onVoltar} className="btn btn-quiet flex-1" disabled={salvando}>
          Voltar
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
