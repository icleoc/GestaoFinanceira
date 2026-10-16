// Quem pode fazer o quê dentro de uma carteira. O banco confere as mesmas
// permissões (RLS); aqui elas servem para esconder o que a pessoa não pode usar.

import type { Papel, Permissao } from "./types";

export const TODAS_PERMISSOES: Permissao[] = ["ver", "lancar", "editar", "gerenciar", "planejar", "equipe"];

export const ROTULO_PERMISSAO: Record<Permissao, { nome: string; descricao: string }> = {
  ver: { nome: "Ver tudo", descricao: "Enxerga saldos, extrato, notas e planejamento." },
  lancar: { nome: "Lançar", descricao: "Registra despesas, receitas e notas fiscais." },
  editar: { nome: "Editar e apagar lançamentos", descricao: "Corrige ou exclui o que já foi lançado." },
  gerenciar: { nome: "Gerenciar contas", descricao: "Cria e remove contas, cartões, categorias e contas fixas." },
  planejar: { nome: "Planejar compras", descricao: "Cria e altera a lista de pretensões de compra." },
  equipe: { nome: "Gerenciar pessoas", descricao: "Convida pessoas e muda o que cada uma pode fazer." },
};

export interface PapelPronto {
  id: Exclude<Papel, "dono">;
  nome: string;
  descricao: string;
  permissoes: Permissao[];
}

export const PAPEIS_PRONTOS: PapelPronto[] = [
  {
    id: "admin",
    nome: "Administrador",
    descricao: "Faz tudo, inclusive gerenciar pessoas.",
    permissoes: [...TODAS_PERMISSOES],
  },
  {
    id: "membro",
    nome: "Familiar",
    descricao: "Vê tudo e lança gastos, sem apagar nem mexer nas contas.",
    permissoes: ["ver", "lancar", "planejar"],
  },
  {
    id: "leitor",
    nome: "Somente leitura",
    descricao: "Só acompanha, não altera nada.",
    permissoes: ["ver"],
  },
  {
    id: "personalizado",
    nome: "Personalizado",
    descricao: "Você escolhe uma a uma.",
    permissoes: ["ver", "lancar"],
  },
];

export function pode(permissoes: Permissao[] | null | undefined, p: Permissao): boolean {
  return Boolean(permissoes?.includes(p));
}

export function nomeDoPapel(papel: Papel): string {
  if (papel === "dono") return "Dono";
  return PAPEIS_PRONTOS.find((p) => p.id === papel)?.nome ?? "Personalizado";
}

/** Descobre qual papel pronto corresponde a um conjunto de permissões. */
export function papelDe(permissoes: Permissao[]): Exclude<Papel, "dono"> {
  const chave = [...permissoes].sort().join(",");
  const achado = PAPEIS_PRONTOS.find((p) => p.id !== "personalizado" && [...p.permissoes].sort().join(",") === chave);
  return achado?.id ?? "personalizado";
}

export function permissoesValidas(x: unknown): Permissao[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.filter((p): p is Permissao => TODAS_PERMISSOES.includes(p as Permissao)))];
}
