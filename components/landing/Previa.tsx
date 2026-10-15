import type { Conta } from "@/lib/types";
import { calcularKpis } from "@/lib/finance";
import Patrimonio from "@/components/Patrimonio";
import { Cartoes, Investimentos } from "@/components/Contas";

// Dados inventados só para ilustrar a tela. Não são de ninguém.
const EXEMPLO: Conta[] = [
  { id: 1, nome: "Conta principal", tipo: "Corrente", saldo_atual: 4850.2, limite_total: 0, dia_vencimento: null },
  { id: 2, nome: "Reserva", tipo: "Corrente", saldo_atual: 2100, limite_total: 0, dia_vencimento: null },
  { id: 3, nome: "Cartão principal", tipo: "Crédito", saldo_atual: -1280, limite_total: 6000, dia_vencimento: 10 },
  { id: 4, nome: "Cartão viagens", tipo: "Crédito", saldo_atual: -3900, limite_total: 4500, dia_vencimento: 20 },
  { id: 5, nome: "Corretora - Renda fixa", tipo: "Investimento", saldo_atual: 18500, limite_total: 0, dia_vencimento: null },
  { id: 6, nome: "Corretora - Fundos", tipo: "Investimento", saldo_atual: 7200, limite_total: 0, dia_vencimento: null },
  { id: 7, nome: "Tesouro Direto", tipo: "Investimento", saldo_atual: 5000, limite_total: 0, dia_vencimento: null },
];

/** O painel de verdade, montado com os mesmos componentes e dados de exemplo. */
export default function Previa() {
  const kpis = calcularKpis(EXEMPLO);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line" aria-hidden />
        <span className="size-2.5 rounded-full bg-line" aria-hidden />
        <span className="size-2.5 rounded-full bg-line" aria-hidden />
        <span className="ml-2 text-sm text-muted">Painel com dados de exemplo</span>
      </div>
      <div className="space-y-4 bg-bg p-4 sm:p-6">
        <Patrimonio kpis={kpis} />
        <div className="grid gap-4 md:grid-cols-2">
          <Cartoes contas={EXEMPLO} />
          <Investimentos contas={EXEMPLO} />
        </div>
      </div>
    </div>
  );
}
