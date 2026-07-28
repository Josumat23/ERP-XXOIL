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
  // Almacén explícito (obligatorio para Traslados, donde origen y destino los
  // elige el usuario). Si se omite, se resuelve solo a partir de la zona
  // asignada al ítem (Presentacion/Insumo.zonaAlmacenId → ZonaAlmacen.almacenId),
  // y si el ítem no tiene zona, al almacén más antiguo de la empresa. Esto
  // mantiene el comportamiento de hoy (un solo almacén) sin tocar ningún
  // formulario existente de compras/producción/ventas/ajustes.
  almacenId?: string;
};

/** Resuelve a qué almacén pertenece un movimiento cuando no se indica explícitamente. */
async function resolverAlmacenId(
  tx: Tx,
  tipoItem: $Enums.TipoItemKardex,
  presentacionId?: string,
  insumoId?: string
): Promise<{ ok: true; almacenId: string } | { ok: false; error: string }> {
  const zonaAlmacenId =
    tipoItem === "PRESENTACION"
      ? (await tx.presentacion.findUnique({ where: { id: presentacionId! }, select: { zonaAlmacenId: true } }))
          ?.zonaAlmacenId
      : (await tx.insumo.findUnique({ where: { id: insumoId! }, select: { zonaAlmacenId: true } }))?.zonaAlmacenId;

  if (zonaAlmacenId) {
    const zona = await tx.zonaAlmacen.findUnique({ where: { id: zonaAlmacenId }, select: { almacenId: true } });
    if (zona) return { ok: true, almacenId: zona.almacenId };
  }

  const principal = await tx.almacen.findFirst({ where: { activo: true }, orderBy: { creadoEn: "asc" } });
  if (!principal) {
    return { ok: false, error: "No hay ningún almacén activo configurado (Configuración → Almacenes)." };
  }
  return { ok: true, almacenId: principal.id };
}

/**
 * Registra un movimiento de kardex y actualiza el stock del ítem, todo dentro
 * de la transacción recibida. El kardex es inmutable: nunca se edita ni borra;
 * cualquier corrección se hace con un movimiento nuevo de origen AJUSTE.
 * Devuelve error legible si la salida dejaría stock negativo (por almacén).
 *
 * Mantiene dos saldos en sincronía dentro de la misma transacción:
 * - SaldoAlmacen: el saldo real por almacén (lo que valida la operación).
 * - Presentacion.stock / Insumo.stock: el total agregado de todos los
 *   almacenes, para no romper ninguna pantalla que ya lee ese campo.
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

  if (tipoItem === "PRESENTACION" && !presentacionId) return { ok: false, error: "Falta la presentación." };
  if (tipoItem === "INSUMO" && !insumoId) return { ok: false, error: "Falta el insumo." };

  let almacenId = params.almacenId;
  if (!almacenId) {
    const resuelto = await resolverAlmacenId(tx, tipoItem, presentacionId, insumoId);
    if (!resuelto.ok) return resuelto;
    almacenId = resuelto.almacenId;
  }

  let nombreItem: string;
  if (tipoItem === "PRESENTACION") {
    const item = await tx.presentacion.findUnique({ where: { id: presentacionId } });
    if (!item) return { ok: false, error: "La presentación no existe." };
    nombreItem = item.nombre;
  } else {
    const item = await tx.insumo.findUnique({ where: { id: insumoId } });
    if (!item) return { ok: false, error: "El insumo no existe." };
    nombreItem = item.nombre;
  }

  const saldoAlmacen = await tx.saldoAlmacen.findUnique({
    where: {
      almacenId_tipoItem_presentacionId_insumoId: {
        almacenId,
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? presentacionId! : null,
        insumoId: tipoItem === "INSUMO" ? insumoId! : null,
      },
    },
  });
  const saldoAnterior = saldoAlmacen?.cantidad.toNumber() ?? 0;

  const delta = tipoMovimiento === "ENTRADA" ? cantidad : -cantidad;
  const saldoNuevo = saldoAnterior + delta;
  if (saldoNuevo < 0) {
    const almacen = await tx.almacen.findUnique({ where: { id: almacenId }, select: { nombre: true } });
    return {
      ok: false,
      error: `Stock insuficiente de "${nombreItem}" en el almacén ${almacen?.nombre ?? almacenId}: disponible ${saldoAnterior}, se requiere ${cantidad}.`,
    };
  }

  await tx.movimientoKardex.create({
    data: {
      almacenId,
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

  await tx.saldoAlmacen.upsert({
    where: {
      almacenId_tipoItem_presentacionId_insumoId: {
        almacenId,
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? presentacionId! : null,
        insumoId: tipoItem === "INSUMO" ? insumoId! : null,
      },
    },
    update: { cantidad: saldoNuevo },
    create: {
      almacenId,
      tipoItem,
      presentacionId: tipoItem === "PRESENTACION" ? presentacionId : null,
      insumoId: tipoItem === "INSUMO" ? insumoId : null,
      cantidad: saldoNuevo,
    },
  });

  if (tipoItem === "PRESENTACION") {
    await tx.presentacion.update({ where: { id: presentacionId }, data: { stock: { increment: delta } } });
  } else {
    await tx.insumo.update({ where: { id: insumoId }, data: { stock: { increment: delta } } });
  }

  return { ok: true };
}
