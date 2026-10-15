import type { Metadata } from "next";

// Telas privadas não devem aparecer em buscadores.
export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
