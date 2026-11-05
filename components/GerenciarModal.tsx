"use client";

import QuemRecebe from "./QuemRecebe";
import { useState } from "react";
import type { Conta, Dados, DespesaFixa, Id, TipoCategoria, TipoConta } from "@/lib/types";
import { num } from "@/lib/finance";
import {
  atualizarConta,
  criarCategoria,
  criarConta,
  atualizarFixa,
  criarFixa,
  excluirCategoria,
  excluirConta,
  excluirFixa,
} from "@/lib/data";
import { money } from "@/lib/format";
import { MOEDAS, simboloDe, formatarEstrangeira } from "@/lib/cambio";
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
  const [editando, setEditando] = useState<Id | null>(null);
  const [editandoFixa, setEditandoFixa] = useState<Id | null>(null);
  const [subConta, setSubConta] = useState<"contas" | "cartoes">("contas");
  const contasDaAba = dados.contas.filter((c) => (subConta === "cartoes" ? c.tipo === "Crédito" : c.tipo !== "Crédito"));

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
            <div role="tablist" aria-label="Contas ou cartões" className="mb-4 inline-grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
              {(
                [
                  ["contas", "Contas"],
                  ["cartoes", "Cartões"],
                ] as const
              ).map(([id, nome]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={subConta === id}
                  onClick={() => {
                    setSubConta(id);
                    setEditando(null);
                    setConfirmando(null);
                    setErro("");
                  }}
                  className={"rounded-lg px-5 py-1.5 text-sm font-medium " + (subConta === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
                >
                  {nome}
                </button>
              ))}
            </div>
            <FormConta
              key={subConta}
              membros={dados.membros ?? []}
              ocupado={ocupado}
              rotulo={subConta === "cartoes" ? "Adicionar cartão" : "Adicionar conta"}
              tipos={subConta === "cartoes" ? ["Crédito"] : ["Corrente", "Investimento"]}
              limpar
              onEnviar={(c) => executar(() => criarConta(c), subConta === "cartoes" ? "Cartão criado." : "Conta criada.")}
            />
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {contasDaAba.length === 0 && <li className="p-4 text-sm text-muted">{subConta === "cartoes" ? "Nenhum cartão ainda." : "Nenhuma conta ainda."}</li>}
              {contasDaAba.map((c) =>
                editando === c.id ? (
                  <li key={c.id} className="bg-sunken/50 p-4">
                    <FormConta
                      membros={dados.membros ?? []}
                      ocupado={ocupado}
                      conta={c}
                      moedaTravada={dados.transacoes.some((t) => String(t.conta_origem_id) === String(c.id))}
                      rotulo="Salvar alterações"
                      onCancelar={() => setEditando(null)}
                      onEnviar={(v) =>
                        executar(async () => {
                          await atualizarConta(c.id as Id, v);
                          setEditando(null);
                        }, "Conta atualizada.")
                      }
                    />
                  </li>
                ) : (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="num text-sm text-muted">
                        {c.tipo}
                        {c.tipo === "Crédito" ? ` · limite ${money(num(c.limite_total))}` : c.moeda && c.moeda !== "BRL" ? ` · ${formatarEstrangeira(num(c.saldo_atual), c.moeda)}` : ` · ${money(num(c.saldo_atual))}`}
                        {c.tipo === "Crédito" && c.final_cartao ? ` · final ${c.final_cartao}` : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => { setEditando(c.id); setConfirmando(null); setErro(""); }}>
                        Editar
                      </button>
                      <Excluir chave={`c${c.id}`} acao={() => excluirConta(c.id as Id)} mensagem="Conta excluída." aviso="Os lançamentos dela podem impedir a exclusão." />
                    </span>
                  </li>
                ),
              )}
            </ul>
          </>
        )}

        {aba === "fixas" && (
          <>
            <FormFixa ocupado={ocupado} membros={dados.membros ?? []} rotulo="Adicionar conta fixa" limpar onEnviar={(f) => executar(() => criarFixa(f), "Conta fixa criada.")} />
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {dados.fixas.length === 0 && <li className="p-4 text-sm text-muted">Nenhuma conta fixa ainda.</li>}
              {dados.fixas.map((f) =>
                editandoFixa === f.id ? (
                  <li key={f.id} className="bg-sunken/50 p-4">
                    <FormFixa
                      ocupado={ocupado}
                      membros={dados.membros ?? []}
                      fixa={f}
                      rotulo="Salvar alterações"
                      onCancelar={() => setEditandoFixa(null)}
                      onEnviar={(v) =>
                        executar(async () => {
                          await atualizarFixa(f.id as Id, v);
                          setEditandoFixa(null);
                        }, "Conta fixa atualizada.")
                      }
                    />
                  </li>
                ) : (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">
                        {f.nome}
                        {f.flutuante && <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">valor variável</span>}
                      </p>
                      <p className="num text-sm text-muted">
                        {f.flutuante ? "base " : ""}
                        {money(num(f.valor))} · vence dia {f.dia_vencimento}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => { setEditandoFixa(f.id); setConfirmando(null); setErro(""); }}>
                        Editar
                      </button>
                      <Excluir chave={`f${f.id}`} acao={() => excluirFixa(f.id as Id)} mensagem="Conta fixa excluída." />
                    </span>
                  </li>
                ),
              )}
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

type DadosNovaConta = Parameters<typeof criarConta>[0];

type DadosEdicaoConta = Parameters<typeof atualizarConta>[1];

/** Formulário de conta: serve para criar e, com `conta`, para editar nome, tipo e saldo. */
function FormConta({
  ocupado,
  membros,
  conta,
  rotulo,
  limpar,
  tipos,
  moedaTravada,
  onCancelar,
  onEnviar,
}: {
  ocupado: boolean;
  tipos?: TipoConta[];
  /** Conta que já tem lançamentos: a moeda não pode mais mudar. */
  moedaTravada?: boolean;
  membros: NonNullable<Dados["membros"]>;
  conta?: Conta;
  rotulo: string;
  limpar?: boolean;
  onCancelar?: () => void;
  onEnviar: (c: DadosNovaConta & DadosEdicaoConta) => void;
}) {
  const editar = !!conta;
  const texto = (n: unknown) => (n == null || n === "" ? "" : String(n).replace(".", ","));
  const [bandeira, setBandeira] = useState(conta?.bandeira ?? "");
  const [finalCartao, setFinalCartao] = useState(conta?.final_cartao ?? "");
  const [fechamento, setFechamento] = useState(conta?.dia_fechamento ? String(conta.dia_fechamento) : "");
  const [titular, setTitular] = useState(conta?.titular_id ?? "");
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? tipos?.[0] ?? "Corrente");
  const [valor, setValor] = useState(conta ? texto(conta.tipo === "Crédito" ? conta.limite_total : conta.saldo_atual) : "");
  const [fatura, setFatura] = useState(conta?.tipo === "Crédito" ? texto(Math.abs(num(conta.saldo_atual))) : "");
  const [dia, setDia] = useState(conta?.dia_vencimento ? String(conta.dia_vencimento) : "");
  const [moeda, setMoeda] = useState(conta?.moeda || "BRL");
  const [erro, setErro] = useState("");

  const simbolo = tipo === "Crédito" ? "R$" : simboloDe(moeda);
  const rotuloValor = tipo === "Crédito" ? "Limite do cartão (R$)" : tipo === "Investimento" ? `Valor investido (${simbolo})` : `Saldo atual (${simbolo})`;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    const d = dia ? Math.trunc(Number(dia)) : null;
    if (tipo === "Crédito" && (!d || d < 1 || d > 31)) return setErro("Informe o dia de vencimento da fatura (1 a 31).");
    const f = fechamento ? Math.trunc(Number(fechamento)) : null;
    if (tipo === "Crédito" && f !== null && (f < 1 || f > 31)) return setErro("O dia de fechamento vai de 1 a 31.");
    if (tipo === "Crédito" && finalCartao && !/^\d{4}$/.test(finalCartao)) return setErro("Informe só os 4 últimos dígitos do cartão.");
    setErro("");
    onEnviar({
      nome: nome.trim(),
      tipo,
      valor: lerValor(valor),
      fatura: tipo === "Crédito" ? lerValor(fatura) : 0,
      diaVencimento: tipo === "Crédito" ? d : null,
      bandeira: tipo === "Crédito" ? bandeira || null : null,
      finalCartao: tipo === "Crédito" ? finalCartao || null : null,
      diaFechamento: tipo === "Crédito" ? f : null,
      titularId: tipo === "Crédito" ? titular || null : null,
      moeda: tipo === "Crédito" ? "BRL" : moeda,
      antes: conta ? { moeda: conta.moeda || "BRL", saldo: num(conta.saldo_atual), custo: num(conta.custo_brl) } : undefined,
    });
    if (limpar) {
      setNome("");
      setValor("");
      setFatura("");
      setDia("");
      setBandeira("");
      setFinalCartao("");
      setFechamento("");
      setTitular("");
      setMoeda("BRL");
    }
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-2 gap-3" noValidate>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={`${editar ? "e" : "n"}-nome`} className="label">
          Nome
        </label>
        <input id={`${editar ? "e" : "n"}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: Nubank" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={`${editar ? "e" : "n"}-tipo`} className="label">
          Tipo
        </label>
        <select id={`${editar ? "e" : "n"}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)} className="field">
          {(!tipos || tipos.includes("Corrente")) && <option value="Corrente">Conta corrente</option>}
          {(!tipos || tipos.includes("Crédito")) && <option value="Crédito">Cartão de crédito</option>}
          {(!tipos || tipos.includes("Investimento")) && <option value="Investimento">Investimento</option>}
        </select>
      </div>
      {tipo !== "Crédito" && (
        <div className="col-span-2">
          <label htmlFor={`${editar ? "e" : "n"}-moeda`} className="label">
            Moeda do saldo
          </label>
          <select id={`${editar ? "e" : "n"}-moeda`} value={moeda} onChange={(e) => setMoeda(e.target.value)} className="field" disabled={moedaTravada}>
            {MOEDAS.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.simbolo} {m.nome} ({m.codigo})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            {moedaTravada
              ? "A moeda não muda depois que a conta tem lançamentos."
              : moeda === "BRL"
                ? "Para conta em dólar, euro etc. (Revolut, OKX…), escolha a moeda e informe o saldo nela. O app mostra o saldo na moeda e a variação cambial em reais."
                : `Informe o saldo em ${moeda}. O custo em reais usa a cotação de hoje, e a variação cambial aparece daqui para a frente.`}
          </p>
        </div>
      )}
      <div className={tipo === "Crédito" ? "col-span-1" : "col-span-2"}>
        <label htmlFor={`${editar ? "e" : "n"}-valor`} className="label">
          {rotuloValor}
        </label>
        <input id={`${editar ? "e" : "n"}-valor`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" placeholder="0,00" />
      </div>
      {editar && tipo === "Crédito" && (
        <div className="col-span-1">
          <label htmlFor={`${editar ? "e" : "n"}-fatura`} className="label">
            Fatura em aberto (R$)
          </label>
          <input id={`${editar ? "e" : "n"}-fatura`} inputMode="decimal" value={fatura} onChange={(e) => setFatura(e.target.value)} className="field num" placeholder="0,00" />
        </div>
      )}
      {tipo === "Crédito" && (
        <div>
          <label htmlFor={`${editar ? "e" : "n"}-dia`} className="label">
            Vence no dia
          </label>
          <input id={`${editar ? "e" : "n"}-dia`} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="field num" placeholder="10" />
        </div>
      )}
      {tipo === "Crédito" && (
        <>
          <div>
            <label htmlFor={`${editar ? "e" : "n"}-fecha`} className="label">
              Fecha no dia
            </label>
            <input id={`${editar ? "e" : "n"}-fecha`} inputMode="numeric" value={fechamento} onChange={(e) => setFechamento(e.target.value)} className="field num" placeholder="3" />
          </div>
          <div>
            <label htmlFor={`${editar ? "e" : "n"}-band`} className="label">
              Bandeira
            </label>
            <select id={`${editar ? "e" : "n"}-band`} value={bandeira} onChange={(e) => setBandeira(e.target.value)} className="field">
              <option value="">Não informar</option>
              {["Visa", "Mastercard", "Elo", "American Express", "Hipercard"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${editar ? "e" : "n"}-final`} className="label">
              Final do cartão
            </label>
            <input id={`${editar ? "e" : "n"}-final`} inputMode="numeric" maxLength={4} value={finalCartao} onChange={(e) => setFinalCartao(e.target.value.replace(/\D/g, ""))} className="field num" placeholder="1234" />
          </div>
          {membros.length > 0 && (
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor={`${editar ? "e" : "n"}-tit`} className="label">
                De quem é o cartão
              </label>
              <select id={`${editar ? "e" : "n"}-tit`} value={titular} onChange={(e) => setTitular(e.target.value)} className="field">
                <option value="">Não informar</option>
                {membros.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nome || m.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="col-span-2 text-xs text-muted">Guardamos só os 4 últimos dígitos, nunca o número completo nem o código de segurança.</p>
        </>
      )}
      {erro && (
        <p role="alert" className="col-span-2 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      {editar && <p className="col-span-2 text-xs text-muted">Mudar o saldo aqui só corrige o número da conta: não cria lançamento e não mexe nos relatórios do mês.</p>}
      <div className="col-span-2 flex gap-3">
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={ocupado} className="btn btn-quiet flex-1">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={ocupado} className="btn btn-primary flex-1">
          {rotulo}
        </button>
      </div>
    </form>
  );
}

/** Formulário de conta fixa: serve para criar e, com `fixa`, para editar. */
function FormFixa({
  ocupado,
  membros,
  fixa,
  rotulo,
  limpar,
  onCancelar,
  onEnviar,
}: {
  ocupado: boolean;
  membros: NonNullable<Dados["membros"]>;
  fixa?: DespesaFixa;
  rotulo: string;
  limpar?: boolean;
  onCancelar?: () => void;
  onEnviar: (f: Parameters<typeof criarFixa>[0]) => void;
}) {
  const editar = !!fixa;
  const p = editar ? "xe" : "x";
  const [nome, setNome] = useState(fixa?.nome ?? "");
  const [valor, setValor] = useState(fixa ? String(num(fixa.valor)).replace(".", ",") : "");
  const [dia, setDia] = useState(fixa ? String(fixa.dia_vencimento) : "");
  const [flutuante, setFlutuante] = useState(!!fixa?.flutuante);
  const [inicio, setInicio] = useState(fixa?.inicio ?? "");
  const [avisar, setAvisar] = useState<string[] | null>(fixa?.avisar && fixa.avisar.length > 0 ? fixa.avisar : null);
  const [erro, setErro] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    const d = Math.trunc(Number(dia));
    if (!nome.trim()) return setErro("Informe o nome.");
    if (!(v > 0)) return setErro("Informe um valor maior que zero.");
    if (!(d >= 1 && d <= 31)) return setErro("Informe o dia de vencimento (1 a 31).");
    setErro("");
    onEnviar({ nome: nome.trim(), valor: v, dia: d, flutuante, inicio: inicio || null, avisar });
    if (limpar) {
      setNome("");
      setValor("");
      setDia("");
      setFlutuante(false);
      setInicio("");
      setAvisar(null);
    }
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-5 gap-3" noValidate>
      <div className="col-span-5 sm:col-span-3">
        <label htmlFor={`${p}-nome`} className="label">
          Nome
        </label>
        <input id={`${p}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: Aluguel" />
        {!editar && <p className="mt-1 text-sm text-muted">Use o mesmo nome de uma categoria para preencher o valor ao lançar.</p>}
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label htmlFor={`${p}-valor`} className="label">
          {flutuante ? "Valor base (R$)" : "Valor (R$)"}
        </label>
        <input id={`${p}-valor`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={`${p}-dia`} className="label">
          Dia
        </label>
        <input id={`${p}-dia`} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="field num" placeholder="5" />
      </div>
      <label className="col-span-5 flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" checked={flutuante} onChange={(e) => setFlutuante(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
        <span>
          Valor variável (luz, água, cartão…)
          <span className="block text-muted">O valor acima é só uma base. Ao pagar, o app pede para você confirmar o valor do mês.</span>
        </span>
      </label>
      {editar && (
        <div className="col-span-5 sm:col-span-2">
          <label htmlFor={`${p}-inicio`} className="label">
            Cobrar a partir de
          </label>
          <input id={`${p}-inicio`} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="field" />
        </div>
      )}
      <div className="col-span-5 empty:hidden">
        <QuemRecebe membros={membros} valor={avisar} onChange={setAvisar} idBase={`${p}-av`} />
      </div>
      {erro && (
        <p role="alert" className="col-span-5 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <div className="col-span-5 flex gap-3">
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={ocupado} className="btn btn-quiet flex-1">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={ocupado} className="btn btn-primary flex-1">
          {rotulo}
        </button>
      </div>
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
