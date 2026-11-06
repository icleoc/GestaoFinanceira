"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Modal from "./Modal";

function Casca({ embutido, titulo, onClose, children }: { embutido?: boolean; titulo: string; onClose: () => void; children: React.ReactNode }) {
  return embutido ? <>{children}</> : <Modal titulo={titulo} onClose={onClose} largura="md">{children}</Modal>;
}

export default function TrocarSenha({ onClose, onFeito, embutido = false }: { onClose: () => void; onFeito: () => void; embutido?: boolean }) {
  const [nova, setNova] = useState("");
  const [repete, setRepete] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (nova.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (nova !== repete) return setErro("As duas senhas não são iguais.");
    setOcupado(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: nova });
    setOcupado(false);
    if (error) {
      return setErro(/same|different/i.test(error.message) ? "Escolha uma senha diferente da atual." : error.message);
    }
    onFeito();
  }

  return (
    <Casca embutido={embutido} titulo="Alterar minha senha" onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4 p-5" noValidate>
        <div>
          <label htmlFor="s-nova" className="label">
            Nova senha
          </label>
          <input id="s-nova" type="password" value={nova} onChange={(e) => setNova(e.target.value)} className="field" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="s-rep" className="label">
            Repita a nova senha
          </label>
          <input id="s-rep" type="password" value={repete} onChange={(e) => setRepete(e.target.value)} className="field" autoComplete="new-password" />
        </div>
        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}
        <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
          {ocupado ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </Casca>
  );
}
