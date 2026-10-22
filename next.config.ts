import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O preview roda atrás de um proxy (*.e2b.app); sem isso o dev server rejeita
  // os chunks e a página fica sem JS/CSS.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.e2b.app",
    "*.arena.ai",
  ],
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
