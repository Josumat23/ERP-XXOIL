import type { Tx } from "@/lib/inventario";
import { postearPagoProveedor } from "@/lib/contabilidad";

type Auditoria = { usuarioId: string; usuarioNombre: string };

/**
 * Registra un pago a una cuenta por pagar dentro de la transacción en curso:
 * crea el PagoProveedor, y si no requiere aprobación (por debajo del umbral),
 * también descuenta caja, actualiza el saldo y postea el asiento contable de
 * una vez. Compartido por el pago individual (cuentas-por-pagar) y la
 * propuesta de pago en lote (varias cuentas de una vez).
 */
export async function ejecutarPagoProveedor(
  tx: Tx,
  params: {
    cuentaId: string;
    monto: number;
    medioPago: string;
    referencia?: string | null;
    montoAprobacionPagos: number;
  },
  audit: Auditoria
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cuenta = await tx.cuentaPorPagar.findUnique({
    where: { id: params.cuentaId },
    include: { proveedor: true, pagos: true },
  });
  if (!cuenta) return { ok: false, error: "La cuenta por pagar no existe." };
  if (cuenta.pagos.some((p) => p.estadoAprobacion === "PENDIENTE")) {
    return { ok: false, error: `${cuenta.proveedor.razonSocial}: ya hay un pago pendiente de aprobación.` };
  }

  const saldo = cuenta.saldo.toNumber();
  if (params.monto > saldo + 1e-9) {
    return {
      ok: false,
      error: `${cuenta.proveedor.razonSocial}: el monto supera el saldo pendiente (${saldo.toFixed(2)}).`,
    };
  }

  const requiereAprobacion = params.monto >= params.montoAprobacionPagos;

  await tx.pagoProveedor.create({
    data: {
      cuentaPorPagarId: params.cuentaId,
      monto: params.monto,
      medioPago: params.medioPago as never,
      referencia: params.referencia ?? null,
      estadoAprobacion: requiereAprobacion ? "PENDIENTE" : "NO_REQUERIDA",
      usuarioId: audit.usuarioId,
      usuarioNombre: audit.usuarioNombre,
    },
  });

  // Si supera el umbral, el pago queda "solicitado": no se descuenta de caja
  // ni del saldo hasta que Gerencia/Admin lo apruebe.
  if (requiereAprobacion) return { ok: true };

  await tx.movimientoCaja.create({
    data: {
      tipo: "EGRESO",
      concepto: `Pago a ${cuenta.proveedor.razonSocial} (doc. ${cuenta.numeroDocumento})`,
      monto: params.monto,
      medioPago: params.medioPago as never,
      referencia: cuenta.numeroDocumento,
      usuarioId: audit.usuarioId,
      usuarioNombre: audit.usuarioNombre,
    },
  });

  const nuevoSaldo = saldo - params.monto;
  await tx.cuentaPorPagar.update({
    where: { id: params.cuentaId },
    data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE" },
  });

  await postearPagoProveedor(
    tx,
    { documentoProveedor: cuenta.numeroDocumento, proveedor: cuenta.proveedor.razonSocial, monto: params.monto },
    audit
  );

  return { ok: true };
}
