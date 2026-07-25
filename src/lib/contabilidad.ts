import type { Tx } from "@/lib/inventario";
import type { $Enums } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Motor de contabilización automática (equivalente reducido a los GL Controls
// y al posting engine de Epicor).
//
// Filosofía "best-effort": si el plan de cuentas o los controles contables
// aún no están configurados, la transacción operativa (factura, cobro, etc.)
// se completa igual y simplemente no se genera asiento. Así la contabilidad
// se puede activar cuando el contador configure las cuentas, sin bloquear
// la operación diaria.
// ---------------------------------------------------------------------------

export type ClaveControl =
  | "CUENTAS_POR_COBRAR"
  | "VENTAS"
  | "IGV_POR_PAGAR"
  | "COSTO_VENTAS"
  | "INVENTARIO_PT"
  | "INVENTARIO_INSUMOS"
  | "CAJA_BANCOS"
  | "CUENTAS_POR_PAGAR"
  | "DEVOLUCIONES";

export const ETIQUETA_CONTROL: Record<ClaveControl, string> = {
  CUENTAS_POR_COBRAR: "Cuentas por cobrar comerciales",
  VENTAS: "Ventas",
  IGV_POR_PAGAR: "IGV por pagar",
  COSTO_VENTAS: "Costo de ventas",
  INVENTARIO_PT: "Inventario de productos terminados",
  INVENTARIO_INSUMOS: "Inventario de materias primas y suministros",
  CAJA_BANCOS: "Caja y bancos",
  CUENTAS_POR_PAGAR: "Cuentas por pagar comerciales",
  DEVOLUCIONES: "Devoluciones y descuentos concedidos",
};

type LineaAsiento = { clave: ClaveControl; glosa?: string; debe?: number; haber?: number };

type ParamsAsiento = {
  origen: $Enums.OrigenAsiento;
  glosa: string;
  referencia?: string;
  fecha?: Date;
  lineas: LineaAsiento[];
  usuarioId: string;
  usuarioNombre: string;
};

async function siguienteNumeroAsiento(tx: Tx): Promise<string> {
  const ultimo = await tx.asientoContable.findFirst({ orderBy: { numero: "desc" } });
  const n = ultimo ? parseInt(ultimo.numero.slice(3), 10) + 1 : 1;
  return `AS-${String(n).padStart(5, "0")}`;
}

async function libroDiario(tx: Tx) {
  const libro = await tx.libro.findFirst({ where: { codigo: "DIARIO" } });
  if (libro) return libro;
  return tx.libro.create({ data: { codigo: "DIARIO", nombre: "Libro diario" } });
}

/**
 * Genera un asiento automático dentro de la transacción en curso.
 * - Redondea cada línea a 2 decimales y descarta líneas en cero.
 * - Si el debe y el haber difieren por redondeo (≤ 0.05), ajusta la última línea.
 * - Si faltan controles contables o el asiento queda descuadrado, NO lanza:
 *   devuelve { ok: false } y la transacción operativa continúa sin asiento.
 * - Si el período fiscal del mes está CERRADO, tampoco postea (la operación
 *   comercial no debe bloquearse; el contador reabrirá el período o hará el
 *   asiento manual).
 */
export async function postearAsiento(
  tx: Tx,
  params: ParamsAsiento
): Promise<{ ok: boolean; motivo?: string; numero?: string }> {
  const fecha = params.fecha ?? new Date();
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;

  // Período fiscal cerrado → no postear
  const periodo = await tx.periodoFiscal.findUnique({
    where: { empresaId_anio_mes: { empresaId: "1", anio, mes } },
  });
  if (periodo?.estado === "CERRADO") {
    return { ok: false, motivo: `Período fiscal ${mes}/${anio} cerrado` };
  }

  // Resolver cuentas de control
  const claves = [...new Set(params.lineas.map((l) => l.clave))];
  const controles = await tx.controlContable.findMany({
    where: { clave: { in: claves } },
  });
  const cuentaPorClave = new Map(controles.map((c) => [c.clave, c.cuentaId]));
  const faltantes = claves.filter((c) => !cuentaPorClave.has(c));
  if (faltantes.length > 0) {
    return { ok: false, motivo: `Controles contables sin configurar: ${faltantes.join(", ")}` };
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const lineas = params.lineas
    .map((l) => ({
      cuentaId: cuentaPorClave.get(l.clave)!,
      glosa: l.glosa ?? null,
      debe: r2(l.debe ?? 0),
      haber: r2(l.haber ?? 0),
    }))
    .filter((l) => l.debe > 0 || l.haber > 0);

  if (lineas.length < 2) return { ok: false, motivo: "Asiento con menos de dos líneas" };

  let totalDebe = r2(lineas.reduce((acc, l) => acc + l.debe, 0));
  let totalHaber = r2(lineas.reduce((acc, l) => acc + l.haber, 0));
  const diferencia = r2(totalDebe - totalHaber);

  if (Math.abs(diferencia) > 0.05) {
    return { ok: false, motivo: `Asiento descuadrado (debe ${totalDebe} vs haber ${totalHaber})` };
  }
  if (diferencia !== 0) {
    // Ajuste por redondeo en la última línea del lado menor
    const ultima = lineas[lineas.length - 1];
    if (diferencia > 0) ultima.haber = r2(ultima.haber + diferencia);
    else ultima.debe = r2(ultima.debe - diferencia);
  }

  const libro = await libroDiario(tx);
  const numero = await siguienteNumeroAsiento(tx);

  await tx.asientoContable.create({
    data: {
      libroId: libro.id,
      numero,
      fecha,
      anio,
      mes,
      origen: params.origen,
      glosa: params.glosa,
      referencia: params.referencia ?? null,
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
      detalles: { create: lineas },
    },
  });

  return { ok: true, numero };
}

type Auditoria = { usuarioId: string; usuarioNombre: string };

// --- Posteos específicos por transacción -----------------------------------

// Venta: CxC (debe) / Ventas + IGV (haber); costo: Costo de ventas (debe) /
// Inventario PT (haber). El costo solo se postea si es mayor a cero.
export async function postearVenta(
  tx: Tx,
  datos: {
    numeroFactura: string;
    cliente: string;
    subtotal: number;
    igv: number;
    total: number;
    costoVentas: number;
    fecha?: Date;
  },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "VENTA",
    glosa: `Venta según factura ${datos.numeroFactura} — ${datos.cliente}`,
    referencia: datos.numeroFactura,
    fecha: datos.fecha,
    lineas: [
      { clave: "CUENTAS_POR_COBRAR", debe: datos.total },
      { clave: "VENTAS", haber: datos.subtotal },
      { clave: "IGV_POR_PAGAR", haber: datos.igv },
    ],
    ...audit,
  });

  if (datos.costoVentas > 0) {
    await postearAsiento(tx, {
      origen: "VENTA",
      glosa: `Costo de venta factura ${datos.numeroFactura}`,
      referencia: datos.numeroFactura,
      fecha: datos.fecha,
      lineas: [
        { clave: "COSTO_VENTAS", debe: datos.costoVentas },
        { clave: "INVENTARIO_PT", haber: datos.costoVentas },
      ],
      ...audit,
    });
  }
}

