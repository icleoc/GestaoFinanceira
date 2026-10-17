"use client";

import { useCallback, useEffect, useState } from "react";
import { ativarBiometria, listarAparelhos, removerAparelho, rotuloBiometria, type Aparelho } from "@/lib/passkey";
import Modal from "./Modal";

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "nunca");

export default function FaceId({ onClose }: { onClose: () => void }) {
  const rotulo = rotuloBiometria();
  const [aparelhos, setAparelhos] = useState<Aparelho[] | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setAparelhos(await listarAparelhos());
    } catch (e) {
      setAparelhos([]);
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function ativar() {
    setErro("");
    setOk("");
    setOcupado(true);
    try {
      await ativarBiometria();
      setOk(`${rotulo} ativado. Na próxima vez é só tocar em “Entrar com ${rotulo}”.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar.");
    }
    setOcupado(false);
  }

  async function remover(id: string) {
    setErro("");
    setOk("");
    try {
      await removerAparelho(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  return (
    <Modal titulo={`Entrar com ${rotulo}`} onClose={onClose} largura="md">
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">
          Ative neste aparelho para entrar no app só com o rosto ou a digital, sem digitar e-mail e senha. A sua biometria fica no
          aparelho; o sistema guarda apenas uma chave de verificação.
        </p>
        <button onClick={ativar} disabled={ocupado} className="btn btn-primary w-full py-3">
          {ocupado ? "Aguardando o aparelho…" : `Ativar ${rotulo} neste aparelho`}
        </button>
        {ok && (
          <p role="status" className="text-sm font-medium text-accent">
            {ok}
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}
        {aparelhos && aparelhos.length > 0 && (
          <div>
            <p className="label">Aparelhos com acesso rápido</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {aparelhos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.nome ?? "Aparelho"}</p>
                    <p className="text-xs text-muted">
                      Ativado em {data(a.criado_em)} · último uso {data(a.ultimo_uso)}
                    </p>
                  </div>
                  <button onClick={() => remover(a.id)} className="btn btn-quiet shrink-0 text-neg">
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
