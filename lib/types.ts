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
  /** Dados do cartão (só os 4 últimos dígitos). */
  bandeira?: string | null;
  final_cartao?: string | null;
  dia_fechamento?: number | null;
  /** Pessoa da carteira dona do cartão. */
  titular_id?: string | null;
  /** Moeda em que o saldo da conta está guardado (BRL quando não informada). */
  moeda?: string | null;
  /** Conta em moeda estrangeira: quanto custou, em reais, o saldo atual. */
  custo_brl?: number | string | null;
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
  /** Nome de categoria nova sugerido quando nenhuma da carteira serve (ex.: Combustível). */
  categoriaNova?: string | null;
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
  /** Valor na moeda da conta (com sinal) quando a conta é em moeda estrangeira. */
  valor_conta?: number | string | null;
  /** Data no formato AAAA-MM-DD. */
  data: string;
  descricao: string;
  /** Negativo = saiu dinheiro, positivo = entrou. */
  valor: number | string;
  conta_origem_id: Id | null;
  categoria_id: Id | null;
  /** Quem fez o lançamento (vazio nos lançamentos antigos). */
  criado_por?: string | null;
  /** As duas pontas de uma transferência compartilham este código. */
  vinculo?: string | null;
  /** Lançamento de histórico: não mexe no saldo da conta. */
  sem_saldo?: boolean | null;
}

export interface DespesaFixa {
  id: Id;
  nome: string;
  valor: number | string;
  dia_vencimento: number;
  /** Valor muda todo mês (luz, água…): o valor cadastrado é só a base e é confirmado ao pagar. */
  flutuante?: boolean;
  /** Só conta a partir desta data (AAAA-MM-DD): vencimentos antes dela não são cobrados. */
  inicio?: string | null;
  /** Mês (AAAA-MM) em que foi marcada como paga sem lançamento. */
  baixa_mes?: string | null;
  /** Quem recebe o alerta de vencimento (ids das pessoas). Vazio/nulo = todas da carteira. */
  avisar?: string[] | null;
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
  /** Valor na moeda da conta (com sinal), quando a conta é em moeda estrangeira. */
  valor_conta?: number | null;
  vinculo?: string | null;
  sem_saldo?: boolean;
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

export type TipoDivida = "financiamento" | "emprestimo" | "consorcio" | "parcelado";
export type FormaParcelado = "pix" | "boleto";

/** Financiamento de um bem ou empréstimo, com as parcelas calculadas a partir da data da primeira. */
export interface Divida {
  id: string;
  tipo: TipoDivida;
  nome: string;
  /** Valor do bem financiado ou valor emprestado. */
  valor_bem: number | string;
  entrada: number | string;
  parcelas: number;
  valor_parcela: number | string;
  /** Vencimento da 1ª parcela (AAAA-MM-DD). */
  primeira_parcela: string;
  /** Quantas já foram pagas (inclui as de antes de usar o app, que não viram lançamentos). */
  parcelas_pagas: number;
  conta_id?: Id | null;
  categoria_id?: Id | null;
  /** Compra parcelada: como será paga (Pix parcelado ou boleto). */
  forma?: FormaParcelado | null;
  /** Quem recebe o alerta de vencimento. Vazio/nulo = todas as pessoas. */
  avisar?: string[] | null;
}

/** Limite de gasto por mês de uma pessoa da carteira. */
export interface Limite {
  user_id: string;
  valor_mensal: number | string;
}

/** Quando e de quais contas uma pessoa da carteira quer ser avisada. */
export interface Aviso {
  user_id: string;
  ativo: boolean;
  /** Dias antes do vencimento (0 = no dia). */
  dias: number[];
  /** 'fixa:<id>' / 'divida:<id>'. Nulo = todas as contas. */
  contas: string[] | null;
}

export interface Dados {
  avisos?: Aviso[];
  /** Pessoas da carteira (para mostrar quem lançou e os limites). */
  membros?: { user_id: string; nome: string | null; email: string | null }[];
  limites?: Limite[];
  contas: Conta[];
  categorias: Categoria[];
  transacoes: Transacao[];
  fixas: DespesaFixa[];
  pretensoes: Pretensao[];
  dividas?: Divida[];
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
