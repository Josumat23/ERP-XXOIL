import type { $Enums } from "@/generated/prisma/client";
import {
  postearAplicacionCreditoProveedor,
  postearReembolsoProveedor,
} from "@/lib/contabilidad";
import type { Tx } from "@/lib/inventario";

type Auditoria = { usuarioId: string; usuarioNombre: string };

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularDistribucionDevolucionProveedor(params: {
  montoFuncional: number;
  saldoCxp: number;
}) {
  if (!Number.isFinite(params.montoFuncional) || params.montoFuncional <= 0) {
    throw new Error("El importe funcional de la devolución es inválido.");
  }
  const montoCxp = redondearMoneda(Math.min(params.montoFuncional, Math.max(0, params.saldoCxp)));
  return {
    montoCxp,
    montoSaldoFavor: redondearMoneda(params.montoFuncional - montoCxp),
    nuevoSaldoCxp: redondearMoneda(Math.max(0, params.saldoCxp - montoCxp)),
  };
}

export async function aplicarCreditoProveedor(
  tx: Tx,
  params: { creditoId: string; cuentaPorPagarId: string; montoFuncional: number },
  audit: Auditoria
): Promise<void> {
  if (!Number.isFinite(params.montoFuncional) || params.montoFuncional <= 0) {
    throw new Error("El monto a compensar debe ser mayor a cero.");
  }
  const bloqueoCredito = await tx.creditoProveedor.updateMany({
    where: { id: params.creditoId },
    data: { saldoFuncional: { increment: 0 } },
  });
  const bloqueoCxp = await tx.cuentaPorPagar.updateMany({
    where: { id: params.cuentaPorPagarId },
    data: { saldo: { increment: 0 } },
  });
  if (bloqueoCredito.count !== 1 || bloqueoCxp.count !== 1) {
    throw new Error("El crédito o la cuenta por pagar no existe.");
  }
  const [credito, cxp] = await Promise.all([
    tx.creditoProveedor.findUnique({
      where: { id: params.creditoId },
      include: { proveedor: true, reembolsos: true },
    }),
    tx.cuentaPorPagar.findUnique({ where: { id: params.cuentaPorPagarId } }),
  ]);
  if (!credito || !cxp) throw new Error("El crédito o la cuenta por pagar no existe.");
  if (credito.estado !== "DISPONIBLE" || credito.saldoFuncional.toNumber() <= 0) {
    throw new Error("El crédito ya no tiene saldo disponible.");
  }
  if (cxp.estado !== "PENDIENTE" || cxp.saldo.toNumber() <= 0) {
    throw new Error("La cuenta por pagar no tiene saldo aplicable.");
  }
  if (credito.empresaId !== cxp.empresaId || credito.proveedorId !== cxp.proveedorId) {
    throw new Error("El crédito solo puede compensar documentos del mismo proveedor y empresa.");
  }
  if (
    params.montoFuncional > credito.saldoFuncional.toNumber() + 1e-9 ||
    params.montoFuncional > cxp.saldo.toNumber() + 1e-9
  ) {
    throw new Error("El monto supera el saldo disponible del crédito o de la cuenta por pagar.");
  }
  const nuevoCredito = redondearMoneda(credito.saldoFuncional.toNumber() - params.montoFuncional);
  const nuevoCxp = redondearMoneda(cxp.saldo.toNumber() - params.montoFuncional);
  const [creditoActualizado, cxpActualizada] = await Promise.all([
    tx.creditoProveedor.updateMany({
      where: { id: credito.id, saldoFuncional: credito.saldoFuncional },
      data: {
        saldoFuncional: nuevoCredito,
        estado: nuevoCredito <= 1e-9 ? "AGOTADO" : "DISPONIBLE",
      },
    }),
    tx.cuentaPorPagar.updateMany({
      where: { id: cxp.id, saldo: cxp.saldo, estado: cxp.estado },
      data: { saldo: nuevoCxp, estado: nuevoCxp <= 1e-9 ? "PAGADA" : "PENDIENTE" },
    }),
  ]);
  if (creditoActualizado.count !== 1 || cxpActualizada.count !== 1) {
    throw new Error("Los saldos cambiaron durante la compensación. Actualice e intente nuevamente.");
  }
  await tx.aplicacionCreditoProveedor.create({
    data: {
      empresaId: credito.empresaId,
      creditoId: credito.id,
      cuentaPorPagarId: cxp.id,
      montoFuncional: params.montoFuncional,
      ...audit,
    },
  });
  await postearAplicacionCreditoProveedor(
    tx,
    {
      proveedor: credito.proveedor.razonSocial,
      documentoProveedor: cxp.numeroDocumento,
      montoFuncional: params.montoFuncional,
    },
    audit
  );
}

export async function registrarReembolsoProveedor(
  tx: Tx,
  params: {
    creditoId: string;
    montoFuncional: number;
    medioPago: $Enums.MedioPago;
    referencia: string;
  },
  audit: Auditoria
): Promise<void> {
  if (!Number.isFinite(params.montoFuncional) || params.montoFuncional <= 0) {
    throw new Error("El monto recibido debe ser mayor a cero.");
  }
  if (params.referencia.trim().length < 3) {
    throw new Error("Ingrese la referencia bancaria o constancia del reembolso.");
  }
  const bloqueo = await tx.creditoProveedor.updateMany({
    where: { id: params.creditoId },
    data: { saldoFuncional: { increment: 0 } },
  });
  if (bloqueo.count !== 1) throw new Error("El crédito no existe.");
  const credito = await tx.creditoProveedor.findUnique({
    where: { id: params.creditoId },
    include: { proveedor: true },
  });
  if (!credito || credito.estado !== "DISPONIBLE") {
    throw new Error("El crédito no tiene saldo disponible.");
  }
  if (params.montoFuncional > credito.saldoFuncional.toNumber() + 1e-9) {
    throw new Error("El monto recibido supera el saldo disponible.");
  }
  const nuevoSaldo = redondearMoneda(credito.saldoFuncional.toNumber() - params.montoFuncional);
  const consumido = await tx.creditoProveedor.updateMany({
    where: { id: credito.id, saldoFuncional: credito.saldoFuncional },
    data: {
      saldoFuncional: nuevoSaldo,
      estado: nuevoSaldo <= 1e-9 ? "AGOTADO" : "DISPONIBLE",
    },
  });
  if (consumido.count !== 1) throw new Error("El saldo cambió durante el reembolso.");
  await tx.reembolsoProveedor.create({
    data: {
      empresaId: credito.empresaId,
      creditoId: credito.id,
      montoFuncional: params.montoFuncional,
      medioPago: params.medioPago,
      referencia: params.referencia.trim(),
      ...audit,
    },
  });
  await tx.movimientoCaja.create({
    data: {
      empresaId: credito.empresaId,
      tipo: "INGRESO",
      concepto: `Reembolso de ${credito.proveedor.razonSocial} por saldo a favor`,
      monto: params.montoFuncional,
      moneda: "PEN",
      tipoCambio: 1,
      montoOriginal: params.montoFuncional,
      medioPago: params.medioPago,
      referencia: params.referencia.trim(),
      ...audit,
    },
  });
  await postearReembolsoProveedor(
    tx,
    {
      proveedor: credito.proveedor.razonSocial,
      referencia: params.referencia.trim(),
      montoFuncional: params.montoFuncional,
    },
    audit
  );
}
