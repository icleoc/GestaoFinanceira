// Formato das tabelas do Supabase (as mesmas do sistema anterior).
// Os ids podem ser número ou texto (uuid), por isso o tipo Id aceita os dois.

export type Id = string | number;

export type TipoConta = "Corrente" | "Crédito" | "Investimento";
export type TipoCategoria = "Despesa" | "Receita";

export interface Conta {
  id: Id;
  nome: string;
  tipo: TipoConta;
  /** Cartão de crédito: valor negativo = quanto está devendo. */
  saldo_atual: number | string | null;
  limite_total: number | string | null;
  dia_vencimento: number | null;
}

export interface Categoria {
  id: Id;
  nome: string;
  tipo: TipoCategoria;
}

export interface Transacao {
  id: Id;
  /** Data no formato AAAA-MM-DD. */
  data: string;
  descricao: string;
  /** Negativo = saiu dinheiro, positivo = entrou. */
  valor: number | string;
  conta_origem_id: Id | null;
  categoria_id: Id | null;
}

export interface DespesaFixa {
  id: Id;
  nome: string;
  valor: number | string;
  dia_vencimento: number;
}

export interface NovaTransacao {
  data: string;
  descricao: string;
  valor: number;
  conta_origem_id: Id | null;
  categoria_id: Id | null;
}

export interface Dados {
  contas: Conta[];
  categorias: Categoria[];
  transacoes: Transacao[];
  fixas: DespesaFixa[];
}
