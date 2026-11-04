"use client";

import { useState } from "react";
import { criarCategoria } from "@/lib/data";
import type { Categoria, TipoCategoria } from "@/lib/types";

/** Valor da opção "criar nova" nos seletores de categoria. */
export const NOVA_CATEGORIA = "__nova";

/** Cria uma categoria sem sair do lançamento. */
export default function CategoriaNova({
  tipo,
  existentes,
  onCriada,
  onCancelar,
}: {
  tipo: TipoCategoria;
  existentes: Categoria[];
  onCriada: (c: Categoria) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function criar() {
    const limpo = nome.trim();
    if (!limpo) return setErro("Dê um nome à categoria.");
    const igual = existentes.find((c) => c.tipo === tipo && c.nome.trim().toLowerCase() === limpo.toLowerCase());
    if (igual) return onCriada(igual);
    setOcupado(true);
    setErro("");
    try {
      const id = await criarCategoria({ nome: limpo, tipo });
      onCriada({ id, nome: limpo, tipo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl bg-sunken p-3">
      <label htmlFor="cat-nova" className="label">
        Nome da nova categoria
      </label>
      <div className="flex gap-2">
        <input
          id="cat-nova"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void criar();
            }
          }}
          className="field"
          placeholder="Ex.: Pets"
          autoFocus
          disabled={ocupado}
        />
        <button type="button" onClick={() => void criar()} disabled={ocupado} className="btn btn-gold shrink-0">
          {ocupado ? "Criando…" : "Criar"}
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado} className="btn shrink-0">
          Cancelar
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-neg">
          {erro}
        </p>
      )}
    </div>
  );
}
