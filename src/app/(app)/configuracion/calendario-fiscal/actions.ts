"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { esAnioOperativoValido } from "@/lib/periodos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import {
  MENSAJE_RECHAZO_TAREA,
  pendientesDeCierre,
  puedeCompletarTarea,
  siguienteOrdenTarea,
  verificacionesDeCierre,
} from "@/lib/cierrePeriodo";

export async function generarAnioFiscal(anio: number) {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;
  if (!esAnioOperativoValido(anio)) return;
  const empresaId = await obtenerEmpresaActivaId();

  await prisma.$transaction(
    Array.from({ length: 12 }, (_, indice) => {
      const mes = indice + 1;
      return prisma.periodoFiscal.upsert({
        where: { empresaId_anio_mes: { empresaId, anio, mes } },
        update: {},
        create: { empresaId, anio, mes },
      });
    })
  );

  revalidatePath("/configuracion/calendario-fiscal");
}

export async function alternarPeriodoFiscal(id: string) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();

  const periodo = await prisma.periodoFiscal.findFirst({ where: { id, empresaId } });
  if (!periodo) return;

  const cerrando = periodo.estado === "ABIERTO";

  // Cerrar sigue siendo decisión del contador: bloquearlo por un dato menor
  // podría dejar los libros sin poder cerrarse. Lo que sí queda es constancia
  // de cuántos puntos estaban abiertos en ese momento.
  const pendientes = cerrando ? await contarPendientesDeCierre(empresaId, periodo) : null;

  await prisma.$transaction(async (tx) => {
    const cambiados = await tx.periodoFiscal.updateMany({
      where: { id, empresaId, estado: periodo.estado },
      data: {
        estado: cerrando ? "CERRADO" : "ABIERTO",
        cerradoEn: cerrando ? new Date() : null,
        cerradoPor: cerrando ? auth.usuario.nombre : null,
        pendientesAlCerrar: cerrando ? pendientes : null,
      },
    });
    // Otra sesión pudo cambiar el estado entremedio: sin cambio no hay nada
    // que auditar.
    if (cambiados.count !== 1) return;
    const despues = await tx.periodoFiscal.findUniqueOrThrow({ where: { id } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "PeriodoFiscal", registroId: id, accion: "ACTUALIZAR", antes: periodo, despues, usuario: auth.usuario });
  });

  revalidatePath("/configuracion/calendario-fiscal");
}

export type EstadoFormulario = { error?: string };

/** Rango [inicio, fin) del mes del período. */
function rangoDelPeriodo(periodo: { anio: number; mes: number }) {
  return {
    inicio: new Date(periodo.anio, periodo.mes - 1, 1),
    fin: new Date(periodo.anio, periodo.mes, 1),
  };
}

/**
 * Cuenta los puntos abiertos del checklist: verificaciones automáticas con
 * casos pendientes más tareas propias sin completar.
 */
async function contarPendientesDeCierre(
  empresaId: string,
  periodo: { id: string; anio: number; mes: number }
): Promise<number> {
  const { inicio, fin } = rangoDelPeriodo(periodo);
  const [incidencias, comprobantes, asientos, tareas] = await Promise.all([
    prisma.incidenciaContable.count({
      where: { empresaId, resueltoEn: null, fecha: { gte: inicio, lt: fin } },
    }),
    prisma.comprobanteElectronico.count({
      where: {
        empresaId,
        estado: { in: ["PENDIENTE", "ENVIADO", "RECHAZADO", "ERROR"] },
        creadoEn: { gte: inicio, lt: fin },
      },
    }),
    prisma.asientoContable.count({
      where: { empresaId, anio: periodo.anio, mes: periodo.mes },
    }),
    prisma.tareaCierrePeriodo.findMany({
      where: { periodoFiscalId: periodo.id },
      select: { id: true, orden: true, completadaEn: true },
    }),
  ]);

  return pendientesDeCierre(
    verificacionesDeCierre({
      incidenciasContablesAbiertas: incidencias,
      comprobantesSinAceptar: comprobantes,
      asientosDelPeriodo: asientos,
    }),
    tareas
  );
}

/** Agrega una tarea propia al final del checklist del período. */
export async function agregarTareaCierre(
  periodoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "Describa la tarea de cierre." };
  if (descripcion.length > 300) return { error: "La descripción no puede superar los 300 caracteres." };

  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del navegador: el período tiene que ser de la compañía
      // activa.
      const periodo = await tx.periodoFiscal.findFirst({
        where: { id: periodoId, empresaId },
        select: { id: true, estado: true },
      });
      if (!periodo) throw new Error("El período no pertenece a la compañía activa.");
      if (periodo.estado === "CERRADO") {
        throw new Error(MENSAJE_RECHAZO_TAREA.PERIODO_CERRADO);
      }

      const tareas = await tx.tareaCierrePeriodo.findMany({
        where: { periodoFiscalId: periodoId },
        select: { orden: true },
      });
      await tx.tareaCierrePeriodo.create({
        data: { periodoFiscalId: periodoId, orden: siguienteOrdenTarea(tareas), descripcion },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo agregar la tarea." };
  }

  revalidatePath("/configuracion/calendario-fiscal");
  return {};
}

/** Marca una tarea como hecha, si no queda ninguna anterior pendiente. */
export async function completarTareaCierre(
  tareaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  const nota = String(formData.get("nota") ?? "").trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const tarea = await tx.tareaCierrePeriodo.findFirst({
        where: { id: tareaId, periodo: { empresaId } },
        select: { id: true, periodoFiscalId: true, periodo: { select: { estado: true } } },
      });
      if (!tarea) throw new Error("La tarea no pertenece a la compañía activa.");

      const tareas = await tx.tareaCierrePeriodo.findMany({
        where: { periodoFiscalId: tarea.periodoFiscalId },
        select: { id: true, orden: true, completadaEn: true },
      });
      const rechazo = puedeCompletarTarea(tareas, tareaId, tarea.periodo.estado === "CERRADO");
      if (rechazo) throw new Error(MENSAJE_RECHAZO_TAREA[rechazo]);

      await tx.tareaCierrePeriodo.update({
        where: { id: tareaId },
        data: {
          completadaEn: new Date(),
          completadaPorId: auth.usuario.id,
          completadaPorNombre: auth.usuario.nombre,
          nota,
        },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar la tarea." };
  }

  revalidatePath("/configuracion/calendario-fiscal");
  return {};
}
