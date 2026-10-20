import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { MARCA } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Demonstração · ${MARCA.nome}`,
  description: "Experimente o painel com uma família fictícia. Nada é salvo.",
  robots: { index: false, follow: false },
};

export default function Demonstracao() {
  return <Dashboard demo />;
}
