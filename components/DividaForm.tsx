"use client";

import { useMemo, useState } from "react";
import type { Dados, Divida, Id, TipoDivida } from "@/lib/types";
import { calcular, situacao, vencimento } from "@/lib/divida";
import { criarDivida, atualizarDivida } from "@/lib/data";
import { dateBR, money } from "@/lib/format";
import { num, todayISO } from "@/lib/finance";

function lerNumero(t: string): number {
  const s = t.trim();
  if (!s) return 0;
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

const texto = (n: number | string | null | undefined) => (n == null || n === "" || Number(n) === 0 ? "" : String(n).replace(".", ","));

function categoriaPadrao(dados: Dados, tipo: TipoDivida): string {
  const raiz = tipo === "emprestimo" ? "emprest" : "financ";
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const c = dados.categorias.find((x) => x.tipo === "Despesa" && norm(x.nome).startsWith(raiz));
  return c ? String(c.id) : "";
}

/** Cadastro de financiamento ou empréstimo: mostra os juros e o valor final enquanto a pessoa preenche. */
export default function DividaForm({ dados, divida, onSalvo }: { dados: Dados; divida?: Divida; onSalvo: (mensagem: string) => void }) {
  const [tipo, setTipo] = useState<TipoDivida>(divida?.tipo ?? "financiamento");
  const [nome, setNome] = useState(divida?.nome ?? "");
  const [valorBem, setValorBem] = useState(texto(divida?.valor_bem));
  const [entrada, setEntrada] = useState(texto(divida?.entrada));
  const [parcelas, setParcelas] = useState(divida ? String(divida.parcelas) : "");
  const [valorParcela, setValorParcela] = useState(texto(divida?.valor_parcela));
  const [primeira, setPrimeira] = useState(divida?.primeira_parcela ?? todayISO());
  const [contaId, setContaId] = useState(divida?.conta_id != null ? String(divida.conta_id) : "");
  const [categoriaId, setCategoriaId] = useState(divida?.categoria_id != null ? String(divida.categoria_id) : categoriaPadrao(dados, divida?.tipo ?? "financiamento"));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const emprestimo = tipo === "emprestimo";
  const n = Math.trunc(lerNumero(parcelas));
  const calc = useMemo(
    () => calcular({ valorBem: lerNumero(valorBem), entrada: emprestimo ? 0 : lerNumero(entrada), parcelas: n, valorParcela: lerNumero(valorParcela) }),
    [valorBem, entrada, n, valorParcela, emprestimo],
  );
  const nPagas = Math.min(divida?.parcelas_pagas ?? 0, Math.max(0, n));
  const contas = dados.contas.filter((c) => c.tipo !== "Investimento");
  const categoriasDespesa = dados.categorias.filter((c) => c.tipo === "Despesa");
  const idDe = <T extends { id: Id }>(lista: T[], v: string): Id | null => lista.find((x) => String(x.id) === v)?.id ?? null;

  const previa =
    calc.ok && n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(primeira)
      ? situacao(
          { id: "x", tipo, nome, valor_bem: lerNumero(valorBem), entrada: emprestimo ? 0 : lerNumero(entrada), parcelas: n, valor_parcela: lerNumero(valorParcela), primeira_parcela: primeira, parcelas_pagas: nPagas },
          todayISO(),
        )
      : null;

  function trocarTipo(t: TipoDivida) {
    setTipo(t);
    if (!categoriaId || categoriaId === categoriaPadrao(dados, tipo)) setCategoriaId(categoriaPadrao(dados, t));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Dê um nome, por exemplo: Carro ou Empréstimo do banco.");
    if (!calc.ok) return setErro(calc.aviso ?? "Preencha o valor, as parcelas e o valor de cada parcela.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeira)) return setErro("Informe o vencimento da 1ª parcela.");
    if (n > 600) return setErro("Use até 600 parcelas.");
    if (n < (divida?.parcelas_pagas ?? 0)) return setErro(`Já constam ${divida?.parcelas_pagas} parcelas pagas; o total não pode ser menor.`);
    setSalvando(true);
    try {
      const corpo = {
        tipo,
        nome: nome.trim(),
        valor_bem: lerNumero(valorBem),
        entrada: emprestimo ? 0 : lerNumero(entrada),
        parcelas: n,
        valor_parcela: lerNumero(valorParcela),
        primeira_parcela: primeira,
        parcelas_pagas: nPagas,
        conta_id: idDe(contas, contaId),
        categoria_id: idDe(categoriasDespesa, categoriaId),
      };
      if (divida) await atualizarDivida(divida.id, corpo);
      else await criarDivida(corpo);
      onSalvo(divida ? "Alterações salvas." : emprestimo ? "Empréstimo cadastrado." : "Financiamento cadastrado.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 p-5" noValidate>
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
        {(
          [
            ["financiamento", "Financiamento de um bem"],
            ["emprestimo", "Empréstimo"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={tipo === id}
            onClick={() => trocarTipo(id)}
            className={"rounded-lg px-2 py-2 text-sm font-medium transition-colors " + (tipo === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="d-nome" className="label">
          Nome
        </label>
        <input id="d-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={emprestimo ? "Empréstimo do banco" : "Carro, casa, moto…"} className="field" maxLength={80} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="d-valor" className="label">
            {emprestimo ? "Valor emprestado (R$)" : "Valor do bem (R$)"}
          </label>
          <input id="d-valor" inputMode="decimal" value={valorBem} onChange={(e) => setValorBem(e.target.value)} className="field num" placeholder="0,00" />
        </div>
        {!emprestimo && (
          <div>
            <label htmlFor="d-entrada" className="label">
              Entrada (R$)
            </label>
            <input id="d-entrada" inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} className="field num" placeholder="0,00" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="d-parcelas" className="label">
            Nº de parcelas
          </label>
          <input id="d-parcelas" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value.replace(/\D/g, ""))} className="field num" placeholder="48" />
        </div>
        <div>
          <label htmlFor="d-parcela" className="label">
            Valor de cada parcela (R$)
          </label>
          <input id="d-parcela" inputMode="decimal" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} className="field num" placeholder="0,00" />
        </div>
      </div>

      {(calc.ok || calc.aviso) && (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4" role="status" aria-live="polite">
          {calc.aviso && <p className="mb-2 text-sm font-medium text-neg">{calc.aviso}</p>}
          {calc.ok && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{emprestimo ? "Você recebeu" : "Financiado"}</dt>
              <dd className="num text-right font-medium">{money(calc.financiado)}</dd>
              <dt className="text-muted">Soma das parcelas</dt>
              <dd className="num text-right font-medium">{money(calc.totalParcelas)}</dd>
              <dt className="font-semibold">Juros que você paga</dt>
              <dd className="num text-right font-display text-lg font-semibold text-neg">
                {money(Math.max(0, calc.juros))} <span className="text-sm font-normal text-muted">({calc.jurosPct.toLocaleString("pt-BR")}%)</span>
              </dd>
              {calc.taxaMensalPct > 0 && (
                <>
                  <dt className="text-muted">Taxa embutida</dt>
                  <dd className="num text-right font-medium">{calc.taxaMensalPct.toLocaleString("pt-BR")}% ao mês</dd>
                </>
              )}
              <dt className="font-semibold">Valor final{!emprestimo && lerNumero(entrada) > 0 ? " (com a entrada)" : ""}</dt>
              <dd className="num text-right font-display text-lg font-semibold">{money(calc.totalPago)}</dd>
            </dl>
          )}
        </div>
      )}

      <div>
        <label htmlFor="d-primeira" className="label">
          Vencimento da 1ª parcela
        </label>
        <input id="d-primeira" type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} className="field" />
      </div>
      <p className="-mt-2 text-sm text-muted">
        Já está em andamento? Coloque a data da 1ª parcela. As parcelas antigas você marca como pagas na hora de pagar, e elas não entram no extrato nem nos relatórios.
      </p>
      {previa && previa.proxima && (
        <p className="rounded-xl bg-sunken p-3 text-sm">
          Próxima parcela: <strong>{previa.proxima.indice}/{previa.total}</strong>, vence em <strong>{dateBR(previa.proxima.data)}</strong>
          {previa.atrasadas > 0 ? <span className="font-semibold text-neg"> ({previa.atrasadas === 1 ? "1 parcela" : `${previa.atrasadas} parcelas`} já venceram sem constar como paga)</span> : ""}. Falta pagar <strong className="num">{money(previa.faltaPagar)}</strong>.
          {n > 0 && <span className="text-muted"> Última parcela em {dateBR(vencimento(primeira, n))}.</span>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="d-conta" className="label">
            Pago com (conta)
          </label>
          <select id="d-conta" value={contaId} onChange={(e) => setContaId(e.target.value)} className="field">
            <option value="">Escolher ao pagar</option>
            {contas.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-cat" className="label">
            Categoria
          </label>
          <select id="d-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="field">
            <option value="">Sem categoria</option>
            {categoriasDespesa.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-sm font-medium text-neg">
          {erro}
        </p>
      )}
      <button type="submit" disabled={salvando} className="btn btn-primary w-full py-3">
        {salvando ? "Salvando…" : divida ? "Salvar alterações" : emprestimo ? "Cadastrar empréstimo" : "Cadastrar financiamento"}
      </button>
    </form>
  );
}
