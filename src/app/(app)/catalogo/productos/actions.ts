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

function leerDatos(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const unidadMedidaBase = String(formData.get("unidadMedidaBase") ?? "kg").trim() || "kg";
  const marca = String(formData.get("marca") ?? "").trim() || null;
  const gradoNlgi = String(formData.get("gradoNlgi") ?? "").trim() || null;
  const viscosidad = String(formData.get("viscosidad") ?? "").trim() || null;
  const notasTecnicas = String(formData.get("notasTecnicas") ?? "").trim() || null;

  if (!codigo || !nombre || !categoriaId) {
    return { error: "Código, nombre y categoría son obligatorios." } as const;
  }

  return {
    datos: {
      codigo,
      nombre,
      descripcion,
      categoriaId,
      unidadMedidaBase,
      marca,
      gradoNlgi,
      viscosidad,
      notasTecnicas,
    },
  } as const;
}

export async function crearProducto(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.producto.create({ data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${resultado.datos.codigo}".` };
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

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.producto.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un producto con el código "${resultado.datos.codigo}".` };
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
