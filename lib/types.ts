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

/** O que a leitura automática enxergou na foto da nota. */
export interface ItemNota {
  nome: string;
  quantidade: number | null;
  valor: number | null;
}

export interface DadosNota {
  empresa: string | null;
  cnpj: string | null;
  /** AAAA-MM-DD */
  data: string | null;
  total: number | null;
  itens: ItemNota[];
  /** Uma das categorias da carteira. */
  categoria: string | null;
}

export interface Transacao {
  id: Id;
  /** Empresa, itens e total lidos da nota. */
  nota_dados?: DadosNota | null;
  /** Caminho da foto da nota no armazenamento, quando houver. */
  nota_path?: string | null;
  /** Moeda em que o valor foi recebido (BRL quando não houve conversão). */
  moeda?: string | null;
  valor_original?: number | string | null;
  taxa_cambio?: number | string | null;
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
  nota_path?: string | null;
  nota_dados?: DadosNota | null;
  moeda?: string;
  valor_original?: number | null;
  taxa_cambio?: number | null;
}

export type FormaCompra = "avista" | "parcelado" | "financiado";
export type StatusPretensao = "desejo" | "comprada" | "descartada";

export interface Pretensao {
  id: string;
  nome: string;
  categoria: string | null;
  valor: number | string;
  forma: FormaCompra;
  parcelas: number;
  entrada: number | string;
  juros_mensal: number | string;
  prevista: string | null;
  status: StatusPretensao;
}

export interface Dados {
  contas: Conta[];
  categorias: Categoria[];
  transacoes: Transacao[];
  fixas: DespesaFixa[];
  pretensoes: Pretensao[];
}

/** O que cada pessoa da carteira pode fazer. */
export type Permissao = "ver" | "lancar" | "editar" | "gerenciar" | "planejar" | "equipe";
export type Papel = "dono" | "admin" | "membro" | "leitor" | "personalizado";

export interface Membro {
  user_id: string;
  nome: string | null;
  email: string | null;
  papel: Papel;
  permissoes: Permissao[];
}

export interface Sessao {
  userId: string;
  email: string;
  carteiraId: string;
  carteiraNome: string;
  papel: Papel;
  permissoes: Permissao[];
  /** Outras carteiras a que a pessoa tem acesso. */
  carteiras: { id: string; nome: string }[];
}
