"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { feriadosPeru } from "@/lib/calendarioProduccion";

export type EstadoFormulario = { error?: string };

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

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  try {
    await prisma.almacen.create({
      data: {
        codigo,
        nombre,
        direccion,
        direccion2,
        ciudad,
        distrito,
        provincia,
        departamento,
        codigoPostal,
        pais,
        encargado,
      },
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

  try {
    await prisma.zonaAlmacen.create({ data: { almacenId, codigo, nombre } });
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
  await prisma.almacen.update({ where: { id }, data: { activo } });
  revalidatePath("/configuracion/almacenes");
}

export async function alternarActivoZona(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  await prisma.zonaAlmacen.update({ where: { id }, data: { activo } });
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

  await prisma.calendarioProduccion.upsert({
    where: { almacenId },
    update: horas,
    create: { almacenId, ...horas },
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

  const fecha = String(formData.get("fecha") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!fecha) return { error: "Seleccione la fecha." };

  const calendario = await prisma.calendarioProduccion.upsert({
    where: { almacenId },
    update: {},
    create: { almacenId },
  });

  try {
    await prisma.diaNoLaborable.create({
      data: { calendarioId: calendario.id, fecha: new Date(`${fecha}T00:00:00`), motivo },
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
  await prisma.diaNoLaborable.delete({ where: { id } });
  revalidatePath("/configuracion/almacenes");
}

// Carga rápida de los feriados nacionales del Perú para un año, evitando duplicados.
export async function cargarFeriadosPeru(almacenId: string, anio: number) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;

  const calendario = await prisma.calendarioProduccion.upsert({
    where: { almacenId },
    update: {},
    create: { almacenId },
  });

  await prisma.diaNoLaborable.createMany({
    data: feriadosPeru(anio).map((f) => ({
      calendarioId: calendario.id,
      fecha: f.fecha,
      motivo: f.motivo,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/configuracion/almacenes");
}
