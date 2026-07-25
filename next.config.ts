import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite los Server Actions (formularios) cuando la app se abre a
    // través del túnel de GitHub Codespaces, cuyo dominio público no
    // coincide con el host interno del servidor.
    serverActions: {
      // "*.app.github.dev" cubre el dominio público del túnel; "localhost:3000"
      // cubre el Origin que Codespaces reporta en algunas peticiones internas
      // aunque la página se haya cargado por el dominio público.
      allowedOrigins: ["*.app.github.dev", "localhost:3000"],
    },
  },
};

export default nextConfig;
