/** Rola suavemente até uma seção da página e a destaca por um instante com um brilho dourado. */
export function rolarParaSecao(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "center" });
  el.classList.remove("destaque-ouro");
  // Reinicia a animação caso o mesmo atalho seja clicado de novo.
  void el.offsetWidth;
  el.classList.add("destaque-ouro");
  window.setTimeout(() => el.classList.remove("destaque-ouro"), 2400);
}
