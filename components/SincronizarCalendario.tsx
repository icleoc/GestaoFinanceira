"use client";

import { useState } from "react";
import type { Aviso } from "@/lib/types";
import { salvarAviso, tokenAviso } from "@/lib/data";
import { DIAS_PADRAO } from "@/lib/vencimentos";

/**
 * Um clique e pronto: garante que os avisos da pessoa estão ligados, pega o link do calendário dela
 * e abre a assinatura. É uma assinatura (o calendário do celular lê o mesmo link sempre), e cada
 * evento tem identificador fixo, então clicar de novo ou assinar outra vez não duplica nada.
 */
export default function SincronizarCalendario({ userId, avisos, compacto = false }: { userId: string; avisos?: Aviso[]; compacto?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [https, setHttps] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function sincronizar() {
    setErro("");
    setOcupado(true);
    try {
      const meu = avisos?.find((a) => a.user_id === userId);
      if (!meu || !meu.ativo) {
        await salvarAviso(userId, { ativo: true, dias: meu?.dias?.length ? meu.dias : DIAS_PADRAO, contas: meu?.contas ?? null });
      }
      const token = await tokenAviso();
      if (!token) throw new Error("Não foi possível criar o seu calendário. Tente de novo em instantes.");
      const url = `${window.location.origin}/api/calendario/${token}.ics`;
      setHttps(url);
      window.location.href = url.replace(/^https?:/, "webcal:");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível sincronizar.");
    } finally {
      setOcupado(false);
    }
  }

  const webcal = https.replace(/^https?:/, "webcal:");

  return (
    <div className={compacto ? "panel flex flex-wrap items-center justify-between gap-3 p-4" : "rounded-xl bg-sunken p-4"}>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">Sincronizar calendário</p>
        <p className="text-muted">Leva suas contas a vencer, com alarme, para o calendário do celular. Pode clicar de novo sem medo: nada é duplicado.</p>
      </div>
      <button onClick={sincronizar} disabled={ocupado} className="btn btn-gold shrink-0 px-4 py-2">
        {ocupado ? "Sincronizando…" : "Sincronizar calendário"}
      </button>
      {https && (
        <div className="flex w-full flex-wrap gap-2 text-sm">
          <span className="w-full text-muted">Se o calendário não abriu sozinho, use uma destas opções:</span>
          <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer" className="btn btn-quiet px-3 py-1.5">
            Google Agenda
          </a>
          <button onClick={() => navigator.clipboard?.writeText(https).then(() => setCopiado(true))} className="btn btn-quiet px-3 py-1.5">
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="w-full text-sm font-medium text-neg">
          {erro}
        </p>
      )}
    </div>
  );
}
