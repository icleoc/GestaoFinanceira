import type { MetadataRoute } from "next";
import { MARCA } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA.nome,
    short_name: "Jarvis",
    description: MARCA.descricao,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#06262B",
    theme_color: "#06262B",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
