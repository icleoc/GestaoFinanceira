"use client";

import { useState } from "react";
import { atualizarMeuNome } from "@/lib/data";
import Modal from "./Modal";

/** Nome com que a pessoa aparece no app (saudação, extrato, equipe). */
export default function PerfilModal({ nomeAtual, email, onClose, onFeito }: { nomeAtual: string; email: string; onClose: () => void; onFeito: (nome: string) => void }) {
  const [nome, setNome] = useState(nomeAtual);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (limpo.length < 2) return setErro("Escreva o seu nome.");
    if (limpo.length > 60) return setErro("Use até 60 letras.");
    setOcupado(true);
    try {
      await atualizarMeuNome(limpo);
      onFeito(limpo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setOcupado(false);
    }
  }

  return (
    <Modal titulo="Meu perfil" onClose={onClose} largura="md">
      <form onSubmit={salvar} className="space-y-4 p-5" noValidate>
        <div>
          <label htmlFor="p-nome" className="label">
            Nome de exibição
          </label>
          <input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" autoComplete="name" maxLength={60} placeholder="Seu nome completo ou como quer ser chamado" />
          <p className="mt-1 text-sm text-muted">É o nome que aparece na saudação, no extrato e para a família. O e-mail de acesso ({email}) não muda.</p>
        </div>
        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}
        <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}
