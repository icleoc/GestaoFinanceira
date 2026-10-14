const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function money(n: number): string {
  return brl.format(n);
}

/** Sem centavos, para títulos grandes. */
export function moneyShort(n: number): string {
  return brlCompact.format(n);
}

/** 2026-10-14 -> 14/10/2026 */
export function dateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** 2026-10 -> outubro de 2026 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}