// Cobro: Caja y bancos (debe) / CxC (haber)
export async function postearCobro(
  tx: Tx,
  datos: { numeroFactura: string; monto: number; fecha?: Date },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "COBRO",
    glosa: `Cobranza factura ${datos.numeroFactura}`,
    referencia: datos.numeroFactura,
    fecha: datos.fecha,
    lineas: [
      { clave: "CAJA_BANCOS", debe: datos.monto },
      { clave: "CUENTAS_POR_COBRAR", haber: datos.monto },
    ],
    ...audit,
  });
}

// Nota de crédito: Devoluciones + IGV (debe) / CxC (haber)
export async function postearNotaCredito(
  tx: Tx,
  datos: { numeroNC: string; numeroFactura: string; montoBase: number; montoIgv: number; montoTotal: number },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "NOTA_CREDITO",
    glosa: `Nota de crédito ${datos.numeroNC} sobre factura ${datos.numeroFactura}`,
    referencia: datos.numeroNC,
    lineas: [
      { clave: "DEVOLUCIONES", debe: datos.montoBase },
      { clave: "IGV_POR_PAGAR", debe: datos.montoIgv },
      { clave: "CUENTAS_POR_COBRAR", haber: datos.montoTotal },
    ],
    ...audit,
  });
}

// Anulación de factura: reverso completo de la venta (y del costo si lo hubo)
export async function postearAnulacionFactura(
  tx: Tx,
  datos: {
    numeroFactura: string;
    subtotal: number;
    igv: number;
    total: number;
    costoVentas: number;
    motivo: string;
  },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "ANULACION_VENTA",
    glosa: `Anulación factura ${datos.numeroFactura}: ${datos.motivo}`,
    referencia: datos.numeroFactura,
    lineas: [
      { clave: "VENTAS", debe: datos.subtotal },
      { clave: "IGV_POR_PAGAR", debe: datos.igv },
      { clave: "CUENTAS_POR_COBRAR", haber: datos.total },
    ],
    ...audit,
  });

  if (datos.costoVentas > 0) {
    await postearAsiento(tx, {
      origen: "ANULACION_VENTA",
      glosa: `Reverso costo de venta por anulación de factura ${datos.numeroFactura}`,
      referencia: datos.numeroFactura,
      lineas: [
        { clave: "INVENTARIO_PT", debe: datos.costoVentas },
        { clave: "COSTO_VENTAS", haber: datos.costoVentas },
      ],
      ...audit,
    });
  }
}

// Recepción de compra: Inventario de insumos (debe) / CxP (haber)
export async function postearRecepcionCompra(
  tx: Tx,
  datos: {
    numeroRecepcion: string;
    documentoProveedor: string;
    proveedor: string;
    total: number;
    fecha?: Date;
  },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "COMPRA",
    glosa: `Compra según ${datos.documentoProveedor} — ${datos.proveedor} (${datos.numeroRecepcion})`,
    referencia: datos.documentoProveedor,
    fecha: datos.fecha,
    lineas: [
      { clave: "INVENTARIO_INSUMOS", debe: datos.total },
      { clave: "CUENTAS_POR_PAGAR", haber: datos.total },
    ],
    ...audit,
  });
}

// Pago a proveedor: CxP (debe) / Caja y bancos (haber)
export async function postearPagoProveedor(
  tx: Tx,
  datos: { documentoProveedor: string; proveedor: string; monto: number },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "PAGO_PROVEEDOR",
    glosa: `Pago a ${datos.proveedor} (doc. ${datos.documentoProveedor})`,
    referencia: datos.documentoProveedor,
    lineas: [
      { clave: "CUENTAS_POR_PAGAR", debe: datos.monto },
      { clave: "CAJA_BANCOS", haber: datos.monto },
    ],
    ...audit,
  });
}
