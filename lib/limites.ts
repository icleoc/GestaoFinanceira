// Limite de gasto mensal por pessoa da carteira.

import type { Categoria, Limite, Transacao } from "./types";
import { num, round2 } from "./finance";

export type EstadoLimite = "ok" | "perto" | "estourou";

export interface SituacaoLimite {
  limite: number;
  gasto: number;
  /** Quanto do limite já foi usado (pode passar de 100). */
  pct: number;
  restante: number;
  estado: EstadoLimite;
}

/** Quanto cada pessoa gastou no mês (só despesas lançadas por ela; transferências e investimentos não contam). */
export function gastoPorPessoa(transacoes: Transacao[], categorias: Categoria[], mes: string): Map<string, number> {
  const tipoPorId = new Map(categorias.map((c) => [String(c.id), c.tipo]));
  const soma = new Map<string, number>();
  for (const t of transacoes) {
    if (!t.criado_por || !t.data.startsWith(mes)) continue;
    const v = num(t.valor);
    const tipo = t.categoria_id != null ? tipoPorId.get(String(t.categoria_id)) : undefined;
    if (v < 0 && (tipo === "Despesa" || t.descricao.startsWith("Taxa:"))) {
      soma.set(t.criado_por, (soma.get(t.criado_por) ?? 0) + -v);
    }
  }
  for (const [k, v] of soma) soma.set(k, round2(v));
  return soma;
}

/** A partir de 80% do limite avisa que está perto; a partir de 100% avisa que estourou. */
export function situacaoDoLimite(gasto: number, limite: number): SituacaoLimite {
  const pct = limite > 0 ? (gasto / limite) * 100 : 0;
  return {
    limite,
    gasto,
    pct,
    restante: round2(Math.max(0, limite - gasto)),
    estado: limite > 0 && gasto >= limite ? "estourou" : pct >= 80 ? "perto" : "ok",
  };
}

/** Situação da pessoa no mês, ou null se ela não tem limite definido. */
export function situacaoDaPessoa(
  userId: string,
  limites: Limite[] | undefined,
  transacoes: Transacao[],
  categorias: Categoria[],
  mes: string,
): SituacaoLimite | null {
  const l = limites?.find((x) => x.user_id === userId);
  const valor = l ? num(l.valor_mensal) : 0;
  if (!(valor > 0)) return null;
  return situacaoDoLimite(gastoPorPessoa(transacoes, categorias, mes).get(userId) ?? 0, valor);
}
