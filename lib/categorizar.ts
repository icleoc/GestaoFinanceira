// Categoria automática pelo tipo de estabelecimento (regras locais, grátis e previsíveis).
// A IA só decide quando nenhuma regra reconhece a empresa.

import type { Categoria, ItemNota } from "./types";

interface Grupo {
  /** Nome usado se a carteira ainda não tiver nenhuma categoria equivalente. */
  nome: string;
  /** Nomes de categoria que a pessoa já pode ter e que significam o mesmo (em ordem de preferência). */
  equivalentes: string[];
  /** Palavras do nome da empresa que identificam o grupo. */
  empresa: string[];
  /** Palavras dos itens (valem menos que o nome da empresa). */
  itens?: string[];
}

const GRUPOS: Grupo[] = [
  {
    nome: "Combustível",
    equivalentes: ["Combustível", "Combustivel", "Gasolina"],
    empresa: ["posto", "combustivel", "combustiveis", "shell", "ipiranga", "petrobras", "br mania", "ale combustiveis", "auto posto"],
    itens: ["gasolina", "etanol", "diesel", "alcool", "gnv"],
  },
  {
    nome: "Saúde",
    equivalentes: ["Saúde", "Saude", "Farmácia", "Farmacia"],
    empresa: ["farmacia", "drogaria", "drogasil", "droga raia", "raia", "pacheco", "pague menos", "panvel", "clinica", "hospital", "laboratorio", "odonto", "dentista", "medic", "otica", "optica"],
  },
  {
    nome: "Mercado",
    equivalentes: ["Mercado", "Supermercado", "Mercearia"],
    empresa: ["supermercado", "mercado", "hipermercado", "atacadao", "atacarejo", "assai", "carrefour", "pao de acucar", "sacolao", "hortifruti", "acougue", "mercearia", "bompreco", "big", "sams club", "angeloni", "condor", "oba hortifruti"],
  },
  {
    nome: "Alimentação",
    equivalentes: ["Alimentação", "Alimentacao", "Alimentos", "Alimento", "Comida", "Restaurante", "Padaria", "Lanchonete"],
    empresa: [
      "padaria", "panificadora", "padoca", "confeitaria", "doceria", "restaurante", "lanchonete", "pizzaria", "churrascaria", "hamburgueria",
      "hamburguer", "burger", "sorveteria", "acai", "cafeteria", "cafe", "boteco", "pastelaria", "marmita", "marmitaria", "sushi", "cantina",
      "bar", "bistro", "trattoria", "rotisseria", "ifood", "rappi", "mcdonald", "mcdonalds", "subway", "spoleto", "outback", "habibs", "giraffas",
      "starbucks", "bobs",
    ],
  },
  {
    nome: "Transporte",
    equivalentes: ["Transporte", "Transportes", "Uber"],
    empresa: ["uber", "99", "cabify", "estacionamento", "pedagio", "sem parar", "metro", "onibus", "taxi", "bilhete unico", "rodoviaria"],
  },
  {
    nome: "Educação",
    equivalentes: ["Educação", "Educacao", "Escola"],
    empresa: ["escola", "faculdade", "universidade", "curso", "colegio", "livraria", "papelaria", "idiomas"],
  },
  {
    nome: "Assinaturas",
    equivalentes: ["Assinaturas", "Assinatura", "Streaming"],
    empresa: ["netflix", "spotify", "disney", "prime video", "hbo", "globoplay", "youtube", "deezer", "icloud"],
  },
  {
    nome: "Lazer",
    equivalentes: ["Lazer", "Entretenimento"],
    empresa: ["cinema", "cinemark", "teatro", "ingresso", "parque", "boliche", "show", "clube"],
  },
  {
    nome: "Moradia",
    equivalentes: ["Moradia", "Casa"],
    empresa: ["material de construcao", "construcao", "leroy", "telhanorte", "tumelero", "ferragem", "madeireira", "tintas"],
  },
  {
    nome: "Compras",
    equivalentes: ["Compras", "Vestuário", "Vestuario"],
    empresa: ["magazine", "americanas", "shopee", "amazon", "renner", "riachuelo", "marisa", "c&a", "zara", "shopping", "calcados", "boutique", "loja"],
  },
];

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contem(texto: string, palavras: string[]): boolean {
  return palavras.some((p) => new RegExp(`(^| )${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$|s )`).test(texto) || (p.length >= 6 && texto.includes(p)));
}

/** Descobre o grupo de gasto pelo nome do estabelecimento e, se preciso, pelos itens. */
export function grupoDaCompra(empresa: string | null, itens: ItemNota[] = []): Grupo | null {
  const nome = normalizar(empresa ?? "");
  if (nome) {
    const porNome = GRUPOS.find((g) => contem(nome, g.empresa));
    if (porNome) return porNome;
  }
  const textoItens = normalizar(itens.map((i) => i.nome).join(" "));
  if (textoItens) {
    const porItem = GRUPOS.find((g) => g.itens && contem(textoItens, g.itens));
    if (porItem) return porItem;
  }
  return null;
}

export interface Sugestao {
  /** Categoria que a carteira já tem. */
  existente: Categoria | null;
  /** Nome a criar quando a carteira não tem nenhuma equivalente. */
  criar: string | null;
}

/** Regra → categoria da carteira. Devolve null se nenhuma regra reconhece o estabelecimento. */
export function sugerirCategoria(empresa: string | null, itens: ItemNota[], categorias: Categoria[]): Sugestao | null {
  const g = grupoDaCompra(empresa, itens);
  if (!g) return null;
  const despesas = categorias.filter((c) => c.tipo === "Despesa");
  for (const eq of g.equivalentes) {
    const achou = despesas.find((c) => normalizar(c.nome) === normalizar(eq));
    if (achou) return { existente: achou, criar: null };
  }
  return { existente: null, criar: g.nome };
}
