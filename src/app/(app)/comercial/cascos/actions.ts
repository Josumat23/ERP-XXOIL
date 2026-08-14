"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

// Ledger manual de cascos (envases retornables): no se deriva automáticamente
// de las ventas porque un envasado no siempre implica un casco nuevo
// entregado (podría ser un refill de uno que el cliente ya tiene).
export async function registrarMovimientoCasco(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const clienteId = String(formData.get("clienteId") ?? "");
  const insumoId = String(formData.get("insumoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!insumoId) return { error: "Seleccione el envase retornable." };
  if (tipo !== "ENTREGADO" && tipo !== "DEVUELTO") {
    return { error: "Seleccione si el movimiento es entrega o devolución." };
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un entero mayor a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Todos los movimientos del cliente comparten este bloqueo para que
      // dos devoluciones no validen simultáneamente contra el mismo saldo.
      const bloqueo = await tx.cliente.updateMany({
        where: { id: clienteId },
        data: { limiteCredito: { increment: 0 } },
      });
      if (bloqueo.count !== 1) throw new Error("El cliente no existe.");

      const insumo = await tx.insumo.findUnique({
        where: { id: insumoId },
        select: { esRetornable: true },
      });
      if (!insumo?.esRetornable) {
        throw new Error("El insumo seleccionado no es un envase retornable.");
      }

      if (tipo === "DEVUELTO") {
        const movimientos = await tx.movimientoCasco.findMany({
          where: { clienteId, insumoId },
          select: { tipo: true, cantidad: true },
        });
        const saldo = movimientos.reduce(
          (total, movimiento) =>
            total + (movimiento.tipo === "ENTREGADO" ? movimiento.cantidad : -movimiento.cantidad),
          0
        );
        if (cantidad > saldo) {
          throw new Error(`Solo hay ${saldo} envase(s) pendiente(s) de devolución.`);
        }
      }

      await tx.movimientoCasco.create({
        data: {
          clienteId,
          insumoId,
          tipo,
          cantidad,
          referencia,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/comercial/cascos");
  return {};
}
