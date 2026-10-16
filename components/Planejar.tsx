"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dados, FormaCompra, Pretensao } from "@/lib/types";
import { num, todayISO } from "@/lib/finance";
import { analisarPretensao, montarPerfil, resumirLista, type Analise, type Veredito } from "@/lib/planejamento";
import { criarPretensao, excluirPretensao, mudarStatusPretensao } from "@/lib/data";
import { dateBR, money } from "@/lib/format";

interface Props {
  dados: Dados;
  podeEditar: boolean;
  onMudou: (mensagem: string) => void;
}

const FORMAS: { id: FormaCompra; nome: string }[] = [
  { id: "avista", nome: "À vista" },
  { id: "parcelado", nome: "Parcelado no cartão" },
  { id: "financiado", nome: "Financiado" },
];
const NOME_FORMA: Record<FormaCompra, string> = { avista: "À vista", parcelado: "Parcelado", financiado: "Financiado" };

const COR: Record<Veredito, { caixa: string; texto: string }> = {
  tranquilo: { caixa: "border-accent/40 bg-accent/10", texto: "text-accent" },
  atencao: { caixa: "border-warn/40 bg-warn/10", texto: "text-warn" },
  arriscado: { caixa: "border-neg/40 bg-neg/10", texto: "text-neg" },
  "sem-dados": { caixa: "border-line bg-sunken", texto: "text-muted" },
};

