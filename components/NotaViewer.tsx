"use client";

import { useEffect, useState } from "react";
import { enderecoDaNota } from "@/lib/data";
import type { DadosNota } from "@/lib/types";
import { dateBR, money } from "@/lib/format";
import { Linha } from "./Razao";
import Modal from "./Modal";

/** Mostra a foto de uma nota guardada. O endereço dura 2 minutos e só quem tem permissão consegue gerar. */
export default function NotaViewer({ caminho, titulo, dados, onClose }: { caminho: string; titulo: string; dados?: DadosNota | null; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    enderecoDaNota(caminho)
      .then((u) => vivo && setUrl(u))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível abrir a nota."));
    return () => {
      vivo = false;
    };
  }, [caminho]);

  return (
    <Modal titulo={`Nota: ${titulo}`} onClose={onClose} largura="lg">
      <div className="p-5">
        {erro && (
          <p role="alert" className="text-sm font-medium text-neg">
            {erro}
          </p>
        )}
        {!erro && !url && (
          <p className="py-10 text-center text-muted" role="status">
            Abrindo a foto…
          </p>
        )}
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Foto da nota de ${titulo}`} className="mx-auto max-h-[70dvh] w-auto rounded-lg border border-line" />
        )}
        {dados && (
          <div className="mt-5">
            <p className="label">Lido da nota</p>
            {dados.empresa && <Linha nome="Empresa" valor={dados.empresa} />}
            {dados.cnpj && <Linha nome="CNPJ" valor={dados.cnpj} />}
            {dados.data && <Linha nome="Data" valor={dateBR(dados.data)} />}
            {dados.itens.map((it, i) => (
              <Linha
                key={i}
                nome={`${it.quantidade && it.quantidade !== 1 ? `${it.quantidade}× ` : ""}${it.nome}`}
                valor={it.valor !== null ? money(it.valor) : "—"}
              />
            ))}
            {dados.total !== null && <Linha nome="Total" valor={money(dados.total)} destaque />}
          </div>
        )}
      </div>
    </Modal>
  );
}
