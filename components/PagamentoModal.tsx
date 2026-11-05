"use client";

import { useMemo, useState } from "react";
import type { Dados, DespesaFixa, Divida, Id } from "@/lib/types";
import { monthOf, montarLancamento, num, round2, todayISO } from "@/lib/finance";
import { darBaixaFixa, inserirTransacoes, pagarParcela } from "@/lib/data";
import { contaEstrangeira } from "@/lib/cambio";
import { dateBR, money } from "@/lib/format";
import CategoriaNova, { NOVA_CATEGORIA } from "./CategoriaNova";
import Modal from "./Modal";

export type AlvoPagamento =
  | { tipo: "fixa"; fixa: DespesaFixa }
  | { tipo: "divida"; divida: Divida; indice: number; total: number; vencimento: string };

const FORMAS = ["Pix", "Boleto", "Débito automático", "Transferência", "Cartão de crédito"] as const;
type Forma = (typeof FORMAS)[number];

function lerValor(t: string): number {
  const s = t.trim();
  if (!s) return 0;
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

/**
 * "Já paguei": pergunta quanto, quando, como e por onde foi pago, lança no extrato
 * (na data do pagamento) e tira a conta dos avisos.
 */
export default function PagamentoModal({
  dados,
  alvo,
  onClose,
  onFeito,
  onSoMarcar,
}: {
  dados: Dados;
  alvo: AlvoPagamento;
  onClose: () => void;
  onFeito: (mensagem: string) => void;
  /** Conta que foi paga antes de usar o app: só marca, sem lançar. */
  onSoMarcar?: () => void;
}) {
  const hoje = todayISO();
  const nome = alvo.tipo === "fixa" ? alvo.fixa.nome : alvo.divida.nome;
  const valorBase = alvo.tipo === "fixa" ? num(alvo.fixa.valor) : num(alvo.divida.valor_parcela);
  const flutuante = alvo.tipo === "fixa" && !!alvo.fixa.flutuante;

  const contasReais = useMemo(() => dados.contas.filter((c) => c.tipo !== "Investimento" && !contaEstrangeira(c)), [dados.contas]);
  const categoriasDespesa = dados.categorias.filter((c) => c.tipo === "Despesa");

  const categoriaInicial = (() => {
    if (alvo.tipo === "divida" && alvo.divida.categoria_id != null) return String(alvo.divida.categoria_id);
    const igual = categoriasDespesa.find((c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    return igual ? String(igual.id) : "";
  })();

  const [valor, setValor] = useState(String(valorBase).replace(".", ","));
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<Forma>(alvo.tipo === "divida" && alvo.divida.forma === "boleto" ? "Boleto" : "Pix");
  const credito = forma === "Cartão de crédito";
  const contasDaForma = contasReais.filter((c) => (credito ? c.tipo === "Crédito" : c.tipo !== "Crédito"));
  const [contaId, setContaId] = useState(() => {
    const pref = alvo.tipo === "divida" && alvo.divida.conta_id != null ? contasReais.find((c) => String(c.id) === String(alvo.divida.conta_id) && c.tipo !== "Crédito") : undefined;
    const padrao = pref ?? contasReais.find((c) => c.tipo === "Corrente") ?? contasReais[0];
    return padrao ? String(padrao.id) : "";
  });
  const [parcelas, setParcelas] = useState(1);
  const [categoriaId, setCategoriaId] = useState(categoriaInicial);
  const [criandoCat, setCriandoCat] = useState(false);
  const [criadas, setCriadas] = useState(dados.categorias.slice(0, 0));
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const todasCategorias = [...categoriasDespesa, ...criadas.filter((c) => !categoriasDespesa.some((b) => String(b.id) === String(c.id)))];
  const contaValida = contasDaForma.some((c) => String(c.id) === contaId) ? contaId : contasDaForma[0] ? String(contasDaForma[0].id) : "";
  const v = lerValor(valor);

  function trocarForma(f: Forma) {
    setForma(f);
    setParcelas(1);
    const lista = contasReais.filter((c) => (f === "Cartão de crédito" ? c.tipo === "Crédito" : c.tipo !== "Crédito"));
    if (!lista.some((c) => String(c.id) === contaId)) setContaId(lista[0] ? String(lista[0].id) : "");
  }

  async function confirmar() {
    setErro("");
    const conta = contasReais.find((c) => String(c.id) === contaValida);
    if (!conta) return setErro(credito ? "Cadastre um cartão em Gerenciar para pagar no crédito." : "Escolha de onde saiu o pagamento.");
    if (!(v > 0)) return setErro("Informe o valor pago.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hoje) return setErro("A data do pagamento não pode ser no futuro.");
    const catId = todasCategorias.find((c) => String(c.id) === categoriaId)?.id ?? null;
    setOcupado(true);
    try {
      if (alvo.tipo === "divida") {
        // Parcela de financiamento/compra parcelada: lança o valor da parcela e avança a contagem.
        await pagarParcela({ ...alvo.divida, parcelas_pagas: alvo.indice - 1, valor_parcela: v }, { lancar: true, contaId: conta.id, categoriaId: catId, data });
        onFeito(`Parcela ${alvo.indice}/${alvo.total} de ${nome} paga e lançada no extrato.`);
        return;
      }
      const plano = montarLancamento({
        operacao: "despesa",
        data,
        descricao: `${nome} (${forma})`,
        valor: v,
        parcelas: credito ? parcelas : 1,
        origemId: conta.id as Id,
        destinoId: null,
        categoriaId: catId,
        diasResgate: 0,
        comTaxa: false,
        totalCobrado: 0,
      });
      if (!plano.ok) {
        setErro(plano.erro);
        setOcupado(false);
        return;
      }
      await inserirTransacoes(plano.linhas);
      // Pagou adiantado (mês anterior): o lançamento não cai neste mês, então a baixa garante que o aviso some.
      if (monthOf(data) !== monthOf(hoje)) await darBaixaFixa(alvo.fixa.id, monthOf(hoje)).catch(() => undefined);
      onFeito(`${nome}: pagamento de ${money(v)} lançado em ${dateBR(data)}${credito && parcelas > 1 ? ` em ${parcelas}x` : ""}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o pagamento.");
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={`Já paguei: ${nome}`} onClose={onClose} largura="md">
      <div className="space-y-4 p-5">
        {alvo.tipo === "divida" && (
          <p className="rounded-xl bg-sunken p-3 text-sm">
            Parcela <b>{alvo.indice}/{alvo.total}</b>, vencimento em {dateBR(alvo.vencimento)}.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pg-valor" className="label">
              {flutuante ? "Valor pago neste mês (R$)" : "Valor pago (R$)"}
            </label>
            <input id="pg-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" />
          </div>
          <div>
            <label htmlFor="pg-data" className="label">
              Data do pagamento
            </label>
            <input id="pg-data" type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} className="field" />
          </div>
        </div>

        <div>
          <p className="label">Como foi pago?</p>
          <div role="radiogroup" aria-label="Forma de pagamento" className="flex flex-wrap gap-2">
            {FORMAS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={forma === f}
                onClick={() => trocarForma(f)}
                className={"rounded-full border px-3 py-1.5 text-sm " + (forma === f ? "border-accent bg-accent/10 font-medium" : "border-line text-muted hover:text-ink")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className={credito ? "grid grid-cols-2 gap-3" : ""}>
          <div>
            <label htmlFor="pg-conta" className="label">
              {credito ? "Qual cartão?" : "Por onde saiu o dinheiro?"}
            </label>
            <select id="pg-conta" value={contaValida} onChange={(e) => setContaId(e.target.value)} className="field">
              {contasDaForma.length === 0 && <option value="">{credito ? "Nenhum cartão cadastrado" : "Nenhuma conta cadastrada"}</option>}
              {contasDaForma.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          {credito && alvo.tipo === "fixa" && (
            <div>
              <label htmlFor="pg-parc" className="label">
                Parcelas
              </label>
              <select id="pg-parc" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="field">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "À vista" : `${n}x`}
                  </option>
                ))}
              </select>
              {parcelas > 1 && v > 0 && <p className="num mt-1 text-sm text-muted">{parcelas}x de {money(round2(v / parcelas))}</p>}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="pg-cat" className="label">
            Categoria
          </label>
          <select
            id="pg-cat"
            value={criandoCat ? NOVA_CATEGORIA : categoriaId}
            onChange={(e) => {
              if (e.target.value === NOVA_CATEGORIA) return setCriandoCat(true);
              setCriandoCat(false);
              setCategoriaId(e.target.value);
            }}
            className="field"
          >
            <option value="">Sem categoria</option>
            {todasCategorias.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
            <option value={NOVA_CATEGORIA}>＋ Nova categoria…</option>
          </select>
          {criandoCat && (
            <CategoriaNova
              tipo="Despesa"
              existentes={dados.categorias}
              onCancelar={() => setCriandoCat(false)}
              onCriada={(c) => {
                setCriadas((l) => [...l, c]);
                setCategoriaId(String(c.id));
                setCriandoCat(false);
              }}
            />
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}
        <button onClick={() => void confirmar()} disabled={ocupado} className="btn btn-primary w-full py-3">
          {ocupado ? "Registrando…" : "Registrar pagamento"}
        </button>
        <p className="text-center text-xs text-muted">O pagamento entra no extrato do mês, na data escolhida, e a conta sai dos avisos.</p>
        {onSoMarcar && (
          <button type="button" onClick={onSoMarcar} disabled={ocupado} className="block w-full text-center text-sm text-muted underline underline-offset-2 hover:text-ink">
            Foi pago antes de usar o app? Só marcar como paga (sem lançar)
          </button>
        )}
      </div>
    </Modal>
  );
}
