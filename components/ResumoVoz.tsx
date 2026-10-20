"use client";

import { useEffect, useRef, useState } from "react";

/** Botão que lê em voz alta o resumo do painel (voz do próprio aparelho, sem custo). */
export default function ResumoVoz({ montarTexto }: { montarTexto: () => string }) {
  const [falando, setFalando] = useState(false);
  const [texto, setTexto] = useState("");
  const [suporta, setSuporta] = useState(true);
  const fim = useRef<() => void>(() => undefined);

  useEffect(() => {
    setSuporta(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function parar() {
    window.speechSynthesis.cancel();
    setFalando(false);
  }

  function falar() {
    if (falando) return parar();
    const t = montarTexto();
    setTexto(t);
    const fala = new SpeechSynthesisUtterance(t);
    fala.lang = "pt-BR";
    fala.rate = 1;
    // Prefere uma voz em português do Brasil quando o aparelho tem.
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase() === "pt-br") ?? window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
    if (voz) fala.voice = voz;
    fim.current = () => setFalando(false);
    fala.onend = fim.current;
    fala.onerror = fim.current;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(fala);
    setFalando(true);
  }

  if (!suporta) return null;

  return (
    <section className="panel flex flex-wrap items-center gap-3 p-4" aria-label="Resumo por voz">
      <button onClick={falar} className={`btn ${falando ? "btn-quiet" : "btn-primary"} gap-2`} aria-pressed={falando}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {falando ? (
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            <>
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          )}
        </svg>
        {falando ? "Parar" : "Ouvir meu resumo"}
      </button>
      <p className="min-w-0 flex-1 text-sm text-muted">{falando || texto ? "" : "O assistente fala como estão suas contas hoje."}</p>
      {texto && (
        <p className="w-full text-sm text-muted" role="status">
          {texto}
        </p>
      )}
    </section>
  );
}
