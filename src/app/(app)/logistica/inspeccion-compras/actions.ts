"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

// Resultado de la inspección de calidad de una recepción de compra: si se
// aprueba, recién aquí entra al kardex y se actualiza el costo promedio
// (quedó pendiente desde la recepción). Si se rechaza, nunca suma stock; la
// devolución/nota de crédito al proveedor se registra después desde la OC;
// cualquier exceso sobre la CxP queda en el subledger de saldos a favor.
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

      const reclamo = await tx.inspeccionCompra.updateMany({
        where: { id: inspeccionId, resultado: "PENDIENTE" },
        data: {
          resultado,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          fecha: new Date(),
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("Esta recepción cambió mientras se evaluaba. Actualice la página e intente nuevamente.");
      }

      const detalle = inspeccion.recepcionDetalle;
      const insumo = detalle.insumo;
      const cantidad = detalle.cantidad.toNumber();
      const costo = detalle.costoUnitario.toNumber();

      if (resultado === "APROBADO") {
        await tx.recepcionCompraDetalle.update({
          where: { id: detalle.id },
          data: { cantidadDisponible: cantidad },
        });

        const costoActualizado = await actualizarCostoPromedioEntrada(tx, {
          tipoItem: "INSUMO",
          itemId: insumo.id,
          stockActual: insumo.stock,
          costoActual: insumo.costoUnitario,
          cantidadEntrada: cantidad,
          costoEntrada: costo,
        });
        if (!costoActualizado.ok) throw new Error(costoActualizado.error);

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
