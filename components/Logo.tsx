import { MARCA } from "@/lib/brand";

/**
 * Marca do sistema: um "J" (de Jarvis) ao lado de três barras que sobem,
 * como o patrimônio crescendo. O quadrado tem fundo próprio, então funciona
 * em qualquer cor de página.
 */
export function Marca({ tamanho = 36, className = "" }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label={MARCA.nome} className={className}>
      <defs>
        <linearGradient id="marca-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B4A6B" />
          <stop offset="1" stopColor="#0B1F31" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#marca-fundo)" />
      <rect x="12" y="35" width="5.5" height="9" rx="2.75" fill="#4ABFA5" />
      <rect x="20.5" y="28" width="5.5" height="16" rx="2.75" fill="#4ABFA5" />
      <rect x="29" y="20" width="5.5" height="24" rx="2.75" fill="#4ABFA5" />
      <path
        d="M43 13v26c0 6.4-4.6 10.5-10.8 10.5-3.2 0-5.7-1-7.7-2.9"
        fill="none"
        stroke="#EAEFED"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(2 1)"
      />
    </svg>
  );
}

/** Marca + nome. Em fundo escuro, passe `tom="claro"`. */
export default function Logo({
  tamanho = 36,
  tom = "normal",
  className = "",
}: {
  tamanho?: number;
  tom?: "normal" | "claro";
  className?: string;
}) {
  const [primeiro, ...resto] = MARCA.nome.split(" ");
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Marca tamanho={tamanho} />
      <span
        className={`font-display leading-none ${tom === "claro" ? "text-paper" : "text-ink"}`}
        style={{ fontSize: tamanho * 0.52 }}
      >
        <span className="font-semibold">{primeiro}</span>
        {resto.length > 0 && <span className="ml-1 font-normal opacity-70">{resto.join(" ")}</span>}
      </span>
    </span>
  );
}
