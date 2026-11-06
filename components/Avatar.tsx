"use client";

/** Foto da pessoa ou, sem foto, a inicial do nome. */
export default function Avatar({ foto, inicial, tamanho = "size-10", className = "" }: { foto?: string | null; inicial: string; tamanho?: string; className?: string }) {
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className={`${tamanho} rounded-full object-cover ring-1 ring-gold/40 ${className}`} />
  ) : (
    <span className={`grid ${tamanho} place-items-center rounded-full bg-deep text-sm font-semibold text-gold-hi ring-1 ring-gold/40 ${className}`} aria-hidden>
      {inicial}
    </span>
  );
}
