"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { registrarMovimiento } from "@/lib/inventario";

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
  const stockMinimo = Number(formData.get("stockMinimo") ?? 0);
  const costoUnitario = Number(formData.get("costoUnitario") ?? 0);

  if (!codigo || !nombre || !unidadMedida || !TIPOS_VALIDOS.includes(tipo)) {
    return { error: "Código, nombre, tipo y unidad de medida son obligatorios." } as const;
  }
  if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock mínimo debe ser un número válido." } as const;
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    return { error: "El costo unitario debe ser un número válido." } as const;
  }

  return {
    datos: { codigo, nombre, tipo, unidadMedida, proveedorId, stockMinimo, costoUnitario, moneda: "PEN" },
  } as const;
}

export async function crearInsumo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const resultado = leerDatos(formData);
  if ("error" in resultado) return resultado;

  const stockInicial = Number(formData.get("stock") ?? 0);
  if (!Number.isFinite(stockInicial) || stockInicial < 0) {
    return { error: "El stock inicial debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creado = await tx.insumo.create({ data: resultado.datos });
      if (stockInicial > 0) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: creado.id,
          tipoMovimiento: "ENTRADA",
          origen: "STOCK_INICIAL",
          cantidad: stockInicial,
          referencia: "Alta de insumo",
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: `Ya existe un insumo con el código "${resultado.datos.codigo}".` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/catalogo/insumos");
  redirect("/catalogo/insumos");
}

// La edición nunca toca el stock: eso solo ocurre vía kardex.
export async function actualizarInsumo(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

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
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  await prisma.insumo.update({ where: { id }, data: { activo } });
  revalidatePath("/catalogo/insumos");
}
