"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dados, DadosNota, Id } from "@/lib/types";
import { montarLancamento, todayISO } from "@/lib/finance";
import { carteiraDaSessao, criarCategoria, enviarNota, excluirTransacoes, inserirTransacoes, removerNotas } from "@/lib/data";
import { camposLidos, lerNotaNoServidor } from "@/lib/nota";
import { reduzirImagem } from "@/lib/imagem";
import { dateBR, money } from "@/lib/format";
import Modal from "./Modal";

type Fase =
  | { f: "inicio" }
  | { f: "lendo"; url: string }
  | { f: "pronto"; url: string; resumo: Resumo }
  | { f: "erro"; url: string | null; msg: string };

interface Resumo {
  empresa: string;
  total: number;
  data: string;
  categoria: string | null;
  categoriaCriada: boolean;
  conta: string;
  ids: Id[];
  caminho: string | null;
  itens: DadosNota["itens"];
}

const CHAVE = "contaDasNotas";

/**
 * Lançamento por foto, num toque só: a pessoa escolhe de onde saiu o dinheiro e tira a foto.
 * O sistema lê a nota, escolhe a categoria pelo tipo de estabelecimento e já registra.
 */
export default function NotaRapida({ dados, onClose, onMudou }: { dados: Dados; onClose: () => void; onMudou: (msg: string) => void }) {
  const contas = useMemo(() => dados.contas.filter((c) => c.tipo !== "Investimento"), [dados.contas]);
  const [contaId, setContaId] = useState("");
  const [fase, setFase] = useState<Fase>({ f: "inicio" });
  const entrada = useRef<HTMLInputElement>(null);
  const jaRegistrou = useRef(false);

  // Conta usada na última nota; senão, a primeira conta corrente.
  useEffect(() => {
    let salva = "";
    try {
      salva = localStorage.getItem(CHAVE) ?? "";
    } catch {
      /* sem armazenamento: tudo bem */
    }
    const padrao = contas.find((c) => String(c.id) === salva) ?? contas.find((c) => c.tipo === "Corrente") ?? contas[0];
    setContaId(padrao ? String(padrao.id) : "");
  }, [contas]);

  // Libera o endereço temporário da miniatura ao trocar/fechar.
  useEffect(() => {
    const url = fase.f === "inicio" ? null : fase.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [fase]);

  async function processar(arquivo: File) {
    const conta = contas.find((c) => String(c.id) === contaId);
    if (!conta) return setFase({ f: "erro", url: null, msg: "Escolha de onde saiu o dinheiro." });
    try {
      localStorage.setItem(CHAVE, contaId);
    } catch {
      /* ignora */
    }
    const blob = await reduzirImagem(arquivo);
    const url = URL.createObjectURL(blob);
    setFase({ f: "lendo", url });

    let caminho: string | null = null;
    try {
      const nomes = dados.categorias.filter((c) => c.tipo === "Despesa").map((c) => c.nome);
      const lido = await lerNotaNoServidor(blob, carteiraDaSessao(), nomes);
      if (lido.total === null || !(lido.total > 0)) {
        return setFase({ f: "erro", url, msg: "Não consegui achar o valor total na nota. Tente outra foto, com mais luz e a nota inteira." });
      }
      if (camposLidos(lido) < 2) {
        return setFase({ f: "erro", url, msg: "A leitura ficou incompleta. Tente outra foto, com a nota inteira e bem enquadrada." });
      }

      // Categoria: a da lista; se nenhuma serve, cria a sugerida (quando a pessoa pode); senão "Outros".
      let categoriaId: Id | null = null;
      let categoriaNome: string | null = lido.categoria;
      let criada = false;
      if (lido.categoria) {
        categoriaId = dados.categorias.find((c) => c.tipo === "Despesa" && c.nome === lido.categoria)?.id ?? null;
      } else if (lido.categoriaNova) {
        try {
          categoriaId = await criarCategoria({ nome: lido.categoriaNova, tipo: "Despesa" });
          categoriaNome = lido.categoriaNova;
          criada = true;
        } catch {
          /* sem permissão para criar: cai para Outros */
        }
      }
      if (categoriaId === null) {
        const outros = dados.categorias.find((c) => c.tipo === "Despesa" && /^outros?$/i.test(c.nome.trim()));
        categoriaId = outros?.id ?? null;
        categoriaNome = outros?.nome ?? null;
      }

      const empresa = lido.empresa ?? "Compra";
      const data = lido.data ?? todayISO();
      const plano = montarLancamento({
        operacao: "despesa",
        data,
        descricao: empresa,
        valor: lido.total,
        parcelas: 1,
        origemId: conta.id,
        destinoId: null,
        categoriaId,
        diasResgate: 0,
        comTaxa: false,
        totalCobrado: 0,
      });
      if (!plano.ok) return setFase({ f: "erro", url, msg: plano.erro });

      caminho = await enviarNota(blob);
      const ids = await inserirTransacoes(plano.linhas.map((l) => ({ ...l, nota_path: caminho, nota_dados: lido })));
      jaRegistrou.current = true;
      setFase({
        f: "pronto",
        url,
        resumo: { empresa, total: lido.total, data, categoria: categoriaNome, categoriaCriada: criada, conta: conta.nome, ids, caminho, itens: lido.itens },
      });
    } catch (e) {
      if (caminho) await removerNotas([caminho]).catch(() => undefined);
      setFase({ f: "erro", url, msg: e instanceof Error ? e.message : "Não foi possível registrar a nota." });
    }
  }

  async function desfazer(r: Resumo) {
    try {
      await excluirTransacoes(r.ids);
      if (r.caminho) await removerNotas([r.caminho]).catch(() => undefined);
      jaRegistrou.current = false;
      setFase({ f: "inicio" });
      onMudou("Lançamento desfeito.");
    } catch (e) {
      setFase({ f: "erro", url: null, msg: e instanceof Error ? e.message : "Não foi possível desfazer." });
    }
  }

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void processar(arquivo);
  }

  function fechar() {
    if (jaRegistrou.current) onMudou("Nota registrada.");
    onClose();
  }

  const ocupado = fase.f === "lendo";

  return (
    <Modal titulo="Lançar por foto" onClose={fechar} largura="md">
      <div className="space-y-4 p-5">
        <input ref={entrada} type="file" accept="image/*" capture="environment" onChange={aoEscolher} className="sr-only" id="nota-rapida" tabIndex={-1} />

        {(fase.f === "inicio" || fase.f === "erro" || fase.f === "pronto") && (
          <div>
            <label htmlFor="nr-conta" className="label">
              De onde saiu o dinheiro?
            </label>
            <select id="nr-conta" value={contaId} onChange={(e) => setContaId(e.target.value)} className="field" disabled={ocupado}>
              {contas.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {fase.f === "lendo" && (
          <div className="flex items-center gap-3 rounded-xl bg-sunken p-3" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fase.url} alt="Nota enviada" className="size-16 rounded-lg object-cover" />
            <p className="animate-pulse text-sm text-muted">Lendo a nota e registrando…</p>
          </div>
        )}

        {fase.f === "erro" && (
          <p role="alert" className="text-sm font-medium text-neg">
            {fase.msg}
          </p>
        )}

        {fase.f === "pronto" && (
          <div role="status" className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <p className="font-semibold text-accent">Registrado</p>
            <p className="mt-1 text-lg font-medium">{fase.resumo.empresa}</p>
            <p className="num font-display text-2xl">{money(fase.resumo.total)}</p>
            <p className="mt-1 text-sm text-muted">
              {fase.resumo.categoria ? `${fase.resumo.categoria}${fase.resumo.categoriaCriada ? " (categoria nova)" : ""}` : "Sem categoria"} ·{" "}
              {fase.resumo.conta} · {dateBR(fase.resumo.data)}
            </p>
            {fase.resumo.itens.length > 0 && <p className="mt-1 text-xs text-muted">{fase.resumo.itens.length} {fase.resumo.itens.length === 1 ? "item lido" : "itens lidos"} da nota</p>}
            <button type="button" onClick={() => void desfazer(fase.resumo)} className="mt-3 text-sm font-semibold underline">
              Desfazer
            </button>
          </div>
        )}

        <button type="button" onClick={() => entrada.current?.click()} disabled={ocupado || contas.length === 0} className="btn btn-gold w-full py-3.5 text-base">
          {fase.f === "pronto" ? "Fotografar outra nota" : fase.f === "erro" ? "Tentar outra foto" : "Tirar foto da nota"}
        </button>
        <p className="text-center text-xs text-muted">O valor, a empresa e a categoria saem da própria nota. Confira o resultado e desfaça se algo estiver errado.</p>
      </div>
    </Modal>
  );
}
