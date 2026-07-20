import { prisma } from "@/lib/prisma";
import type { ConfiguracionEmpresa } from "@/generated/prisma/client";

// Devuelve la configuración de la empresa; si aún no existe, la crea con
// valores por defecto (una sola fila, id "1").
export async function obtenerConfiguracionEmpresa(): Promise<ConfiguracionEmpresa> {
  const existente = await prisma.configuracionEmpresa.findUnique({ where: { id: "1" } });
  if (existente) return existente;
  return prisma.configuracionEmpresa.create({ data: { id: "1" } });
}
