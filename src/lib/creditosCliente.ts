import type { $Enums } from "@/generated/prisma/client";
import { postearAplicacionCreditoCliente, postearReembolsoCliente } from "@/lib/contabilidad";
import { convertirAMonedaFuncional } from "@/lib/multimoneda";
import type { Tx } from "@/lib/inventario";

export type AuditoriaCreditoCliente = { usuarioId: string; usuarioNombre: string };

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function importeFuncionalProporcional(monto: number, saldo: number, saldoFuncional: number): number {
  return Math.abs(monto - saldo) <= 1e-9
    ? redondearMoneda(saldoFuncional)
    : redondearMoneda(saldoFuncional * monto / saldo);
}

export function calcularDistribucionNotaCredito(params: {
  monto: number;
  montoFuncional: number;
  saldoFactura: number;
  saldoFuncionalFactura: number;
}) {
  if (
    !Number.isFinite(params.monto) ||
    params.monto <= 0 ||
    !Number.isFinite(params.montoFuncional) ||
    params.montoFuncional <= 0
  ) {
    throw new Error("Los importes de la nota de crédito son inválidos.");
  }
  const montoCxc = Math.min(params.monto, params.saldoFactura);
  const montoCxcFuncional = montoCxc <= 1e-9
    ? 0
    : importeFuncionalProporcional(
        montoCxc,
        params.saldoFactura,
        params.saldoFuncionalFactura
      );
  return {
    montoCxc,
    montoCxcFuncional,
    montoSaldoFavor: redondearMoneda(params.monto - montoCxc),
    montoSaldoFavorFuncional: redondearMoneda(params.montoFuncional - montoCxcFuncional),
    nuevoSaldoFactura: redondearMoneda(params.saldoFactura - montoCxc),
    nuevoSaldoFuncionalFactura: redondearMoneda(
      params.saldoFuncionalFactura - montoCxcFuncional
    ),
  };
}
export function calcularAplicacionCreditoCliente(params: {
  monto: number;
  saldoCredito: number;
  saldoFuncionalCredito: number;
  saldoFactura: number;
  saldoFuncionalFactura: number;
}) {
  if (!Number.isFinite(params.monto) || params.monto <= 0) {
    throw new Error("El monto a compensar debe ser mayor a cero.");
  }
  if (params.monto > params.saldoCredito + 1e-9 || params.monto > params.saldoFactura + 1e-9) {
    throw new Error("El monto supera el saldo disponible del crédito o de la factura.");
  }
  const creditoFuncionalAplicado = importeFuncionalProporcional(
    params.monto,
    params.saldoCredito,
    params.saldoFuncionalCredito
  );
  const cxcFuncionalAplicada = importeFuncionalProporcional(
    params.monto,
    params.saldoFactura,
    params.saldoFuncionalFactura
  );
  return {
    creditoFuncionalAplicado,
    cxcFuncionalAplicada,
    diferenciaCambio: redondearMoneda(creditoFuncionalAplicado - cxcFuncionalAplicada),
    nuevoSaldoCredito: redondearMoneda(params.saldoCredito - params.monto),
    nuevoSaldoFuncionalCredito: redondearMoneda(params.saldoFuncionalCredito - creditoFuncionalAplicado),
    nuevoSaldoFactura: redondearMoneda(params.saldoFactura - params.monto),
    nuevoSaldoFuncionalFactura: redondearMoneda(params.saldoFuncionalFactura - cxcFuncionalAplicada),
  };
}

