"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, ResultadoCalibracion } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { esValorEnum } from "@/lib/enums";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { MENSAJE_ERROR_CALIBRACION, NIVELES_CONTROL_CALIBRACION, validarCalibracion, type NivelControlCalibracion } from "@/lib/calibracion";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearInstrumento(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!codigo || !nombre) return { error: "El código y el nombre del instrumento son obligatorios." };

  const frecuenciaCruda = String(formData.get("frecuenciaCalibracionDias") ?? "").trim();
  const frecuenciaCalibracionDias = frecuenciaCruda ? Number(frecuenciaCruda) : null;
  if (
    frecuenciaCalibracionDias !== null &&
    (!Number.isInteger(frecuenciaCalibracionDias) || frecuenciaCalibracionDias <= 0)
  ) {
    return { error: "La frecuencia de calibración debe ser un número entero de días mayor a 0." };
  }

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.instrumentoMedicion.create({
        data: {
          empresaId,
          codigo,
          nombre,
          marca: String(formData.get("marca") ?? "").trim() || null,
          modelo: String(formData.get("modelo") ?? "").trim() || null,
          serie: String(formData.get("serie") ?? "").trim() || null,
          ubicacion: String(formData.get("ubicacion") ?? "").trim() || null,
          frecuenciaCalibracionDias,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "InstrumentoMedicion",
        registroId: registro.id,
        accion: "CREAR",
        despues: registro,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe un instrumento con el código ${codigo}.` };
    }
    throw e;
  }

  revalidatePath("/produccion/calidad/instrumentos");
  return { ok: true };
}

/**
 * Asienta una calibración. Es un ledger: no se edita, se agrega — el estado de
 * hoy sale de la más reciente.
 */
export async function registrarCalibracion(
  instrumentoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const resultadoCrudo = String(formData.get("resultado") ?? "");
  if (!esValorEnum(Object.values(ResultadoCalibracion), resultadoCrudo)) {
    return { error: "Indique con qué resultado volvió el instrumento." };
  }
  const fecha = crearFechaCalendarioLocal(String(formData.get("fecha") ?? ""));
  const vigenteHasta = crearFechaCalendarioLocal(String(formData.get("vigenteHasta") ?? ""));
  if (!fecha || !vigenteHasta) return { error: "Indique la fecha de calibración y hasta cuándo rige." };

  const numeroCertificado = String(formData.get("numeroCertificado") ?? "").trim();
  const entidad = String(formData.get("entidad") ?? "").trim();
  const error = validarCalibracion({ fecha, vigenteHasta, numeroCertificado, entidad });
  if (error) return { error: MENSAJE_ERROR_CALIBRACION[error] };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del formulario: se comprueba contra la compañía activa.
      const instrumento = await tx.instrumentoMedicion.findFirst({
        where: { id: instrumentoId, empresaId },
        select: { id: true },
      });
      if (!instrumento) throw new Error("El instrumento no pertenece a la empresa activa.");
      await tx.calibracionInstrumento.create({
        data: {
          empresaId,
          instrumentoId,
          fecha,
          vigenteHasta,
          resultado: resultadoCrudo,
          numeroCertificado,
          entidad,
          observaciones: String(formData.get("observaciones") ?? "").trim() || null,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/calidad/instrumentos");
  revalidatePath("/");
  return {};
}

export async function alternarActivoInstrumento(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.instrumentoMedicion.updateMany({ where: { id, empresaId }, data: { activo } });
  revalidatePath("/produccion/calidad/instrumentos");
}

/**
 * Fija cuánto pesa el control de calibración para la compañía activa.
 *
 * Tres niveles por decisión del negocio (2026-09-17): `NO_APLICA` para que el
 * proceso siga su curso mientras el laboratorio se implementa, `ADVIERTE` para
 * que informe sin frenar, y `BLOQUEA` para que no deje liberar. Nace en
 * `NO_APLICA`: un control que frena producción antes de que el laboratorio
 * esté en régimen se apaga, y con él se apaga todo lo demás.
 *
 * Lo que gobierna es el control, no el registro: el maestro de instrumentos y
 * las calibraciones se cargan igual en cualquier nivel.
 */
export async function fijarNivelControlCalibracion(nivel: NivelControlCalibracion) {
  const auth = await requerirRol(["PRODUCCION", "GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  // El nivel llega del formulario: se comprueba contra los que existen en vez
  // de escribir lo que venga.
  if (!NIVELES_CONTROL_CALIBRACION.includes(nivel)) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.configuracionEmpresa.update({
    where: { empresaId },
    data: { nivelControlCalibracion: nivel },
  });
  revalidatePath("/produccion/calidad/instrumentos");
  revalidatePath("/produccion/calidad");
  revalidatePath("/");
}
