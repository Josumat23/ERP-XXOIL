"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { PrioridadAvisoMantenimiento } from "@/generated/prisma/client";
import { esValorEnum } from "@/lib/enums";
export type EstadoAviso = { error?: string };
export async function crearAviso(_e: EstadoAviso, fd: FormData): Promise<EstadoAviso> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]); if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) return { error: "No tiene permiso para crear avisos." };
  const equipoId = String(fd.get("equipoId") ?? ""); const prioridad = String(fd.get("prioridad") ?? ""); const titulo = String(fd.get("titulo") ?? "").trim(); const sintoma = String(fd.get("sintoma") ?? "").trim();
  if (!esValorEnum(Object.values(PrioridadAvisoMantenimiento), prioridad)) return { error: "Prioridad inválida." };
  if (titulo.length < 5 || sintoma.length < 10) return { error: "Describa el aviso y el síntoma con suficiente detalle." };
  const equipo = await prisma.equipo.findFirst({ where: { id: equipoId, empresaId: auth.usuario.empresaId, activo: true } }); if (!equipo) return { error: "El equipo no existe o no está activo." };
  await prisma.avisoMantenimiento.create({ data: { empresaId: auth.usuario.empresaId, equipoId, prioridad, titulo, sintoma, equipoDetenido: fd.get("equipoDetenido") === "on", usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre } });
  revalidatePath("/produccion/mantenimiento/avisos"); return {};
}
export async function descartarAviso(id: string, fd: FormData): Promise<void> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]); if ("error" in auth) throw new Error(auth.error);
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) throw new Error("Sin permiso.");
  const motivo = String(fd.get("motivo") ?? "").trim(); if (motivo.length < 8) throw new Error("Documente el motivo del descarte.");
  const r = await prisma.avisoMantenimiento.updateMany({ where: { id, empresaId: auth.usuario.empresaId, estado: "ABIERTO" }, data: { estado: "DESCARTADO", motivoDescarte: motivo, descartadoEn: new Date() } }); if (r.count !== 1) throw new Error("El aviso ya no está abierto.");
  revalidatePath("/produccion/mantenimiento/avisos");
}
