"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearCategoria(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.categoria.create({ data: { nombre, descripcion } });
      await registrarAuditoriaMaestro(tx, { entidad: "Categoria", registroId: registro.id, accion: "CREAR", despues: registro, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la categoría "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/categorias");
  return {};
}

export async function actualizarCategoria(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.categoria.findUniqueOrThrow({ where: { id } });
      const despues = await tx.categoria.update({ where: { id }, data: { nombre, descripcion } });
      await registrarAuditoriaMaestro(tx, { entidad: "Categoria", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la categoría "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath(`/catalogo/categorias/${id}`);
  return { ok: true };
}

export async function alternarActivoCategoria(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.categoria.findUniqueOrThrow({ where: { id } });
    const despues = await tx.categoria.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Categoria", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/catalogo/categorias");
}
