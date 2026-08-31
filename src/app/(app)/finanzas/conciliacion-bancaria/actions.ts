"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  aplicarMovimientoConciliacion,
  cerrarConciliacionBancaria,
  parsearExtractoBancario,
} from "@/lib/conciliacionBancaria";

export type EstadoConciliacion = { error?: string; exito?: string };

async function autorizar(accion: "crear" | "editar" | "aprobar") {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", accion))) {
    return { error: `Su grupo de seguridad no permite ${accion} conciliaciones bancarias.` };
  }
  return auth;
}

export async function crearConciliacion(
  _estado: EstadoConciliacion,
  formData: FormData
): Promise<EstadoConciliacion> {
  const auth = await autorizar("crear");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const cuentaBancariaId = String(formData.get("cuentaBancariaId") ?? "");
  const fechaDesde = crearFechaCalendarioLocal(String(formData.get("fechaDesde") ?? ""));
  const fechaHasta = crearFechaCalendarioLocal(String(formData.get("fechaHasta") ?? ""));
  const saldoInicialExtracto = Number(formData.get("saldoInicialExtracto"));
  const saldoFinalExtracto = Number(formData.get("saldoFinalExtracto"));
  if (!cuentaBancariaId || !fechaDesde || !fechaHasta || fechaDesde > fechaHasta) {
    return { error: "Seleccione cuenta y un período válido." };
  }
  if (!Number.isFinite(saldoInicialExtracto) || !Number.isFinite(saldoFinalExtracto)) {
    return { error: "Los saldos del extracto deben ser numéricos." };
  }
  const cuenta = await prisma.cuentaBancariaEmpresa.findFirst({
    where: { id: cuentaBancariaId, empresaId, activo: true },
  });
  if (!cuenta) return { error: "La cuenta bancaria no existe o está inactiva." };
  const solapada = await prisma.conciliacionBancaria.findFirst({
    where: { cuentaBancariaId, estado: { not: "ANULADA" }, fechaDesde: { lte: fechaHasta }, fechaHasta: { gte: fechaDesde } },
  });
  if (solapada) return { error: "La cuenta ya tiene una conciliación que se superpone con ese período." };
  const conciliacion = await prisma.conciliacionBancaria.create({
    data: {
      empresaId: cuenta.empresaId,
      cuentaBancariaId,
      fechaDesde,
      fechaHasta,
      saldoInicialExtracto,
      saldoFinalExtracto,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });
  revalidatePath("/finanzas/conciliacion-bancaria");
  redirect(`/finanzas/conciliacion-bancaria/${conciliacion.id}`);
}

export async function importarExtracto(
  conciliacionId: string,
  _estado: EstadoConciliacion,
  formData: FormData
): Promise<EstadoConciliacion> {
  const auth = await autorizar("editar");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Seleccione un archivo CSV." };
  if (archivo.size > 1024 * 1024) return { error: "El CSV no debe superar 1 MB." };
  if (!archivo.name.toLowerCase().endsWith(".csv")) return { error: "El extracto debe ser un archivo .csv." };
  let lineas;
  try {
    lineas = parsearExtractoBancario(await archivo.text());
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  const conciliacion = await prisma.conciliacionBancaria.findFirst({ where: { id: conciliacionId, empresaId } });
  if (!conciliacion || conciliacion.estado !== "BORRADOR") return { error: "La conciliación no está abierta." };
  if (lineas.some((linea) => linea.fecha < conciliacion.fechaDesde || linea.fecha > conciliacion.fechaHasta)) {
    return { error: "Todas las fechas del extracto deben pertenecer al período conciliado." };
  }
  let nuevas = 0;
  await prisma.$transaction(async (tx) => {
    for (const linea of lineas) {
      const existente = await tx.movimientoExtractoBancario.findUnique({
        where: { conciliacionId_huella: { conciliacionId, huella: linea.huella } },
      });
      if (!existente) {
        await tx.movimientoExtractoBancario.create({ data: { conciliacionId, ...linea } });
        nuevas += 1;
      }
    }
  });
  revalidatePath(`/finanzas/conciliacion-bancaria/${conciliacionId}`);
  return { exito: `${nuevas} movimientos importados; ${lineas.length - nuevas} duplicados omitidos.` };
}

export async function conciliarMovimiento(
  conciliacionId: string,
  movimientoExtractoId: string,
  _estado: EstadoConciliacion,
  formData: FormData
): Promise<EstadoConciliacion> {
  const auth = await autorizar("editar");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const conciliacion = await prisma.conciliacionBancaria.findFirst({ where: { id: conciliacionId, empresaId } });
  if (!conciliacion) return { error: "La conciliación no pertenece a la empresa activa." };
  const movimientoCajaId = String(formData.get("movimientoCajaId") ?? "");
  const monto = Number(formData.get("monto"));
  if (!movimientoCajaId) return { error: "Seleccione un movimiento del libro." };
  try {
    await prisma.$transaction((tx) => aplicarMovimientoConciliacion(
      tx,
      { conciliacionId, movimientoExtractoId, movimientoCajaId, monto },
      { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
    ));
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/finanzas/conciliacion-bancaria/${conciliacionId}`);
  return { exito: "Partida conciliada." };
}

export async function quitarAplicacion(conciliacionId: string, aplicacionId: string): Promise<void> {
  const auth = await autorizar("editar");
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  const aplicacion = await prisma.conciliacionBancariaAplicacion.findUnique({
    where: { id: aplicacionId }, include: { movimientoExtracto: { include: { conciliacion: true } } },
  });
  if (!aplicacion || aplicacion.movimientoExtracto.conciliacionId !== conciliacionId || aplicacion.movimientoExtracto.conciliacion.empresaId !== empresaId || aplicacion.movimientoExtracto.conciliacion.estado !== "BORRADOR") return;
  await prisma.conciliacionBancariaAplicacion.delete({ where: { id: aplicacion.id } });
  revalidatePath(`/finanzas/conciliacion-bancaria/${conciliacionId}`);
}

export async function anularConciliacion(
  conciliacionId: string,
  _estado: EstadoConciliacion,
  formData: FormData
): Promise<EstadoConciliacion> {
  const auth = await autorizar("editar");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { error: "Explique la anulación con al menos 5 caracteres." };
  const anulada = await prisma.conciliacionBancaria.updateMany({
    where: { id: conciliacionId, empresaId, estado: "BORRADOR" },
    data: {
      estado: "ANULADA",
      anuladaEn: new Date(),
      anuladaPorId: auth.usuario.id,
      anuladaPorNombre: auth.usuario.nombre,
      motivoAnulacion: motivo,
    },
  });
  if (anulada.count !== 1) return { error: "La conciliación no está abierta o pertenece a otra empresa." };
  revalidatePath("/finanzas/conciliacion-bancaria");
  revalidatePath(`/finanzas/conciliacion-bancaria/${conciliacionId}`);
  return { exito: "Conciliación anulada sin eliminar su trazabilidad." };
}
export async function cerrarConciliacion(
  conciliacionId: string,
  _estado: EstadoConciliacion,
  _formData: FormData
): Promise<EstadoConciliacion> {
  void _estado;
  void _formData;
  const auth = await autorizar("aprobar");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const conciliacion = await prisma.conciliacionBancaria.findFirst({ where: { id: conciliacionId, empresaId } });
  if (!conciliacion) return { error: "La conciliación no pertenece a la empresa activa." };
  try {
    await prisma.$transaction((tx) => cerrarConciliacionBancaria(
      tx, conciliacionId, { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
    ));
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/finanzas/conciliacion-bancaria");
  revalidatePath(`/finanzas/conciliacion-bancaria/${conciliacionId}`);
  return { exito: "Conciliación cerrada con trazabilidad." };
}