/**
 * Guilóchê: as linhas finas entrelaçadas dos desenhos de segurança de cédulas e cheques.
 * Aqui é uma roseta feita de elipses giradas, só como textura de fundo (decorativa).
 */
export default function Guilloche({
  className = "",
  linhas = 48,
  animar = false,
}: {
  className?: string;
  linhas?: number;
  animar?: boolean;
}) {
  const passo = 180 / linhas;
  const externas = Array.from({ length: linhas }, (_, i) => i * passo);
  const internas = Array.from({ length: Math.round(linhas / 2) }, (_, i) => i * passo * 2 + passo);
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden className={`${animar ? "guilloche-entrada" : ""} ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="0.28">
        {externas.map((a) => (
          <ellipse key={`e${a}`} rx="98" ry="31" transform={`rotate(${a})`} />
        ))}
        <g opacity="0.7" strokeWidth="0.24">
          {internas.map((a) => (
            <ellipse key={`i${a}`} rx="60" ry="17" transform={`rotate(${-a})`} />
          ))}
        </g>
        <circle r="98" strokeWidth="0.4" />
        <circle r="44" strokeWidth="0.3" opacity="0.6" />
      </g>
    </svg>
  );
}
