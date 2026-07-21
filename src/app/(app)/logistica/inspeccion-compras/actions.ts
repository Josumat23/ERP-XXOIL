"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

// Resultado de la inspección de calidad de una recepción de compra: si se
// aprueba, recién aquí entra al kardex y se actualiza el costo promedio
// (quedó pendiente desde la recepción). Si se rechaza, nunca suma stock; la
// devolución/nota de crédito al proveedor se maneja fuera del sistema, igual
// que las notas de crédito de venta.
export async function resolverInspeccionCompra(
  inspeccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const resultado = String(formData.get("resultado") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (resultado !== "APROBADO" && resultado !== "RECHAZADO") {
    return { error: "Seleccione el resultado de la inspección." };
  }
  if (resultado === "RECHAZADO" && !observaciones) {
    return { error: "Al rechazar una recepción, las observaciones son obligatorias." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const inspeccion = await tx.inspeccionCompra.findUnique({
        where: { id: inspeccionId },
        include: {
          recepcionDetalle: {
            include: { insumo: true, recepcion: { include: { ordenCompra: true } } },
          },
        },
      });
      if (!inspeccion) throw new Error("La inspección no existe.");
      if (inspeccion.resultado !== "PENDIENTE") {
        throw new Error("Esta recepción ya fue evaluada.");
      }

      const detalle = inspeccion.recepcionDetalle;
      const insumo = detalle.insumo;
      const cantidad = detalle.cantidad.toNumber();
      const costo = detalle.costoUnitario.toNumber();

      if (resultado === "APROBADO") {
        const stockActual = insumo.stock.toNumber();
        const costoActual = insumo.costoUnitario.toNumber();
        const nuevoCosto =
          stockActual + cantidad > 0
            ? (stockActual * costoActual + cantidad * costo) / (stockActual + cantidad)
            : costo;
        await tx.insumo.update({ where: { id: insumo.id }, data: { costoUnitario: nuevoCosto } });

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: insumo.id,
          tipoMovimiento: "ENTRADA",
          origen: "COMPRA",
          cantidad,
          referencia: `Recepción ${detalle.recepcion.numero} (${detalle.recepcion.ordenCompra.numero}) — aprobado en inspección de calidad`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      await tx.inspeccionCompra.update({
        where: { id: inspeccionId },
        data: {
          resultado,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          fecha: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/inspeccion-compras");
  revalidatePath(`/logistica/inspeccion-compras/${inspeccionId}`);
  revalidatePath("/inventario/kardex");
  revalidatePath("/catalogo/insumos");
  return {};
}