export async function aplicarCreditoCliente(
  tx: Tx,
  params: { creditoId: string; facturaId: string; monto: number },
  audit: AuditoriaCreditoCliente
): Promise<void> {
  const bloqueoCredito = await tx.creditoCliente.updateMany({
    where: { id: params.creditoId },
    data: { saldo: { increment: 0 }, saldoFuncional: { increment: 0 } },
  });
  const bloqueoFactura = await tx.factura.updateMany({
    where: { id: params.facturaId },
    data: { saldo: { increment: 0 }, saldoFuncional: { increment: 0 } },
  });
  if (bloqueoCredito.count !== 1 || bloqueoFactura.count !== 1) {
    throw new Error("El crédito o la factura no existe.");
  }

  const [credito, factura] = await Promise.all([
    tx.creditoCliente.findUnique({
      where: { id: params.creditoId },
      include: { notaCredito: true, reembolsos: true },
    }),
    tx.factura.findUnique({ where: { id: params.facturaId } }),
  ]);
  if (!credito || !factura) throw new Error("El crédito o la factura no existe.");
  if (credito.estado !== "DISPONIBLE" || credito.saldo.toNumber() <= 0) {
    throw new Error("El crédito ya no tiene saldo disponible.");
  }
  if (credito.reembolsos.some((reembolso) => reembolso.estadoAprobacion === "PENDIENTE")) {
    throw new Error("El crédito tiene un reembolso pendiente y no puede compensarse.");
  }
  if (factura.estado === "ANULADA" || factura.saldo.toNumber() <= 0) {
    throw new Error("La factura no tiene una cuenta por cobrar aplicable.");
  }
  if (
    credito.empresaId !== factura.empresaId ||
    credito.clienteId !== factura.clienteId ||
    credito.moneda !== factura.moneda
  ) {
    throw new Error("El crédito solo puede compensar facturas del mismo cliente, empresa y moneda.");
  }

  const calculo = calcularAplicacionCreditoCliente({
    monto: params.monto,
    saldoCredito: credito.saldo.toNumber(),
    saldoFuncionalCredito: credito.saldoFuncional.toNumber(),
    saldoFactura: factura.saldo.toNumber(),
    saldoFuncionalFactura: factura.saldoFuncional.toNumber(),
  });
  const creditoActualizado = await tx.creditoCliente.updateMany({
    where: { id: credito.id, saldo: credito.saldo, saldoFuncional: credito.saldoFuncional },
    data: {
      saldo: calculo.nuevoSaldoCredito,
      saldoFuncional: calculo.nuevoSaldoFuncionalCredito,
      estado: calculo.nuevoSaldoCredito <= 1e-9 ? "AGOTADO" : "DISPONIBLE",
    },
  });
  const facturaActualizada = await tx.factura.updateMany({
    where: {
      id: factura.id,
      estado: factura.estado,
      saldo: factura.saldo,
      saldoFuncional: factura.saldoFuncional,
    },
    data: {
      saldo: calculo.nuevoSaldoFactura,
      saldoFuncional: calculo.nuevoSaldoFuncionalFactura,
      estado: calculo.nuevoSaldoFactura <= 1e-9 ? "PAGADA" : "PENDIENTE",
    },
  });
  if (creditoActualizado.count !== 1 || facturaActualizada.count !== 1) {
    throw new Error("Los saldos cambiaron durante la compensación. Actualice e intente nuevamente.");
  }

  await tx.aplicacionCreditoCliente.create({
    data: {
      empresaId: credito.empresaId,
      creditoId: credito.id,
      facturaId: factura.id,
      monto: params.monto,
      creditoFuncionalAplicado: calculo.creditoFuncionalAplicado,
      cxcFuncionalAplicada: calculo.cxcFuncionalAplicada,
      diferenciaCambio: calculo.diferenciaCambio,
      ...audit,
    },
  });
  await postearAplicacionCreditoCliente(
    tx,
    {
      numeroNC: credito.notaCredito.numero,
      numeroFactura: factura.numero,
      creditoFuncionalAplicado: calculo.creditoFuncionalAplicado,
      cxcFuncionalAplicada: calculo.cxcFuncionalAplicada,
      diferenciaCambio: calculo.diferenciaCambio,
    },
    audit
  );
}

export function calcularReembolsoCreditoCliente(params: {
  monto: number;
  saldoCredito: number;
  saldoFuncionalCredito: number;
  moneda: string;
  tipoCambio: number;
}) {
  if (!Number.isFinite(params.monto) || params.monto <= 0 || params.monto > params.saldoCredito + 1e-9) {
    throw new Error("El monto de reembolso es inválido para el saldo disponible.");
  }
  const creditoFuncionalAplicado = importeFuncionalProporcional(
    params.monto,
    params.saldoCredito,
    params.saldoFuncionalCredito
  );
  const montoFuncional = convertirAMonedaFuncional(params.monto, params.moneda, params.tipoCambio);
  return {
    creditoFuncionalAplicado,
    montoFuncional,
    diferenciaCambio: redondearMoneda(creditoFuncionalAplicado - montoFuncional),
  };
}

