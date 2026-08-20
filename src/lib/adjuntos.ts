import path from "path";
import type { $Enums, Usuario } from "@/generated/prisma/client";
import type { ClaveModulo } from "@/lib/permisos";
import { puedeRealizar } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

export const TIPOS_ENTIDAD_ADJUNTO = [
  "Insumo",
  "Cliente",
  "Proveedor",
  "OrdenCompra",
  "Empleado",
  "Equipo",
  "ActivoFijo",
] as const;

export type TipoEntidadAdjunto = (typeof TIPOS_ENTIDAD_ADJUNTO)[number];

export function esTipoEntidadAdjunto(valor: string): valor is TipoEntidadAdjunto {
  return TIPOS_ENTIDAD_ADJUNTO.some((tipo) => tipo === valor);
}

export async function existeEntidadAdjunto(
  entidadTipo: string,
  entidadId: string
): Promise<boolean> {
  if (!esTipoEntidadAdjunto(entidadTipo) || !entidadId || entidadId.length > 64) return false;

  switch (entidadTipo) {
    case "Insumo":
      return Boolean(await prisma.insumo.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "Cliente":
      return Boolean(await prisma.cliente.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "Proveedor":
      return Boolean(await prisma.proveedor.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "OrdenCompra":
      return Boolean(await prisma.ordenCompra.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "Empleado":
      return Boolean(await prisma.empleado.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "Equipo":
      return Boolean(await prisma.equipo.findUnique({ where: { id: entidadId }, select: { id: true } }));
    case "ActivoFijo":
      return Boolean(await prisma.activoFijo.findUnique({ where: { id: entidadId }, select: { id: true } }));
  }
}

const ROLES_LECTURA_POR_ENTIDAD: Record<string, $Enums.RolUsuario[]> = {
  Insumo: ["ALMACEN"],
  Cliente: ["VENTAS"],
  Proveedor: ["ALMACEN"],
  OrdenCompra: ["ALMACEN"],
  Empleado: ["GERENCIA"],
  Equipo: ["PRODUCCION", "ALMACEN"],
  ActivoFijo: ["ALMACEN"],
};

const MODULO_POR_ENTIDAD: Record<string, ClaveModulo> = {
  Insumo: "materiales",
  Cliente: "ventas",
  Proveedor: "materiales",
  OrdenCompra: "materiales",
  Empleado: "rrhh",
  Equipo: "produccion",
  ActivoFijo: "finanzas",
};

export function puedeLeerAdjunto(usuario: Usuario, entidadTipo: string): boolean {
  if (usuario.rol === "ADMIN") return true;
  return ROLES_LECTURA_POR_ENTIDAD[entidadTipo]?.includes(usuario.rol) ?? false;
}

export async function puedeEditarAdjunto(usuario: Usuario, entidadTipo: string): Promise<boolean> {
  if (!puedeLeerAdjunto(usuario, entidadTipo)) return false;
  const modulo = MODULO_POR_ENTIDAD[entidadTipo];
  return modulo ? puedeRealizar(usuario, modulo, "editar") : false;
}

// En Docker, process.cwd() es /app (WORKDIR) — esto resuelve dentro del mismo
// volumen persistente que ya usa la base SQLite (ver docker-compose.yml).
// En desarrollo local/Codespaces, crea ./data/adjuntos relativo al repo.
export const DIRECTORIO_ADJUNTOS = process.env.ADJUNTOS_DIR ?? path.join(process.cwd(), "data", "adjuntos");

export const TIPOS_MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

export function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
