"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function crearProducto(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const codigo = String(formData.get("codigo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const categoriaId = String(formData.get("categoriaId") ?? "");

  if (!codigo || !nombre || !categoriaId) {
    return { error: "Código, nombre y categoría son obligatorios." };
  }

  try {
    await prisma.producto.create({
      data: { codigo, nombre, descripcion: descripcion || null, categoriaId },
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/productos");
  redirect("/catalogo/productos");
}

export async function actualizarProducto(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const codigo = String(formData.get("codigo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const categoriaId = String(formData.get("categoriaId") ?? "");

  if (!codigo || !nombre || !categoriaId) {
    return { error: "Código, nombre y categoría son obligatorios." };
  }

  try {
    await prisma.producto.update({
      where: { id },
      data: { codigo, nombre, descripcion: descripcion || null, categoriaId },
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/productos");
  revalidatePath(`/catalogo/productos/${id}`);
  redirect("/catalogo/productos");
}

export async function alternarActivoProducto(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  await prisma.producto.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/productos");
}
