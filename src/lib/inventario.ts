import type { Prisma, $Enums } from "@/generated/prisma/client";

// Cliente de transacción de Prisma (lo que recibe el callback de $transaction)
export type Tx = Prisma.TransactionClient;

type ParamsMovimiento = {
  tipoItem: $Enums.TipoItemKardex;
  presentacionId?: string;
  insumoId?: string;
  tipoMovimiento: $Enums.TipoMovimiento;
  origen: $Enums.OrigenMovimiento;
  cantidad: number; // siempre positiva
  motivo?: string;
  referencia?: string;
  usuarioId: string;
  usuarioNombre: string;
};

/**
 * Registra un movimiento de kardex y actualiza el stock del ítem, todo dentro
 * de la transacción recibida. El kardex es inmutable: nunca se edita ni borra;
 * cualquier corrección se hace con un movimiento nuevo de origen AJUSTE.
 * Devuelve error legible si la salida dejaría stock negativo.
 */
export async function registrarMovimiento(
  tx: Tx,
  params: ParamsMovimiento
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    tipoItem, presentacionId, insumoId, tipoMovimiento, origen,
    cantidad, motivo, referencia, usuarioId, usuarioNombre,
  } = params;

  if (cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
  if (origen === "AJUSTE" && !motivo?.trim()) {
    return { ok: false, error: "El motivo es obligatorio en un ajuste." };
  }

  let saldoAnterior: number;
  let nombreItem: string;

  if (tipoItem === "PRESENTACION") {
    if (!presentacionId) return { ok: false, error: "Falta la presentación." };
    const item = await tx.presentacion.findUnique({ where: { id: presentacionId } });
    if (!item) return { ok: false, error: "La presentación no existe." };
    saldoAnterior = item.stock.toNumber();
    nombreItem = item.nombre;
  } else {
    if (!insumoId) return { ok: false, error: "Falta el insumo." };
    const item = await tx.insumo.findUnique({ where: { id: insumoId } });
    if (!item) return { ok: false, error: "El insumo no existe." };
    saldoAnterior = item.stock.toNumber();
    nombreItem = item.nombre;
  }

  const delta = tipoMovimiento === "ENTRADA" ? cantidad : -cantidad;
  const saldoNuevo = saldoAnterior + delta;
  if (saldoNuevo < 0) {
    return {
      ok: false,
      error: `Stock insuficiente de "${nombreItem}": disponible ${saldoAnterior}, se requiere ${cantidad}.`,
    };
  }

  await tx.movimientoKardex.create({
    data: {
      tipoItem,
      presentacionId: tipoItem === "PRESENTACION" ? presentacionId : null,
      insumoId: tipoItem === "INSUMO" ? insumoId : null,
      tipoMovimiento,
      origen,
      cantidad,
      saldoAnterior,
      saldoNuevo,
      motivo: motivo?.trim() || null,
      referencia: referencia ?? null,
      usuarioId,
      usuarioNombre,
    },
  });

  if (tipoItem === "PRESENTACION") {
    await tx.presentacion.update({ where: { id: presentacionId }, data: { stock: saldoNuevo } });
  } else {
    await tx.insumo.update({ where: { id: insumoId }, data: { stock: saldoNuevo } });
  }

  return { ok: true };
}