function lerValor(texto: string): number {
  const s = texto.trim();
  if (!s) return 0;
  return num(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

function Veredicto({ a }: { a: Analise }) {
  const cor = COR[a.veredito];
  return (
    <div className={`rounded-xl border p-4 ${cor.caixa}`}>
      <p className={`font-display text-base font-semibold ${cor.texto}`}>{a.titulo}</p>
      {a.forma !== "avista" && (
        <p className="num mt-1 text-sm">
          {a.nParcelas}x de <b>{money(a.parcela)}</b>
          {a.entrada > 0 && <> + entrada de {money(a.entrada)}</>}
        </p>
      )}
      {a.pctRendaParcelas !== null && (
        <div className="mt-3" aria-hidden>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${a.veredito === "arriscado" ? "bg-neg" : a.veredito === "atencao" ? "bg-warn" : "bg-accent"}`}
              style={{ width: `${Math.min(100, a.pctRendaParcelas)}%` }}
            />
          </div>
        </div>
      )}
      <ul className="mt-3 space-y-1.5 text-sm text-ink/90">
        {a.detalhes.map((d) => (
          <li key={d} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Planejar({ dados, podeEditar, onMudou }: Props) {
  const hoje = todayISO();
  const [rendaManual, setRendaManual] = useState("");
  useEffect(() => {
    try {
      setRendaManual(localStorage.getItem("rendaManual") ?? "");
    } catch {
      /* ignora */
    }
  }, []);
  const perfil = useMemo(() => montarPerfil(dados, hoje, lerValor(rendaManual)), [dados, hoje, rendaManual]);

  const ativas = dados.pretensoes.filter((p) => p.status === "desejo");
  const encerradas = dados.pretensoes.filter((p) => p.status !== "desejo");
  const resumo = useMemo(() => resumirLista(dados.pretensoes, perfil), [dados.pretensoes, perfil]);

  // Formulário
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaCompra>("avista");
  const [parcelas, setParcelas] = useState(12);
  const [entrada, setEntrada] = useState("");
  const [juros, setJuros] = useState("");
  const [prevista, setPrevista] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const previa = useMemo(() => {
    const v = lerValor(valor);
    if (v <= 0) return null;
    return analisarPretensao(
      { forma, valor: v, parcelas: forma === "avista" ? 1 : parcelas, entrada: lerValor(entrada), juros_mensal: lerValor(juros) },
      perfil,
    );
  }, [valor, forma, parcelas, entrada, juros, perfil]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const v = lerValor(valor);
    if (!nome.trim()) return setErro("Diga o que você quer comprar.");
    if (v <= 0) return setErro("Informe o valor.");
    if (forma !== "avista" && lerValor(entrada) >= v) return setErro("A entrada precisa ser menor que o valor.");
    setOcupado(true);
    try {
      await criarPretensao({
        nome: nome.trim(),
        categoria: categoria.trim() || null,
        valor: v,
        forma,
        parcelas: forma === "avista" ? 1 : parcelas,
        entrada: forma === "avista" ? 0 : lerValor(entrada),
        juros_mensal: forma === "financiado" ? lerValor(juros) : 0,
        prevista: prevista || null,
      });
      setNome("");
      setCategoria("");
      setValor("");
      setEntrada("");
      setJuros("");
      setPrevista("");
      onMudou("Pretensão adicionada à lista.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function agir(fn: () => Promise<void>, mensagem: string) {
    setErro("");
    try {
      await fn();
      onMudou(mensagem);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  }

  const origem = {
    media: "média dos seus últimos meses",
    mes: "receitas deste mês",
    manual: "valor que você informou",
    nenhuma: "nenhuma receita encontrada",
  }[perfil.origemRenda];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Planejar compras</h2>
        <p className="mt-1 max-w-2xl text-muted">
          Coloque aqui o que você quer comprar. Eu mostro quanto cada compra pesa no seu orçamento antes de você assumir o compromisso.
        </p>
      </div>

      <section className="panel p-5 sm:p-6" aria-labelledby="titulo-perfil">
        <h3 id="titulo-perfil" className="font-display text-lg font-semibold">
          Sua situação hoje
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { t: "Renda mensal", v: perfil.renda, nota: origem },
            { t: "Gasto médio por mês", v: perfil.gastoMedio, nota: "últimos meses" },
            { t: "Sobra por mês", v: perfil.sobraMensal, nota: "renda menos gastos" },
            { t: "Em conta agora", v: perfil.liquidez, nota: "contas correntes" },
          ].map((x) => (
            <div key={x.t}>
              <dt className="text-sm text-muted">{x.t}</dt>
              <dd className="font-display num mt-0.5 text-xl font-semibold sm:text-2xl">{money(x.v)}</dd>
              <dd className="text-xs text-muted">{x.nota}</dd>
            </div>
          ))}
        </dl>
        {perfil.parcelasProximoMes > 0 && (
          <p className="mt-4 text-sm text-muted">
            Já estão lançados <b className="num text-ink">{money(perfil.parcelasProximoMes)}</b> de parcelas de cartão para o mês que vem.
          </p>
        )}
        {perfil.origemRenda === "nenhuma" && (
          <div className="mt-4 rounded-xl bg-sunken p-3">
            <label htmlFor="renda-manual" className="label">
              Ainda não há receitas lançadas. Informe sua renda mensal para eu calcular (ou lance seu salário):
            </label>
            <input
              id="renda-manual"
              inputMode="decimal"
              placeholder="0,00"
              value={rendaManual}
              onChange={(e) => {
                setRendaManual(e.target.value);
                try {
                  localStorage.setItem("rendaManual", e.target.value);
                } catch {
                  /* ignora */
                }
              }}
              className="field num max-w-xs"
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-4" aria-labelledby="titulo-lista">
          <h3 id="titulo-lista" className="font-display text-lg font-semibold">
            Lista de desejos {ativas.length > 0 && <span className="text-muted">({ativas.length})</span>}
          </h3>

          {ativas.length > 1 && (
            <div className="panel p-4 text-sm">
              <p className="font-semibold">Se você comprasse tudo da lista</p>
              <p className="num mt-1 text-muted">
                {resumo.parcelasPorMes > 0 && <>Parcelas de {money(resumo.parcelasPorMes)} por mês</>}
                {resumo.parcelasPorMes > 0 && resumo.avistaTotal > 0 && " e "}
                {resumo.avistaTotal > 0 && <>{money(resumo.avistaTotal)} para pagar de uma vez</>}
                {resumo.pctRendaParcelas !== null && resumo.parcelasPorMes > 0 && <>. Parcelas ocupariam {Math.round(resumo.pctRendaParcelas)}% da renda.</>}
              </p>
            </div>
          )}

          {ativas.length === 0 && (
            <div className="panel p-6 text-center text-muted">
              <p>Nada na lista ainda.</p>
              <p className="mt-1 text-sm">{podeEditar ? "Adicione a primeira pretensão ao lado." : "Quem tem permissão de planejar pode adicionar itens."}</p>
            </div>
          )}

          {ativas.map((p: Pretensao) => {
            const a = analisarPretensao(p, perfil);
            return (
              <article key={p.id} className="panel pop-in p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display text-lg font-semibold leading-tight">{p.nome}</h4>
                    <p className="text-sm text-muted">
                      {NOME_FORMA[p.forma]}
                      {p.categoria ? ` · ${p.categoria}` : ""}
                      {p.prevista ? ` · previsto para ${dateBR(p.prevista)}` : ""}
                    </p>
                  </div>
                  <p className="font-display num text-xl font-semibold">{money(num(p.valor))}</p>
                </div>
                <div className="mt-3">
                  <Veredicto a={a} />
                </div>
                {podeEditar && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => agir(() => mudarStatusPretensao(p.id, "comprada"), "Marcada como comprada.")} className="btn btn-quiet px-3 py-1.5">
                      Comprei
                    </button>
                    <button onClick={() => agir(() => mudarStatusPretensao(p.id, "descartada"), "Item descartado.")} className="btn btn-quiet px-3 py-1.5">
                      Desisti
                    </button>
                    <button onClick={() => agir(() => excluirPretensao(p.id), "Item excluído.")} className="btn btn-quiet px-3 py-1.5 text-neg">
                      Excluir
                    </button>
                  </div>
                )}
              </article>
            );
          })}

          {encerradas.length > 0 && (
            <details className="panel p-4">
              <summary className="cursor-pointer text-sm font-semibold">Já resolvidas ({encerradas.length})</summary>
              <ul className="mt-3 divide-y divide-line text-sm">
                {encerradas.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {p.nome} <span className="text-muted">· {p.status === "comprada" ? "comprada" : "descartada"}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="num">{money(num(p.valor))}</span>
                      {podeEditar && (
                        <button onClick={() => agir(() => mudarStatusPretensao(p.id, "desejo"), "Voltou para a lista.")} className="text-accent hover:underline">
                          Reabrir
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {podeEditar && (
          <section className="panel h-fit p-5 sm:p-6 lg:sticky lg:top-4" aria-labelledby="titulo-nova">
            <h3 id="titulo-nova" className="font-display text-lg font-semibold">
              Nova pretensão
            </h3>
            <form onSubmit={salvar} className="mt-4 space-y-4" noValidate>
              <div>
                <label htmlFor="p-nome" className="label">
                  O que você quer comprar?
                </label>
                <input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" placeholder="Ex.: notebook, carro, viagem" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-valor" className="label">
                    Valor total (R$)
                  </label>
                  <input id="p-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="field num" placeholder="0,00" />
                </div>
                <div>
                  <label htmlFor="p-cat" className="label">
                    Tipo de compra
                  </label>
                  <input id="p-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="field" placeholder="Eletrônico, veículo…" />
                </div>
              </div>

              <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
                {FORMAS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={forma === f.id}
                    onClick={() => setForma(f.id)}
                    className={`rounded-lg px-1.5 py-2 text-[13px] font-medium leading-tight transition-colors ${
                      forma === f.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>

              {forma !== "avista" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="p-parc" className="label">
                      Parcelas: <b className="num text-ink">{parcelas}x</b>
                    </label>
                    <input
                      id="p-parc"
                      type="range"
                      min={2}
                      max={forma === "financiado" ? 120 : 24}
                      value={Math.min(parcelas, forma === "financiado" ? 120 : 24)}
                      onChange={(e) => setParcelas(Number(e.target.value))}
                      className="h-11 w-full cursor-pointer accent-[rgb(var(--accent))]"
                    />
                  </div>
                  <div>
                    <label htmlFor="p-entrada" className="label">
                      Entrada (R$)
                    </label>
                    <input id="p-entrada" inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} className="field num" placeholder="0,00" />
                  </div>
                </div>
              )}
              {forma === "financiado" && (
                <div>
                  <label htmlFor="p-juros" className="label">
                    Juros por mês (%)
                  </label>
                  <input id="p-juros" inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} className="field num max-w-[10rem]" placeholder="1,5" />
                </div>
              )}
              <div>
                <label htmlFor="p-prevista" className="label">
                  Quando pretende comprar (opcional)
                </label>
                <input id="p-prevista" type="date" min={hoje} value={prevista} onChange={(e) => setPrevista(e.target.value)} className="field max-w-[12rem]" />
              </div>

              {previa && (
                <div aria-live="polite">
                  <p className="label">Como ficaria</p>
                  <Veredicto a={previa} />
                </div>
              )}

              {erro && (
                <p role="alert" className="text-sm font-medium text-neg">
                  {erro}
                </p>
              )}
              <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
                {ocupado ? "Salvando…" : "Adicionar à lista"}
              </button>
            </form>
          </section>
        )}
      </div>
      {!podeEditar && erro && (
        <p role="alert" className="text-sm font-medium text-neg">
          {erro}
        </p>
      )}
    </div>
  );
}
