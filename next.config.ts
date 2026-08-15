import type { NextConfig } from "next";
import { obtenerOrigenesServerActions } from "./src/lib/origenesServerActions";

const allowedOrigins = obtenerOrigenesServerActions(process.env);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: allowedOrigins.length > 0 ? { allowedOrigins } : undefined,
  },
};

export default nextConfig;