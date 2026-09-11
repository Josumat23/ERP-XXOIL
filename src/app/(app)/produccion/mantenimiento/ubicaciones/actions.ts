"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  obtenerEmpresaActivaId,
  perteneceAEmpresaActiva,
  requerirRolEmpresaActiva as requerirRol,
} from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { creariaCicloUbicacion } from "@/lib/ubicacionesTecnicas";

export type EstadoFormulario = { error?: string };

export async function crearUbicacionTecnica(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const empresaId = auth.usuario.empresaId;
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const almacenId = String(formData.get("almacenId") ?? "").trim() || null;

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  // Padre y planta llegan del formulario: se releen acotados a la compañía
  // activa antes de guardarlos.
  if (parentId) {
    const padre = await prisma.ubicacionTecnica.findFirst({
      where: { id: parentId, empresaId },
      select: { id: true },
    });
    if (!padre) return { error: "La ubicación superior no pertenece a la compañía activa." };
  }
  if (almacenId) {
    const almacen = await prisma.almacen.findFirst({
      where: { id: almacenId, empresaId, activo: true },
      select: { id: true },
    });
    if (!almacen) return { error: "La planta no pertenece a la compañía activa." };
  }
  if (parentId && almacenId) {
    return { error: "Solo las ubicaciones raíz declaran planta: las subordinadas la heredan." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ubicacion = await tx.ubicacionTecnica.create({
        data: { empresaId, codigo, nombre, parentId, almacenId },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "UbicacionTecnica",
        registroId: ubicacion.id,
        accion: "CREAR",
        despues: ubicacion,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la ubicación técnica "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/produccion/mantenimiento/ubicaciones");
  revalidatePath("/produccion/equipos");
  return {};
}

export async function reubicarUbicacionTecnica(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const empresaId = auth.usuario.empresaId;
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  const ubicaciones = await prisma.ubicacionTecnica.findMany({
    where: { empresaId },
    select: { id: true, parentId: true },
  });
  if (!ubicaciones.some((u) => u.id === id)) {
    return { error: "La ubicación técnica no pertenece a la compañía activa." };
  }
  if (parentId && !ubicaciones.some((u) => u.id === parentId)) {
    return { error: "La ubicación superior no pertenece a la compañía activa." };
  }
  if (creariaCicloUbicacion(id, parentId, ubicaciones)) {
    return { error: "Esa ubicación superior cerraría un ciclo en la jerarquía." };
  }

  await prisma.$transaction(async (tx) => {
    const antes = await tx.ubicacionTecnica.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    // Una ubicación deja de ser raíz al colgarse de otra: la planta la hereda
    // del árbol y guardarla duplicada permitiría que se contradigan.
    const despues = await tx.ubicacionTecnica.update({
      where: { id },
      data: { parentId, almacenId: parentId ? null : antes.almacenId },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "UbicacionTecnica",
      registroId: id,
      accion: "ACTUALIZAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/produccion/mantenimiento/ubicaciones");
  revalidatePath("/produccion/equipos");
  return {};
}

export async function alternarActivoUbicacionTecnica(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;

  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.ubicacionTecnica.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.ubicacionTecnica.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "UbicacionTecnica",
      registroId: id,
      accion: activo ? "ACTIVAR" : "DESACTIVAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/produccion/mantenimiento/ubicaciones");
  revalidatePath("/produccion/equipos");
}
