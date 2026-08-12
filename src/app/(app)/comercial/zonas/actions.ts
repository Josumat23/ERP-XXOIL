"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

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
    await prisma.$transaction(async (tx) => {
      const zona = await tx.zona.create({ data: { nombre } });
      await registrarAuditoriaMaestro(tx, { entidad: "Zona", registroId: zona.id, accion: "CREAR", despues: zona, usuario: auth.usuario });
    });
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
    await prisma.$transaction(async (tx) => {
      const antes = await tx.zona.findUniqueOrThrow({ where: { id } });
      const despues = await tx.zona.update({ where: { id }, data: { nombre } });
      await registrarAuditoriaMaestro(tx, { entidad: "Zona", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
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
  await prisma.$transaction(async (tx) => {
    const antes = await tx.zona.findUniqueOrThrow({ where: { id } });
    const despues = await tx.zona.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Zona", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/comercial/zonas");
}
