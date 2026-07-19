"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

// Un ajuste nunca modifica movimientos anteriores: es un movimiento nuevo
// que compensa la diferencia, con motivo y usuario obligatorios.
export async function crearAjuste(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const itemCompuesto = String(formData.get("item") ?? ""); // "PRESENTACION:id" | "INSUMO:id"
  const direccion = String(formData.get("direccion") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  const [tipoItem, itemId] = itemCompuesto.split(":");
  if ((tipoItem !== "PRESENTACION" && tipoItem !== "INSUMO") || !itemId) {
    return { error: "Seleccione el ítem a ajustar." };
  }
  if (direccion !== "ENTRADA" && direccion !== "SALIDA") {
    return { error: "Seleccione si el ajuste es entrada o salida." };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un número mayor a 0." };
  }
  if (!motivo) {
    return { error: "El motivo es obligatorio: explique por qué se regulariza." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const mov = await registrarMovimiento(tx, {
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? itemId : undefined,
        insumoId: tipoItem === "INSUMO" ? itemId : undefined,
        tipoMovimiento: direccion,
        origen: "AJUSTE",
        cantidad,
        motivo,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!mov.ok) throw new Error(mov.error);
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/inventario/kardex");
  redirect("/inventario/kardex");
}
