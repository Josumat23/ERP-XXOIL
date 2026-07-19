"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

export async function crearCategoria(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.categoria.create({ data: { nombre, descripcion } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la categoría "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/categorias");
  return {};
}

export async function alternarActivoCategoria(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  await prisma.categoria.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/categorias");
}
