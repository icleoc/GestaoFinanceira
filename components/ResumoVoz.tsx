"use client";

import { useEffect, useRef, useState } from "react";

const CHAVE = "vozResumo";

/** Quanto mais natural a voz costuma soar, maior a nota (vozes neurais "Natural", "Online", do Google, Premium/Aprimorada). */
function plataforma(): "ios" | "android" | "outra" {
  if (typeof navigator === "undefined") return "outra";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "outra";
}

function nota(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let p = 0;
  // iPhone: a voz da Siri (ou a "Aprimorada") é a mais natural; Android: a voz do Google.
  const so = plataforma();
  if (so === "ios" && /siri|aprimorad|premium|enhanced/.test(n)) p += 60;
  if (so === "android" && /google/.test(n)) p += 60;
  if (/natural/.test(n)) p += 50;
  if (/online/.test(n)) p += 30;
  if (/google/.test(n)) p += 25;
  if (/premium|enhanced|aprimorad|siri/.test(n)) p += 35;
  if (/francisca|antonio|thalita|luciana|fernanda|vit[oó]ria|felipe/.test(n)) p += 10;
  if (v.lang.toLowerCase() === "pt-br") p += 20;
  return p;
}

function vozesPt(): SpeechSynthesisVoice[] {
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("pt"))
    .sort((a, b) => nota(b) - nota(a));
}

/** Divide em frases: a voz respira entre elas e soa menos corrida. */
function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Botão que lê em voz alta o resumo do painel. Usa as vozes do próprio aparelho, de graça; escolhendo uma voz "Natural" (Edge/Windows) ou "Google" (Chrome) fica bem menos robótica. */
export default function ResumoVoz({ montarTexto }: { montarTexto: () => string }) {
  const [falando, setFalando] = useState(false);
  const [texto, setTexto] = useState("");
  const [suporta, setSuporta] = useState(true);
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([]);
  const [escolhida, setEscolhida] = useState("");
  const ativo = useRef(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSuporta(ok);
    if (!ok) return;
    const carregar = () => {
      const lista = vozesPt();
      setVozes(lista);
      let salva = "";
      try {
        salva = localStorage.getItem(CHAVE) ?? "";
      } catch {
        /* ignora */
      }
      setEscolhida((atual) => atual || (lista.some((v) => v.name === salva) ? salva : (lista[0]?.name ?? "")));
    };
    carregar();
    window.speechSynthesis.addEventListener("voiceschanged", carregar);
    return () => {
      ativo.current = false;
      window.speechSynthesis.removeEventListener("voiceschanged", carregar);
      window.speechSynthesis.cancel();
    };
  }, []);

  function parar() {
    ativo.current = false;
    window.speechSynthesis.cancel();
    setFalando(false);
  }

  function falar() {
    if (falando) return parar();
    const t = montarTexto();
    setTexto(t);
    const voz = vozes.find((v) => v.name === escolhida) ?? vozes[0];
    const lista = frases(t);
    window.speechSynthesis.cancel();
    ativo.current = true;
    setFalando(true);
    lista.forEach((frase, i) => {
      const fala = new SpeechSynthesisUtterance(frase);
      fala.lang = "pt-BR";
      fala.rate = 0.97;
      fala.pitch = 1;
      if (voz) fala.voice = voz;
      if (i === lista.length - 1) {
        fala.onend = () => {
          ativo.current = false;
          setFalando(false);
        };
      }
      fala.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          ativo.current = false;
          setFalando(false);
        }
      };
      window.speechSynthesis.speak(fala);
    });
  }

  function trocarVoz(nome: string) {
    setEscolhida(nome);
    try {
      localStorage.setItem(CHAVE, nome);
    } catch {
      /* ignora */
    }
    if (falando) parar();
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
      {vozes.length > 1 ? (
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
          Voz
          <select value={escolhida} onChange={(e) => trocarVoz(e.target.value)} className="field w-auto max-w-[14rem] py-1.5 text-sm" aria-label="Escolher a voz">
            {vozes.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name.replace(/^Microsoft\s+/i, "").replace(/\s*-\s*Portuguese.*$/i, "")}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-muted">{falando || texto ? "" : "O assistente fala como estão suas contas hoje."}</p>
      )}
      {!falando && !texto && vozes.length > 0 && !vozes.some((v) => nota(v) >= 60) && (
        <p className="w-full text-xs text-muted">
          {plataforma() === "ios"
            ? "Para a voz da Siri: Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil) e baixe uma voz “Aprimorada”. Ela aparece aqui sozinha."
            : plataforma() === "android"
              ? "Para a voz do Google: Configurações › Sistema › Idiomas › Saída de texto para voz › Google, e baixe o português do Brasil."
              : "Escolha uma voz “Natural” (Edge) ou “Google” (Chrome) para soar menos robótico."}
        </p>
      )}
      {texto && (
        <p className="w-full text-sm text-muted" role="status">
          {texto}
        </p>
      )}
    </section>
  );
}