async function ejecutarReembolso(
  tx: Tx,
  reembolsoId: string,
  aprobador?: AuditoriaCreditoCliente
): Promise<void> {
  const reembolso = await tx.reembolsoCliente.findUnique({
    where: { id: reembolsoId },
    include: { credito: { include: { cliente: true, notaCredito: true } } },
  });
  if (!reembolso) throw new Error("El reembolso no existe.");
  if (aprobador) {
    if (reembolso.estadoAprobacion !== "PENDIENTE") throw new Error("El reembolso no está pendiente.");
    const aprobado = await tx.reembolsoCliente.updateMany({
      where: { id: reembolso.id, estadoAprobacion: "PENDIENTE" },
      data: {
        estadoAprobacion: "APROBADA",
        aprobadoPor: aprobador.usuarioNombre,
        aprobadoEn: new Date(),
      },
    });
    if (aprobado.count !== 1) throw new Error("El reembolso cambió durante la aprobación.");
  } else if (reembolso.estadoAprobacion !== "NO_REQUERIDA") {
    throw new Error("El reembolso requiere aprobación antes de ejecutarse.");
  }

  const credito = reembolso.credito;
  if (reembolso.monto.toNumber() > credito.saldo.toNumber() + 1e-9) {
    throw new Error("El crédito ya no cubre el reembolso solicitado.");
  }
  const nuevoSaldo = redondearMoneda(credito.saldo.toNumber() - reembolso.monto.toNumber());
  const nuevoSaldoFuncional = redondearMoneda(
    credito.saldoFuncional.toNumber() - reembolso.creditoFuncionalAplicado.toNumber()
  );
  const consumido = await tx.creditoCliente.updateMany({
    where: { id: credito.id, saldo: credito.saldo, saldoFuncional: credito.saldoFuncional },
    data: {
      saldo: nuevoSaldo,
      saldoFuncional: nuevoSaldoFuncional,
      estado: nuevoSaldo <= 1e-9 ? "AGOTADO" : "DISPONIBLE",
    },
  });
  if (consumido.count !== 1) throw new Error("El saldo cambió durante el reembolso.");

  await tx.movimientoCaja.create({
    data: {
      empresaId: credito.empresaId,
      tipo: "EGRESO",
      concepto: "Reembolso saldo a favor " + credito.notaCredito.numero + " a " + credito.cliente.razonSocial,
      monto: reembolso.montoFuncional,
      moneda: reembolso.moneda,
      tipoCambio: reembolso.tipoCambio,
      montoOriginal: reembolso.monto,
      medioPago: reembolso.medioPago,
      referencia: reembolso.referencia ?? credito.notaCredito.numero,
      usuarioId: aprobador?.usuarioId ?? reembolso.usuarioId,
      usuarioNombre: aprobador?.usuarioNombre ?? reembolso.usuarioNombre,
    },
  });
  await postearReembolsoCliente(
    tx,
    {
      numeroNC: credito.notaCredito.numero,
      cliente: credito.cliente.razonSocial,
      montoCajaFuncional: reembolso.montoFuncional.toNumber(),
      creditoFuncionalAplicado: reembolso.creditoFuncionalAplicado.toNumber(),
      diferenciaCambio: reembolso.diferenciaCambio.toNumber(),
    },
    aprobador ?? { usuarioId: reembolso.usuarioId, usuarioNombre: reembolso.usuarioNombre }
  );
}

export async function solicitarReembolsoCliente(
  tx: Tx,
  params: {
    creditoId: string;
    monto: number;
    tipoCambio: number;
    medioPago: $Enums.MedioPago;
    referencia?: string | null;
    montoAprobacionPagos: number;
  },
  audit: AuditoriaCreditoCliente
): Promise<string> {
  const bloqueo = await tx.creditoCliente.updateMany({
    where: { id: params.creditoId },
    data: { saldo: { increment: 0 }, saldoFuncional: { increment: 0 } },
  });
  if (bloqueo.count !== 1) throw new Error("El crédito no existe.");
  const credito = await tx.creditoCliente.findUnique({
    where: { id: params.creditoId },
    include: { reembolsos: true },
  });
  if (!credito || credito.estado !== "DISPONIBLE") throw new Error("El crédito no tiene saldo disponible.");
  if (credito.reembolsos.some((reembolso) => reembolso.estadoAprobacion === "PENDIENTE")) {
    throw new Error("Ya existe un reembolso pendiente de aprobación para este crédito.");
  }
  const calculo = calcularReembolsoCreditoCliente({
    monto: params.monto,
    saldoCredito: credito.saldo.toNumber(),
    saldoFuncionalCredito: credito.saldoFuncional.toNumber(),
    moneda: credito.moneda,
    tipoCambio: params.tipoCambio,
  });
  const requiereAprobacion = calculo.montoFuncional >= params.montoAprobacionPagos;
  const reembolso = await tx.reembolsoCliente.create({
    data: {
      empresaId: credito.empresaId,
      creditoId: credito.id,
      monto: params.monto,
      moneda: credito.moneda,
      tipoCambio: params.tipoCambio,
      montoFuncional: calculo.montoFuncional,
      creditoFuncionalAplicado: calculo.creditoFuncionalAplicado,
      diferenciaCambio: calculo.diferenciaCambio,
      medioPago: params.medioPago,
      referencia: params.referencia ?? null,
      estadoAprobacion: requiereAprobacion ? "PENDIENTE" : "NO_REQUERIDA",
      ...audit,
    },
  });
  if (!requiereAprobacion) await ejecutarReembolso(tx, reembolso.id);
  return reembolso.id;
}

export async function aprobarReembolsoCliente(
  tx: Tx,
  reembolsoId: string,
  audit: AuditoriaCreditoCliente
): Promise<void> {
  await ejecutarReembolso(tx, reembolsoId, audit);
}