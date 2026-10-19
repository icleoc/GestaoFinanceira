// Leitura automática da nota fiscal. Este arquivo só tem lógica pura (validar o que a IA
// devolveu) e a chamada do navegador para a rota /api/nota; a IA em si roda no servidor.

import type { DadosNota, ItemNota } from "./types";

const MAX_ITENS = 60;

function texto(x: unknown, max: number): string | null {
  if (typeof x !== "string") return null;
  const t = x.replace(/\s+/g, " ").trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function dinheiro(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? parseFloat(x.replace(/\./g, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n * 100) / 100;
}

function quantidade(x: unknown): number | null {
  const n = typeof x === "number" ? x : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 1000) / 1000;
}

function dataValida(x: unknown, hoje: string): string | null {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const d = new Date(`${x}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) return null;
  if (x > hoje) return null; // nota do futuro: provavelmente erro de leitura
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCFullYear(limite.getUTCFullYear() - 5);
  if (d < limite) return null;
  return x;
}

function cnpj(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const d = x.replace(/\D/g, "");
  if (d.length !== 14) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Aceita só o que faz sentido: textos curtos, valores finitos, data real e não futura, e
 * categoria que exista na carteira. Tudo o que vem da IA é tratado como dado não confiável.
 */
export function normalizarLeitura(bruto: unknown, categorias: string[], hoje: string): DadosNota {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;

  const itens: ItemNota[] = [];
  if (Array.isArray(o.itens)) {
    for (const it of o.itens.slice(0, MAX_ITENS)) {
      const r = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const nome = texto(r.nome, 80);
      if (!nome) continue;
      itens.push({ nome, quantidade: quantidade(r.quantidade), valor: dinheiro(r.valor) });
    }
  }

  let total = dinheiro(o.total);
  if (total === null && itens.length > 0 && itens.every((i) => i.valor !== null)) {
    total = Math.round(itens.reduce((s, i) => s + (i.valor as number), 0) * 100) / 100;
  }

  const sugerida = texto(o.categoria, 60);
  const categoria = sugerida ? (categorias.find((c) => c.trim().toLowerCase() === sugerida.toLowerCase()) ?? null) : null;

  const nova = texto(o.categoria_nova, 30) ?? (sugerida && !categoria ? texto(sugerida, 30) : null);
  const categoriaNova = !categoria && nova && !categorias.some((c) => c.trim().toLowerCase() === nova.toLowerCase()) ? nova : null;

  return {
    empresa: texto(o.empresa, 80),
    cnpj: cnpj(o.cnpj),
    data: dataValida(o.data, hoje),
    total,
    itens,
    categoria,
    categoriaNova,
  };
}

/** Quantos campos principais a leitura conseguiu preencher (0 a 3: empresa, total, data). */
export function camposLidos(d: DadosNota): number {
  return [d.empresa, d.total, d.data].filter((x) => x !== null).length;
}

/** Envia a foto para o servidor e devolve o que foi lido. */
export async function lerNotaNoServidor(foto: Blob, carteiraId: string, categorias: string[]): Promise<DadosNota> {
  const corpo = new FormData();
  corpo.append("foto", foto, "nota.jpg");
  corpo.append("carteiraId", carteiraId);
  corpo.append("categorias", JSON.stringify(categorias));
  const r = await fetch("/api/nota", { method: "POST", body: corpo });
  const json = (await r.json().catch(() => ({}))) as { dados?: DadosNota; erro?: string };
  if (!r.ok || !json.dados) throw new Error(json.erro ?? "Não consegui ler a nota agora. Preencha à mão.");
  return json.dados;
}
