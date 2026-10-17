import { useId } from "react";
import { MARCA } from "@/lib/brand";

/**
 * Selo da marca: uma moeda com borda serrilhada em champanhe e, no centro, um "J"
 * cuja haste termina numa seta de crescimento. Tem fundo próprio, então funciona
 * sobre qualquer cor de página.
 */
export function Marca({ tamanho = 40, className = "" }: { tamanho?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label={MARCA.nome} className={className}>
      <defs>
        <linearGradient id={`${id}-ouro`} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4E5B2" />
          <stop offset="0.5" stopColor="#D6B66C" />
          <stop offset="1" stopColor="#A87A2E" />
        </linearGradient>
        <radialGradient id={`${id}-fundo`} cx="0.3" cy="0.22" r="0.95">
          <stop offset="0" stopColor="#14595F" />
          <stop offset="0.6" stopColor="#073339" />
          <stop offset="1" stopColor="#031A1D" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30.6" fill={`url(#${id}-fundo)`} stroke={`url(#${id}-ouro)`} strokeWidth="2.4" />
      <circle cx="32" cy="32" r="27" fill="none" stroke={`url(#${id}-ouro)`} strokeWidth="1.3" strokeDasharray="0.9 2.05" strokeLinecap="round" opacity="0.7" />
      <circle cx="32" cy="32" r="23.6" fill="none" stroke={`url(#${id}-ouro)`} strokeWidth="0.6" opacity="0.35" />
      <g fill="none" stroke={`url(#${id}-ouro)`} strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M38.4 23.5V37.2c0 6.3-4.3 9.6-9.5 9.6-2.7 0-4.9-.9-6.6-2.6" />
        <path d="M30.5 24.6 38.4 15.2l7.9 9.4" />
      </g>
    </svg>
  );
}

/** Marca + nome. Em fundo escuro, passe `tom="claro"`. */
export default function Logo({
  tamanho = 40,
  tom = "normal",
  className = "",
}: {
  tamanho?: number;
  tom?: "normal" | "claro";
  className?: string;
}) {
  const [primeiro, ...resto] = MARCA.nome.split(" ");
  const claro = tom === "claro";
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Marca tamanho={tamanho} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display ${claro ? "text-paper" : "text-ink"}`}
          style={{ fontSize: tamanho * 0.58, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {primeiro}
        </span>
        {resto.length > 0 && (
          <span
            className={claro ? "texto-ouro" : "text-accent"}
            style={{ fontSize: Math.max(10, tamanho * 0.27), letterSpacing: "0.34em", marginTop: tamanho * 0.1, fontWeight: 600 }}
          >
            {resto.join(" ").toLowerCase()}
          </span>
        )}
      </span>
    </span>
  );
}
