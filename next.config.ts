import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite los Server Actions (formularios) cuando la app se abre a
    // través del túnel de GitHub Codespaces, cuyo dominio público no
    // coincide con el host interno del servidor.
    serverActions: {
      allowedOrigins: ["*.app.github.dev"],
    },
  },
};

export default nextConfig;
