"use client";

import { useEffect, useRef } from "react";

interface Props {
  titulo: string;
  onClose: () => void;
  largura?: "md" | "lg" | "xl";
  children: React.ReactNode;
}

const LARGURAS = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

/** Janela por cima da tela: fecha com Esc ou clicando fora, e devolve o foco ao fechar. */
export default function Modal({ titulo, onClose, largura = "lg", children }: Props) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`pop-in panel flex max-h-[92dvh] w-full ${LARGURAS[largura]} flex-col overflow-hidden rounded-b-none shadow-2xl outline-none sm:rounded-b-2xl`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          <button onClick={onClose} className="btn btn-quiet px-3 py-1.5" aria-label="Fechar">
            Fechar
          </button>
        </header>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
