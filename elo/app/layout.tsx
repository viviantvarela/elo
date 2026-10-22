import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Elo — monitoria entre pares · IFRN",
  description:
    "Plataforma de monitoria entre pares que conecta estudantes a monitores por tópico e disponibilidade, registra atendimentos e gera relatórios automáticos de horas.",
  applicationName: "Elo",
};

export const viewport: Viewport = {
  themeColor: "#06361e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} data-accent="green">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
