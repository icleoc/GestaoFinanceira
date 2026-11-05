"use client";

import { useEffect, useMemo, useState } from "react";
import { buscarCotacao, taxaDemo, type Taxas } from "./cambio";
import { addDaysISO, todayISO } from "./finance";

export interface CotacaoDia {
  taxa: number;
  /** Dia a que a cotação se refere. */
  dia: string;
  /** Cotação do dia útil anterior, para mostrar a variação. */
  anterior: number | null;
}

type Resultado = Record<string, CotacaoDia>;

const DEMO: Resultado = {
  USD: { taxa: taxaDemo("USD"), dia: todayISO(), anterior: 5.4015 },
  EUR: { taxa: taxaDemo("EUR"), dia: todayISO(), anterior: 6.3101 },
};

const cache = new Map<string, { quando: number; dados: Resultado }>();
const VALIDADE = 15 * 60 * 1000;

async function carregar(moedas: string[]): Promise<Resultado> {
  const saida: Resultado = {};
  await Promise.all(
    moedas.map(async (m) => {
      try {
        const hoje = await buscarCotacao(m, todayISO());
        let anterior: number | null = null;
        try {
          const ontem = await buscarCotacao(m, addDaysISO(hoje.dataCotacao, -1));
          if (ontem.dataCotacao !== hoje.dataCotacao) anterior = ontem.taxa;
        } catch {
          /* sem o dia anterior: mostra só a cotação */
        }
        saida[m] = { taxa: hoje.taxa, dia: hoje.dataCotacao, anterior };
      } catch {
        /* moeda sem cotação agora: some do resultado */
      }
    }),
  );
  return saida;
}

/** Cotações do dia em reais (e a variação sobre o dia útil anterior). Na demonstração usa valores fixos. */
export function useCotacoes(moedas: string[], demo = false): { cotacoes: Resultado; taxas: Taxas; carregando: boolean } {
  const chave = [...moedas].sort().join(",");
  const [cotacoes, setCotacoes] = useState<Resultado>(demo ? DEMO : {});
  const [carregando, setCarregando] = useState(!demo && moedas.length > 0);

  useEffect(() => {
    if (demo) {
      setCotacoes(DEMO);
      setCarregando(false);
      return;
    }
    const lista = chave ? chave.split(",") : [];
    if (lista.length === 0) {
      setCarregando(false);
      return;
    }
    const guardado = cache.get(chave);
    if (guardado && Date.now() - guardado.quando < VALIDADE) {
      setCotacoes(guardado.dados);
      setCarregando(false);
      return;
    }
    let vivo = true;
    setCarregando(true);
    void carregar(lista).then((dados) => {
      if (!vivo) return;
      if (Object.keys(dados).length > 0) cache.set(chave, { quando: Date.now(), dados });
      setCotacoes(dados);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [chave, demo]);

  const taxas = useMemo(() => {
    const t: Taxas = {};
    for (const [m, c] of Object.entries(cotacoes)) t[m] = c.taxa;
    return t;
  }, [cotacoes]);
  return { cotacoes, taxas, carregando };
}

export interface EstadoCotacao {
  estado: "parado" | "buscando" | "ok" | "erro";
  /** Dia da cotação usada (fim de semana e feriado usam o último dia útil). */
  dia?: string;
  msg?: string;
}

/** Cotação de fechamento do dia escolhido para uma moeda, buscada de novo quando a moeda ou a data mudam. */
export function useCotacaoDaData(moeda: string, data: string, ativo: boolean) {
  const [taxaTexto, setTaxaTexto] = useState("");
  const [cotacao, setCotacao] = useState<EstadoCotacao>({ estado: "parado" });

  useEffect(() => {
    if (!ativo) {
      setCotacao({ estado: "parado" });
      return;
    }
    let cancelado = false;
    setCotacao({ estado: "buscando" });
    buscarCotacao(moeda, data)
      .then((c) => {
        if (cancelado) return;
        setTaxaTexto(String(c.taxa).replace(".", ","));
        setCotacao({ estado: "ok", dia: c.dataCotacao });
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setCotacao({ estado: "erro", msg: e instanceof Error ? e.message : "Cotação indisponível." });
      });
    return () => {
      cancelado = true;
    };
  }, [ativo, moeda, data]);

  return { taxaTexto, setTaxaTexto, cotacao };
}
