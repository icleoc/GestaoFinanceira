"use client";

import { useEffect, useState } from "react";
import { saudacao } from "@/lib/saudacao";

/** Cabeçalho da tela inicial: cumprimento de acordo com a hora e um resumo de uma linha. */
export default function Saudacao({ nome, resumo }: { nome: string; resumo: string }) {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    setTexto(saudacao(nome, new Date()));
  }, [nome]);
  return (
    <header className="min-h-[4.5rem]">
      <h1 className="font-display text-3xl sm:text-4xl" style={{ letterSpacing: "-0.02em" }}>
        {texto || " "}
      </h1>
      <p className="mt-1 text-muted">{resumo}</p>
    </header>
  );
}
