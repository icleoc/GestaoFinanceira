// Gera o calendário (.ics) de vencimentos. O celular assina o link e passa a tocar os alarmes sozinho.

import type { Vencimento } from "./vencimentos";
import { addDaysISO } from "./finance";

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const semTracos = (iso: string) => iso.replace(/-/g, "");
const reais = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Corta linhas em 75 bytes, como a norma pede. */
function dobrar(l: string): string {
  if (l.length <= 73) return l;
  const partes: string[] = [];
  for (let i = 0; i < l.length; i += 73) partes.push(l.slice(i, i + 73));
  return partes.join("\r\n ");
}

/** Alarme às 9h, `dias` dias antes (0 = no dia). O evento é de dia inteiro e começa à meia-noite. */
function alarme(dias: number, titulo: string): string[] {
  const gatilho = dias === 0 ? "PT9H" : dias === 1 ? "-PT15H" : `-P${dias - 1}DT15H`;
  const quando = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;
  return ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`${titulo} ${quando}`)}`, `TRIGGER;RELATED=START:${gatilho}`, "END:VALARM"];
}

export function gerarIcs(opts: { calendario: string; itens: Vencimento[]; dias: number[]; agora?: Date }): string {
  const agora = (opts.agora ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const dias = [...new Set(opts.dias)].sort((a, b) => b - a);
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jarvis Finance//Vencimentos//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.calendario)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];
  for (const v of opts.itens) {
    const titulo = v.indice ? `${v.nome} ${v.indice}/${v.total}` : v.nome;
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${v.chave}-${v.indice ?? 0}-${semTracos(v.data)}@jarvis-finance`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${semTracos(v.data)}`,
      `DTEND;VALUE=DATE:${semTracos(addDaysISO(v.data, 1))}`,
      `SUMMARY:${esc(`Vence: ${titulo} (${reais(v.valor)})`)}`,
      `DESCRIPTION:${esc(`${titulo}, ${reais(v.valor)}. Depois de pagar, lance no Jarvis Finance.`)}`,
      "TRANSP:TRANSPARENT",
    );
    for (const d of dias) linhas.push(...alarme(d, titulo));
    linhas.push("END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}
