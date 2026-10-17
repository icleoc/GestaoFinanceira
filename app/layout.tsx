import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { MARCA } from "@/lib/brand";

export const metadata: Metadata = {
  title: MARCA.nome,
  description: MARCA.descricao,
  appleWebApp: { capable: true, title: "Jarvis", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F1" },
    { media: "(prefers-color-scheme: dark)", color: "#041519" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
