"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const productoId = String(formData.get("productoId") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const contenidoKg = Number(formData.get("contenidoKg"));
  const precio = Number(formData.get("precio"));
  const stock = Number(formData.get("stock") ?? 0);
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);

  if (!productoId || !sku || !nombre) {
    return { error: "Producto, SKU y nombre son obligatorios." } as const;
  }
  if (!Number.isFinite(contenidoKg) || contenidoKg <= 0) {
    return { error: "El contenido en kg debe ser un número mayor a 0." } as const;
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return { error: "El precio debe ser un número válido." } as const;
  }
  if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock y el stock mínimo deben ser números válidos." } as const;
  }

  return {
    datos: { productoId, sku, nombre, contenidoKg, precio, stock, stockMinimo, moneda: "PEN" },
  } as const;
}

export async function crearPresentacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.presentacion.create({ data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe una presentación con el SKU "${resultado.datos.sku}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/presentaciones");
  redirect("/catalogo/presentaciones");
}

export async function actualizarPresentacion(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.presentacion.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe una presentación con el SKU "${resultado.datos.sku}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/presentaciones");
  revalidatePath(`/catalogo/presentaciones/${id}`);
  redirect("/catalogo/presentaciones");
}

export async function alternarActivoPresentacion(id: string, activo: boolean) {
  await prisma.presentacion.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/presentaciones");
}
