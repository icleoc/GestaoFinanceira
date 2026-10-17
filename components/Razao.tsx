import type { ReactNode } from "react";

/** Linha de livro-razão: o nome à esquerda, o valor à direita e um pontilhado entre os dois. */
export function Linha({
  nome,
  valor,
  nota,
  destaque,
}: {
  nome: ReactNode;
  valor: ReactNode;
  nota?: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="py-2.5">
      <div className="razao">
        <span className={`min-w-0 truncate ${destaque ? "font-semibold" : ""}`}>{nome}</span>
        <span className="razao-pontos" aria-hidden />
        <span className={`num shrink-0 font-semibold ${destaque ? "font-display text-lg" : ""}`}>{valor}</span>
      </div>
      {nota && <div className="mt-0.5 text-xs text-muted">{nota}</div>}
    </div>
  );
}
