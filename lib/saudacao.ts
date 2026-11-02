// Saudação da tela inicial: muda com a hora do dia e varia de um dia para o outro.

/** Primeiro nome, com a inicial maiúscula. Sem nome, usa o começo do e-mail. */
export function primeiroNome(nome: string | null | undefined, email: string): string {
  const base = (nome ?? "").trim() || email.split("@")[0] || "";
  const primeiro = base.split(/[\s._-]+/)[0] ?? "";
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
}

type Periodo = "madrugada" | "manha" | "tarde" | "noite";

export function periodoDe(hora: number): Periodo {
  if (hora < 5) return "madrugada";
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
}

const FRASES: Record<Periodo, string[]> = {
  madrugada: ["Acordado até tarde, {n}?", "Ainda de pé, {n}? Vamos ver as contas rapidinho.", "Madrugada financeira, {n}."],
  manha: ["Bom dia, {n}!", "Bom dia, {n}. Vamos ver como está o dia?", "Começando o dia com as contas em ordem, {n}?"],
  tarde: ["Boa tarde, {n}!", "Boa tarde, {n}. Aqui está o seu dinheiro hoje.", "Tudo certo por aí, {n}?"],
  noite: ["Boa noite, {n}!", "Boa noite, {n}. Fechando o dia com as contas em dia?", "Hora de olhar o dia financeiro, {n}."],
};

/** Mesma frase durante o dia inteiro, outra no dia seguinte. */
export function saudacao(nome: string, agora: Date): string {
  const lista = FRASES[periodoDe(agora.getHours())];
  const dia = Math.floor(agora.getTime() / 86400000);
  const frase = lista[dia % lista.length];
  return nome ? frase.replace("{n}", nome) : frase.replace(/,? \{n\}/, "").replace("{n}", "");
}
