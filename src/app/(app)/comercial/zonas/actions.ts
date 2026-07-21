"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearZona(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.zona.create({ data: { nombre } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la zona "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/comercial/zonas");
  return {};
}

export async function actualizarZona(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.zona.update({ where: { id }, data: { nombre } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la zona "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/comercial/zonas");
  revalidatePath(`/comercial/zonas/${id}`);
  return { ok: true };
}

export async function alternarActivoZona(id: string, activo: boolean) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;
  await prisma.zona.update({ where: { id }, data: { activo } });
  revalidatePath("/comercial/zonas");
}
