"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoEquipo } from "@/lib/correlativos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function crearEquipo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const almacenId = String(formData.get("almacenId") ?? "");
  const activoFijoId = String(formData.get("activoFijoId") ?? "") || null;
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const unidadContador = String(formData.get("unidadContador") ?? "").trim() || null;
  const contadorActual = Number(formData.get("contadorActual") ?? 0);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!almacenId) return { error: "Seleccione el almacén / planta del equipo." };
  if (!Number.isFinite(contadorActual) || contadorActual < 0) {
    return { error: "La lectura inicial del contador debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoEquipo(tx);
      const equipo = await tx.equipo.create({
        data: { codigo, nombre, almacenId, activoFijoId, centroCostoId, notas, unidadContador, contadorActual },
      });
      await registrarAuditoriaMaestro(tx, { entidad: "Equipo", registroId: equipo.id, accion: "CREAR", despues: equipo, usuario: auth.usuario });
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: "Ese activo fijo ya está enlazado a otro equipo." };
    }
    throw e;
  }

  revalidatePath("/produccion/equipos");
  redirect("/produccion/equipos");
}

export async function alternarActivoEquipo(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.equipo.findUniqueOrThrow({ where: { id } });
    const despues = await tx.equipo.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Equipo", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/produccion/equipos");
}

export async function actualizarContadorEquipo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const contadorActual = Number(formData.get("contadorActual") ?? 0);
  if (!Number.isFinite(contadorActual) || contadorActual < 0) {
    return { error: "La lectura del contador debe ser un número válido." };
  }

  const equipo = await prisma.equipo.findUnique({ where: { id } });
  if (!equipo) return { error: "El equipo no existe." };
  if (contadorActual < equipo.contadorActual.toNumber()) {
    return { error: "La nueva lectura no puede ser menor a la actual." };
  }

  await prisma.$transaction(async (tx) => {
    const despues = await tx.equipo.update({ where: { id }, data: { contadorActual } });
    await registrarAuditoriaMaestro(tx, { entidad: "Equipo", registroId: id, accion: "ACTUALIZAR", antes: equipo, despues, usuario: auth.usuario });
  });
  revalidatePath(`/produccion/equipos/${id}`);
  return {};
}

const TIPOS_PLAN_VALIDOS = ["POR_TIEMPO", "POR_CONTADOR"] as const;

export async function crearPlanMantenimiento(
  equipoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const frecuenciaDiasRaw = String(formData.get("frecuenciaDias") ?? "").trim();
  const frecuenciaContadorRaw = String(formData.get("frecuenciaContador") ?? "").trim();

  if (!nombre) return { error: "El nombre del plan es obligatorio." };
  if (!TIPOS_PLAN_VALIDOS.includes(tipo as (typeof TIPOS_PLAN_VALIDOS)[number])) {
    return { error: "Seleccione el tipo de plan." };
  }

  let frecuenciaDias: number | null = null;
  let frecuenciaContador: number | null = null;
  if (tipo === "POR_TIEMPO") {
    frecuenciaDias = Number(frecuenciaDiasRaw);
    if (!Number.isInteger(frecuenciaDias) || frecuenciaDias <= 0) {
      return { error: "La frecuencia en días debe ser un entero mayor a 0." };
    }
  } else {
    frecuenciaContador = Number(frecuenciaContadorRaw);
    if (!Number.isFinite(frecuenciaContador) || frecuenciaContador <= 0) {
      return { error: "La frecuencia del contador debe ser un número mayor a 0." };
    }
  }

  await prisma.$transaction(async (tx) => {
    const plan = await tx.planMantenimiento.create({
      data: { equipoId, nombre, tipo: tipo as (typeof TIPOS_PLAN_VALIDOS)[number], frecuenciaDias, frecuenciaContador, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
    });
    await registrarAuditoriaMaestro(tx, { entidad: "PlanMantenimiento", registroId: plan.id, accion: "CREAR", despues: plan, usuario: auth.usuario });
  });

  revalidatePath(`/produccion/equipos/${equipoId}`);
  return {};
}

export async function alternarActivoPlan(id: string, equipoId: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.planMantenimiento.findUniqueOrThrow({ where: { id } });
    const despues = await tx.planMantenimiento.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "PlanMantenimiento", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath(`/produccion/equipos/${equipoId}`);
}
