import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elo — Monitoria entre Pares · IFRN",
    short_name: "Elo",
    description:
      "Plataforma de monitoria entre pares do IFRN: pareamento por tópico e horário, agenda e relatórios automáticos de horas.",
    start_url: "/painel",
    display: "standalone",
    background_color: "#06361e",
    theme_color: "#06361e",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
