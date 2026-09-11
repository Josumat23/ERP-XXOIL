"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoAlmacen } from "@/generated/prisma/client";
import {
  obtenerEmpresaActivaId,
  perteneceAEmpresaActiva,
  requerirRolEmpresaActiva as requerirRol,
} from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { feriadosPeru } from "@/lib/calendarioProduccion";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { esAnioOperativoValido } from "@/lib/periodos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { esValorEnum } from "@/lib/enums";

export type EstadoFormulario = { error?: string };

const ERROR_AJENO = { error: "El almacén no pertenece a la compañía activa." };

// Los ids de almacén, zona y día llegan del navegador: nada se escribe sin
// releer el registro y confirmar que cuelga de la compañía activa.
async function almacenDeEmpresaActiva(almacenId: string): Promise<string | null> {
  const empresaId = await obtenerEmpresaActivaId();
  const almacen = await prisma.almacen.findFirst({
    where: { id: almacenId, empresaId },
    select: { id: true },
  });
  return almacen?.id ?? null;
}

export async function crearAlmacen(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Configuración del sistema." };
  }

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const direccion2 = String(formData.get("direccion2") ?? "").trim() || null;
  const ciudad = String(formData.get("ciudad") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const departamento = String(formData.get("departamento") ?? "").trim() || null;
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "").trim() || "Perú";
  const encargado = String(formData.get("encargado") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "");

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (!esValorEnum(Object.values(TipoAlmacen), tipo)) {
    return { error: "Seleccione el rol organizativo del almacén." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const almacen = await tx.almacen.create({
        data: { empresaId: auth.usuario.empresaId, tipo, codigo, nombre, direccion, direccion2, ciudad, distrito, provincia, departamento, codigoPostal, pais, encargado },
      });
      await registrarAuditoriaMaestro(tx, { empresaId: almacen.empresaId, entidad: "Almacen", registroId: almacen.id, accion: "CREAR", despues: almacen, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe un almacén con el código "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/configuracion/almacenes");
  return {};
}

export async function crearZonaAlmacen(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Configuración del sistema." };
  }

  const almacenId = String(formData.get("almacenId") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim() || null;

  if (!almacenId) return { error: "Seleccione el almacén." };
  if (!codigo) return { error: "El código de la zona es obligatorio." };

  const almacenPropio = await almacenDeEmpresaActiva(almacenId);
  if (!almacenPropio) return ERROR_AJENO;

  try {
    await prisma.$transaction(async (tx) => {
      const zona = await tx.zonaAlmacen.create({ data: { almacenId: almacenPropio, codigo, nombre } });
      await registrarAuditoriaMaestro(tx, { empresaId: auth.usuario.empresaId, entidad: "ZonaAlmacen", registroId: zona.id, accion: "CREAR", despues: zona, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la zona "${codigo}" en ese almacén.` };
    }
    throw e;
  }

  revalidatePath("/configuracion/almacenes");
  return {};
}

export async function alternarActivoAlmacen(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.almacen.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.almacen.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "Almacen", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/almacenes");
}

// El rol organizativo se cambia por separado del alta: mover un almacén de
// distribución a planta (o al revés) es una decisión de estructura, no un dato
// que se corrija junto con la dirección.
export async function actualizarTipoAlmacen(id: string, tipo: string) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  if (!esValorEnum(Object.values(TipoAlmacen), tipo)) return;

  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.almacen.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId) || antes.tipo === tipo) return;
    const despues = await tx.almacen.update({ where: { id }, data: { tipo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "Almacen", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/almacenes");
}

export async function alternarActivoZona(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.zonaAlmacen.findFirst({ where: { id, almacen: { empresaId } } });
    if (!antes) return;
    const despues = await tx.zonaAlmacen.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "ZonaAlmacen", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/almacenes");
}

// --- Calendario de producción -----------------------------------------------

export async function guardarHorasCalendario(
  almacenId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Configuración del sistema." };
  }

  const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"] as const;
  const horas: Record<string, number> = {};
  for (const dia of dias) {
    const valor = Number(formData.get(`horas${dia}`) ?? 0);
    if (!Number.isFinite(valor) || valor < 0 || valor > 24) {
      return { error: `Las horas del día ${dia} deben estar entre 0 y 24.` };
    }
    horas[`horas${dia}`] = valor;
  }

  if (!(await almacenDeEmpresaActiva(almacenId))) return ERROR_AJENO;

  await prisma.$transaction(async (tx) => {
    const antes = await tx.calendarioProduccion.findUnique({ where: { almacenId } });
    const despues = await tx.calendarioProduccion.upsert({ where: { almacenId }, update: horas, create: { almacenId, ...horas } });
    await registrarAuditoriaMaestro(tx, { empresaId: auth.usuario.empresaId, entidad: "CalendarioProduccion", registroId: despues.id, accion: antes ? "ACTUALIZAR" : "CREAR", antes, despues, usuario: auth.usuario });
  });

  revalidatePath("/configuracion/almacenes");
  return {};
}

export async function agregarDiaNoLaborable(
  almacenId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Configuración del sistema." };
  }

  const fechaRaw = String(formData.get("fecha") ?? "").trim();
  const fecha = crearFechaCalendarioLocal(fechaRaw);
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!fechaRaw) return { error: "Seleccione la fecha." };
  if (!fecha) return { error: "Seleccione una fecha válida." };

  if (!(await almacenDeEmpresaActiva(almacenId))) return ERROR_AJENO;

  try {
    await prisma.$transaction(async (tx) => {
      const calendario = await tx.calendarioProduccion.upsert({ where: { almacenId }, update: {}, create: { almacenId } });
      const dia = await tx.diaNoLaborable.create({ data: { calendarioId: calendario.id, fecha, motivo } });
      await registrarAuditoriaMaestro(tx, { empresaId: auth.usuario.empresaId, entidad: "DiaNoLaborable", registroId: dia.id, accion: "CREAR", despues: dia, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese día ya está marcado como no laborable." };
    }
    throw e;
  }

  revalidatePath("/configuracion/almacenes");
  return {};
}

export async function quitarDiaNoLaborable(id: string) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const dia = await tx.diaNoLaborable.findFirst({
      where: { id, calendario: { almacen: { empresaId } } },
      select: { id: true },
    });
    if (!dia) return;
    const antes = await tx.diaNoLaborable.delete({ where: { id } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "DiaNoLaborable", registroId: id, accion: "ELIMINAR", antes, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/almacenes");
}

// Carga rápida de los feriados nacionales del Perú para un año, evitando duplicados.
export async function cargarFeriadosPeru(almacenId: string, anio: number) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  if (!esAnioOperativoValido(anio)) return;
  if (!(await almacenDeEmpresaActiva(almacenId))) return;

  const feriados = feriadosPeru(anio);
  await prisma.$transaction(async (tx) => {
    const calendario = await tx.calendarioProduccion.upsert({ where: { almacenId }, update: {}, create: { almacenId } });
    const existentes = await tx.diaNoLaborable.findMany({
      where: { calendarioId: calendario.id, fecha: { in: feriados.map((feriado) => feriado.fecha) } },
      select: { fecha: true },
    });

    // La restricción única (calendarioId, fecha) resuelve de forma segura
    // solicitudes concurrentes y conserva los feriados ya configurados.
    await Promise.all(feriados.map((feriado) => tx.diaNoLaborable.upsert({
      where: { calendarioId_fecha: { calendarioId: calendario.id, fecha: feriado.fecha } },
      update: {},
      create: { calendarioId: calendario.id, fecha: feriado.fecha, motivo: feriado.motivo },
    })));
    await registrarAuditoriaMaestro(tx, {
      empresaId: auth.usuario.empresaId,
      entidad: "CalendarioProduccion",
      registroId: calendario.id,
      accion: "ACTUALIZAR",
      antes: { anio, feriadosExistentes: existentes.length },
      despues: { anio, feriadosConfigurados: feriados.length },
      usuario: auth.usuario,
    });
  });

  revalidatePath("/configuracion/almacenes");
}
