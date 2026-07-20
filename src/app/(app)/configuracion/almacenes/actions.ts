"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

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

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  try {
    await prisma.almacen.create({ data: { codigo, nombre, direccion } });
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
