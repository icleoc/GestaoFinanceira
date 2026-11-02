import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { MOEDAS_ESTRANGEIRAS } from "@/lib/cambio";
import { todayISO } from "@/lib/finance";

export const dynamic = "force-dynamic";

interface Achado {
  taxa: number;
  dataCotacao: string;
  fonte: string;
}

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000), headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

const compacta = (d: string) => d.replaceAll("-", "");

/** Cada fonte devolve a cotação em reais de 1 unidade da moeda, ou lança erro. `dia` é uma data ou "latest". */
const FONTES: { nome: string; buscar: (moeda: string, dia: string) => Promise<Achado> }[] = [
  {
    nome: "Frankfurter",
    async buscar(moeda, dia) {
      const j = (await json(`https://api.frankfurter.dev/v1/${dia}?base=${moeda}&symbols=BRL`)) as { date?: string; rates?: { BRL?: number } };
      if (!j.rates?.BRL || !j.date) throw new Error("sem cotação");
      return { taxa: j.rates.BRL, dataCotacao: j.date, fonte: "Banco Central Europeu (Frankfurter)" };
    },
  },
  {
    nome: "Frankfurter (endereço antigo)",
    async buscar(moeda, dia) {
      const j = (await json(`https://api.frankfurter.app/${dia}?from=${moeda}&to=BRL`)) as { date?: string; rates?: { BRL?: number } };
      if (!j.rates?.BRL || !j.date) throw new Error("sem cotação");
      return { taxa: j.rates.BRL, dataCotacao: j.date, fonte: "Banco Central Europeu (Frankfurter)" };
    },
  },
  {
    nome: "AwesomeAPI",
    async buscar(moeda, dia) {
      if (dia === "latest") {
        const j = (await json(`https://economia.awesomeapi.com.br/json/last/${moeda}-BRL`)) as Record<string, { bid?: string; create_date?: string }>;
        const x = j[`${moeda}BRL`];
        const taxa = parseFloat(x?.bid ?? "");
        if (!(taxa > 0)) throw new Error("sem cotação");
        return { taxa, dataCotacao: (x?.create_date ?? todayISO()).slice(0, 10), fonte: "AwesomeAPI" };
      }
      const j = (await json(`https://economia.awesomeapi.com.br/json/daily/${moeda}-BRL/1?start_date=${compacta(dia)}&end_date=${compacta(dia)}`)) as { bid?: string; timestamp?: string }[];
      const taxa = parseFloat(j?.[0]?.bid ?? "");
      if (!(taxa > 0)) throw new Error("sem cotação nesse dia");
      return { taxa, dataCotacao: dia, fonte: "AwesomeAPI" };
    },
  },
  {
    nome: "ExchangeRate-API",
    async buscar(moeda, dia) {
      if (dia !== "latest") throw new Error("só cotação de hoje");
      const j = (await json(`https://open.er-api.com/v6/latest/${moeda}`)) as { rates?: { BRL?: number } };
      if (!j.rates?.BRL) throw new Error("sem cotação");
      return { taxa: j.rates.BRL, dataCotacao: todayISO(), fonte: "ExchangeRate-API" };
    },
  },
];

async function procurar(moeda: string, dia: string): Promise<{ achado?: Achado; falhas: string[] }> {
  const falhas: string[] = [];
  for (const f of FONTES) {
    try {
      return { achado: await f.buscar(moeda, dia), falhas };
    } catch (e) {
      falhas.push(`${f.nome}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  return { falhas };
}

/**
 * Cotação de uma moeda em reais, no dia pedido. Tenta várias fontes gratuitas em ordem, e se
 * nenhuma tiver o dia pedido usa a cotação mais recente (a tela mostra a data da cotação usada).
 * Só responde para quem está logado.
 */
export async function GET(req: NextRequest) {
  const db = await supabaseServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ erro: "Entre para consultar a cotação." }, { status: 401 });

  const moeda = (req.nextUrl.searchParams.get("moeda") ?? "").toUpperCase();
  let dia = req.nextUrl.searchParams.get("data") ?? "";
  if (!MOEDAS_ESTRANGEIRAS.some((m) => m.codigo === moeda)) {
    return NextResponse.json({ erro: "Moeda não suportada." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(dia))) {
    return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
  }
  if (dia >= todayISO()) dia = "latest";

  let r = await procurar(moeda, dia);
  if (!r.achado && dia !== "latest") {
    const recente = await procurar(moeda, "latest");
    r = { achado: recente.achado, falhas: [...r.falhas, ...recente.falhas] };
  }
  if (r.achado) return NextResponse.json(r.achado);

  console.error("cambio: todas as fontes falharam", r.falhas.join(" | "));
  return NextResponse.json(
    { erro: "Não consegui buscar a cotação agora. Digite a cotação manualmente no campo ao lado.", detalhe: r.falhas },
    { status: 502 },
  );
}
