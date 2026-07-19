"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoInsumo[] = ["MATERIA_PRIMA", "ENVASE", "ETIQUETA"];

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function leerDatos(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoInsumo;
  const unidadMedida = String(formData.get("unidadMedida") ?? "").trim();
  const proveedorId = String(formData.get("proveedorId") ?? "") || null;
  const stock = Number(formData.get("stock") ?? 0);
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);
  const costoUnitario = Number(formData.get("costoUnitario") ?? 0);

  if (!codigo || !nombre || !unidadMedida || !TIPOS_VALIDOS.includes(tipo)) {
    return { error: "Código, nombre, tipo y unidad de medida son obligatorios." } as const;
  }
  if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock y el stock mínimo deben ser números válidos." } as const;
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    return { error: "El costo unitario debe ser un número válido." } as const;
  }

  return {
    datos: {
      codigo,
      nombre,
      tipo,
      unidadMedida,
      proveedorId,
      stock,
      stockMinimo,
      costoUnitario,
      moneda: "PEN",
    },
  } as const;
}

export async function crearInsumo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.insumo.create({ data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un insumo con el código "${resultado.datos.codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/insumos");
  redirect("/catalogo/insumos");
}

export async function actualizarInsumo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  try {
    await prisma.insumo.update({ where: { id }, data: resultado.datos });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un insumo con el código "${resultado.datos.codigo}".` };
    }
    throw e;
  }

  revalidatePath("/catalogo/insumos");
  revalidatePath(`/catalogo/insumos/${id}`);
  redirect("/catalogo/insumos");
}

export async function alternarActivoInsumo(id: string, activo: boolean) {
  await prisma.insumo.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/insumos");
}
