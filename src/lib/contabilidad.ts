import type { Tx } from "@/lib/inventario";
import type { $Enums } from "@/generated/prisma/client";
import { reservarCorrelativo } from "@/lib/correlativos";

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
  | "DEVOLUCIONES"
  | "GASTO_DEPRECIACION"
  | "DEPRECIACION_ACUMULADA"
  | "GASTO_MANTENIMIENTO"
  | "ACTIVO_FIJO_BRUTO"
  | "INGRESO_VENTA_ACTIVO"
  | "PERDIDA_VENTA_ACTIVO"
  | "GASTO_PERSONAL"
  | "ONP_AFP_POR_PAGAR"
  | "ESSALUD_POR_PAGAR"
  | "RETENCION_5TA_POR_PAGAR"
  | "SUELDOS_POR_PAGAR"
  | "CTS_POR_PAGAR"
  | "GASTO_ORDEN_INTERNA"
  | "GANANCIA_DIFERENCIA_CAMBIO"
  | "PERDIDA_DIFERENCIA_CAMBIO"
  | "INGRESO_MORA";

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
  GASTO_DEPRECIACION: "Gasto por depreciación",
  DEPRECIACION_ACUMULADA: "Depreciación acumulada (activo contra cuenta)",
  GASTO_MANTENIMIENTO: "Gasto de mantenimiento y reparaciones",
  ACTIVO_FIJO_BRUTO: "Inmuebles, maquinaria y equipo (costo bruto)",
  INGRESO_VENTA_ACTIVO: "Ingreso por venta de activo fijo",
  PERDIDA_VENTA_ACTIVO: "Pérdida por venta de activo fijo",
  GASTO_PERSONAL: "Gasto de personal (planilla)",
  ONP_AFP_POR_PAGAR: "ONP / AFP por pagar",
  ESSALUD_POR_PAGAR: "EsSalud por pagar",
  RETENCION_5TA_POR_PAGAR: "Retención de renta de 5ta categoría por pagar",
  SUELDOS_POR_PAGAR: "Sueldos por pagar (neto)",
  CTS_POR_PAGAR: "CTS por depositar",
  GASTO_ORDEN_INTERNA: "Gasto de orden interna (campaña, evento, proyecto puntual)",
  GANANCIA_DIFERENCIA_CAMBIO: "Ganancia por diferencia de cambio",
  PERDIDA_DIFERENCIA_CAMBIO: "Pérdida por diferencia de cambio",
  INGRESO_MORA: "Ingresos financieros por mora",
};

type LineaAsiento = {
  clave: ClaveControl;
  glosa?: string;
  debe?: number;
  haber?: number;
  // Centro de costo ya conocido en origen (ej. el del equipo o activo fijo de
  // la transacción): tiene prioridad sobre el CentroCostoControl de la clave.
  centroCostoId?: string | null;
};

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
  await reservarCorrelativo(tx);
  const ultimo = await tx.asientoContable.findFirst({ orderBy: { numero: "desc" } });
  const n = ultimo ? parseInt(ultimo.numero.slice(3), 10) + 1 : 1;
  return `AS-${String(n).padStart(5, "0")}`;
}

async function libroDiario(tx: Tx) {
  const libro = await tx.libro.findFirst({ where: { codigo: "DIARIO" } });
  if (libro) return libro;
  return tx.libro.create({ data: { codigo: "DIARIO", nombre: "Libro diario" } });
}

export async function reclamarPeriodoAbierto(tx: Tx, fecha: Date): Promise<boolean> {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  const periodo = await tx.periodoFiscal.findUnique({
    where: { empresaId_anio_mes: { empresaId: "1", anio, mes } },
    select: { id: true, estado: true },
  });
  if (!periodo) return true;
  if (periodo.estado === "CERRADO") return false;

  const reclamo = await tx.periodoFiscal.updateMany({
    where: { id: periodo.id, estado: "ABIERTO" },
    data: { estado: "ABIERTO" },
  });
  return reclamo.count === 1;
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

  // La escritura condicional serializa el posteo contra el cierre del período.
  if (!(await reclamarPeriodoAbierto(tx, fecha))) {
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
      clave: l.clave,
      cuentaId: cuentaPorClave.get(l.clave)!,
      glosa: l.glosa ?? null,
      debe: r2(l.debe ?? 0),
      haber: r2(l.haber ?? 0),
      centroCostoId: l.centroCostoId ?? null,
    }))
    .filter((l) => l.debe > 0 || l.haber > 0);

  if (lineas.length < 2) return { ok: false, motivo: "Asiento con menos de dos líneas" };

  const totalDebe = r2(lineas.reduce((acc, l) => acc + l.debe, 0));
  const totalHaber = r2(lineas.reduce((acc, l) => acc + l.haber, 0));
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

  // Dimensión de centro de costo (best-effort: si una clave no tiene control
  // de centro configurado, esa línea se postea igual sin centro). Si el
  // control apunta a una regla de prorrateo, esta línea se reparte en varias
  // AsientoDetalle según el % de cada centro de la regla.
  const controlesCosto = await tx.centroCostoControl.findMany({
    where: { clave: { in: claves } },
    include: { regla: { include: { lineas: true } } },
  });
  const controlCostoPorClave = new Map(controlesCosto.map((c) => [c.clave, c]));

  const detallesFinales: {
    cuentaId: string;
    centroCostoId: string | null;
    glosa: string | null;
    debe: number;
    haber: number;
  }[] = [];

  for (const l of lineas) {
    const control = controlCostoPorClave.get(l.clave);
    if (l.centroCostoId) {
      detallesFinales.push({
        cuentaId: l.cuentaId,
        centroCostoId: l.centroCostoId,
        glosa: l.glosa,
        debe: l.debe,
        haber: l.haber,
      });
    } else if (control?.centroCostoId) {
      detallesFinales.push({
        cuentaId: l.cuentaId,
        centroCostoId: control.centroCostoId,
        glosa: l.glosa,
        debe: l.debe,
        haber: l.haber,
      });
    } else if (control?.regla && control.regla.lineas.length > 0) {
      const totalPct = control.regla.lineas.reduce((acc, rl) => acc + rl.porcentaje.toNumber(), 0);
      let debeRepartido = 0;
      let haberRepartido = 0;
      control.regla.lineas.forEach((rl, i) => {
        const esUltima = i === control.regla!.lineas.length - 1;
        const pct = rl.porcentaje.toNumber() / (totalPct || 100);
        const debe = esUltima ? r2(l.debe - debeRepartido) : r2(l.debe * pct);
        const haber = esUltima ? r2(l.haber - haberRepartido) : r2(l.haber * pct);
        debeRepartido = r2(debeRepartido + debe);
        haberRepartido = r2(haberRepartido + haber);
        if (debe > 0 || haber > 0) {
          detallesFinales.push({
            cuentaId: l.cuentaId,
            centroCostoId: rl.centroCostoId,
            glosa: l.glosa,
            debe,
            haber,
          });
        }
      });
    } else {
      detallesFinales.push({
        cuentaId: l.cuentaId,
        centroCostoId: null,
        glosa: l.glosa,
        debe: l.debe,
        haber: l.haber,
      });
    }
  }

  // Control de disponibilidad presupuestal (AVC): si el centro de costo tiene
  // presupuesto cargado para el período, un incremento de gasto que supere
  // el presupuesto bloquea la contabilización de todo el asiento (igual
  // patrón "best-effort" que el resto del motor — la operación comercial de
  // origen no se revierte, solo queda sin asiento; el contador la revisa).
  // Si no hay presupuesto cargado para ese centro/período, no se valida.
  const netoPorCentro = new Map<string, number>();
  for (const d of detallesFinales) {
    if (!d.centroCostoId) continue;
    netoPorCentro.set(d.centroCostoId, (netoPorCentro.get(d.centroCostoId) ?? 0) + (d.debe - d.haber));
  }
  for (const [centroCostoId, netoNuevo] of netoPorCentro) {
    if (netoNuevo <= 0) continue; // solo bloquea incrementos de gasto, no reversiones/créditos
    const presupuesto = await tx.presupuestoCentroCosto.findUnique({
      where: { centroCostoId_anio_mes: { centroCostoId, anio, mes } },
    });
    if (!presupuesto) continue;

    const existentes = await tx.asientoDetalle.findMany({
      where: { centroCostoId, asiento: { anio, mes } },
      select: { debe: true, haber: true },
    });
    const gastoActual = existentes.reduce((acc, d) => acc + d.debe.toNumber() - d.haber.toNumber(), 0);
    const gastoTotal = r2(gastoActual + netoNuevo);
    const presupuestado = presupuesto.montoPresupuestado.toNumber();
    if (gastoTotal > presupuestado) {
      const centro = await tx.centroCosto.findUnique({ where: { id: centroCostoId } });
      return {
        ok: false,
        motivo: `Presupuesto excedido en centro de costo ${centro?.codigo ?? centroCostoId} (${mes}/${anio}): gasto acumulado S/ ${gastoTotal.toFixed(2)} superaría el presupuesto de S/ ${presupuestado.toFixed(2)}`,
      };
    }
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
      detalles: { create: detallesFinales },
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

// Salida de mercancías (PGI): el costo y el inventario se reconocen cuando
// el producto abandona físicamente el almacén, no cuando se emite la factura.
export async function postearSalidaMercancia(
  tx: Tx,
  datos: { numeroGuia: string; pedido: string; costoTotal: number; fecha?: Date },
  audit: Auditoria
) {
  if (datos.costoTotal <= 0) return;
  await postearAsiento(tx, {
    origen: "SALIDA_MERCANCIA",
    glosa: `Salida de mercancías guía ${datos.numeroGuia} — pedido ${datos.pedido}`,
    referencia: datos.numeroGuia,
    fecha: datos.fecha,
    lineas: [
      { clave: "COSTO_VENTAS", debe: datos.costoTotal },
      { clave: "INVENTARIO_PT", haber: datos.costoTotal },
    ],
    ...audit,
  });
}
// Cobro: Caja y bancos (debe) / CxC (haber)
export async function postearCobro(
  tx: Tx,
  datos: {
    numeroFactura: string;
    monto?: number;
    montoCaja?: number;
    montoCxc?: number;
    diferenciaCambio?: number;
    fecha?: Date;
  },
  audit: Auditoria
) {
  const montoCaja = datos.montoCaja ?? datos.monto ?? 0;
  const montoCxc = datos.montoCxc ?? datos.monto ?? 0;
  const diferenciaCambio = datos.diferenciaCambio ?? 0;
  await postearAsiento(tx, {
    origen: "COBRO",
    glosa: `Cobranza factura ${datos.numeroFactura}`,
    referencia: datos.numeroFactura,
    fecha: datos.fecha,
    lineas: [
      { clave: "CAJA_BANCOS", debe: montoCaja },
      { clave: "CUENTAS_POR_COBRAR", haber: montoCxc },
      ...(diferenciaCambio > 0
        ? [{ clave: "GANANCIA_DIFERENCIA_CAMBIO" as const, haber: diferenciaCambio }]
        : diferenciaCambio < 0
          ? [{ clave: "PERDIDA_DIFERENCIA_CAMBIO" as const, debe: -diferenciaCambio }]
          : []),
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

// Recargo por mora: CxC (debe) / ingreso financiero (haber), en moneda funcional.
export async function postearRecargoMora(
  tx: Tx,
  datos: { numeroFactura: string; montoFuncional: number; fecha?: Date },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "RECARGO_MORA",
    glosa: `Recargo por mora factura ${datos.numeroFactura}`,
    referencia: datos.numeroFactura,
    fecha: datos.fecha,
    lineas: [
      { clave: "CUENTAS_POR_COBRAR", debe: datos.montoFuncional },
      { clave: "INGRESO_MORA", haber: datos.montoFuncional },
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

// Devolución de insumo a proveedor: reverso de la compra — CxP (debe) /
// Inventario de insumos (haber). Si la CxP asociada ya no tiene saldo
// suficiente para absorber el crédito completo, esto igual se postea (el
// crédito remanente queda como diferencia a favor de XXOil frente al
// proveedor, a coordinar fuera del sistema — no bloquea la devolución física).
export async function postearDevolucionCompra(
  tx: Tx,
  datos: { insumo: string; proveedor: string; cantidad: number; monto: number },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "DEVOLUCION_COMPRA",
    glosa: `Devolución a ${datos.proveedor}: ${datos.insumo} (${datos.cantidad})`,
    lineas: [
      { clave: "CUENTAS_POR_PAGAR", debe: datos.monto },
      { clave: "INVENTARIO_INSUMOS", haber: datos.monto },
    ],
    ...audit,
  });
}

// Depreciación del mes: un solo asiento consolidado por el total de todos
// los activos depreciados ese mes (Gasto por depreciación / Depreciación
// acumulada), en vez de un asiento por activo. El gasto se abre en una línea
// por centro de costo (el de cada activo); la acumulada, al ser una cuenta de
// balance, no lleva centro.
export async function postearDepreciacion(
  tx: Tx,
  datos: {
    mes: number;
    anio: number;
    monto: number;
    porCentro?: { centroCostoId: string | null; monto: number }[];
  },
  audit: Auditoria
) {
  const gruposGasto =
    datos.porCentro && datos.porCentro.length > 0
      ? datos.porCentro
      : [{ centroCostoId: null, monto: datos.monto }];

  await postearAsiento(tx, {
    origen: "DEPRECIACION",
    glosa: `Depreciación del período ${String(datos.mes).padStart(2, "0")}/${datos.anio}`,
    referencia: `DEP-${datos.anio}-${String(datos.mes).padStart(2, "0")}`,
    fecha: new Date(datos.anio, datos.mes - 1, 1),
    lineas: [
      ...gruposGasto.map((g) => ({
        clave: "GASTO_DEPRECIACION" as const,
        debe: g.monto,
        centroCostoId: g.centroCostoId,
      })),
      { clave: "DEPRECIACION_ACUMULADA", haber: datos.monto },
    ],
    ...audit,
  });
}

// Venta de un activo fijo usado: retira el costo bruto y su depreciación
// acumulada de los libros, registra el ingreso de caja (con IGV incluido, ya
// que es lo que efectivamente cobra la empresa) y postea la diferencia entre
// el precio de venta SIN IGV y el valor en libros como utilidad (haber) o
// pérdida (debe) — la utilidad/pérdida nunca incluye el IGV, que es de
// terceros (SUNAT), no un resultado de la empresa.
export async function postearVentaActivoFijo(
  tx: Tx,
  datos: {
    codigoActivo: string;
    nombreActivo: string;
    costoAdquisicion: number;
    depreciacionAcumulada: number;
    montoBase: number;
    montoIgv: number;
    centroCostoId?: string | null;
    fecha?: Date;
  },
  audit: Auditoria
) {
  const valorEnLibros = datos.costoAdquisicion - datos.depreciacionAcumulada;
  const resultado = datos.montoBase - valorEnLibros;
  const precioVenta = datos.montoBase + datos.montoIgv;

  await postearAsiento(tx, {
    origen: "VENTA_ACTIVO_FIJO",
    glosa: `Venta del activo ${datos.codigoActivo} — ${datos.nombreActivo}`,
    referencia: datos.codigoActivo,
    fecha: datos.fecha,
    lineas: [
      { clave: "CAJA_BANCOS", debe: precioVenta },
      { clave: "DEPRECIACION_ACUMULADA", debe: datos.depreciacionAcumulada },
      { clave: "ACTIVO_FIJO_BRUTO", haber: datos.costoAdquisicion },
      { clave: "IGV_POR_PAGAR", haber: datos.montoIgv },
      ...(resultado > 0
        ? [{ clave: "INGRESO_VENTA_ACTIVO" as const, haber: resultado, centroCostoId: datos.centroCostoId }]
        : resultado < 0
          ? [{ clave: "PERDIDA_VENTA_ACTIVO" as const, debe: -resultado, centroCostoId: datos.centroCostoId }]
          : []),
    ],
    ...audit,
  });
}

// Mantenimiento completado con costo: Gasto de mantenimiento (debe) / Caja y
// bancos (haber). Se asume pagado al contado (mano de obra + repuestos), igual
// que el resto de gastos operativos menores de este ERP.
export async function postearMantenimiento(
  tx: Tx,
  datos: {
    codigoOrden: string;
    equipo: string;
    monto: number;
    centroCostoId?: string | null;
    fecha?: Date;
  },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "MANTENIMIENTO",
    glosa: `Mantenimiento ${datos.codigoOrden} — ${datos.equipo}`,
    referencia: datos.codigoOrden,
    fecha: datos.fecha,
    lineas: [
      { clave: "GASTO_MANTENIMIENTO", debe: datos.monto, centroCostoId: datos.centroCostoId },
      { clave: "CAJA_BANCOS", haber: datos.monto },
    ],
    ...audit,
  });
}

// Liquidación de orden interna: todo lo acumulado en OrdenInternaCosto se
// contabiliza de una sola vez, igual que el mantenimiento (se asume pagado al
// contado). El centro de costo de destino se confirma recién acá, no al crear
// la orden.
export async function postearOrdenInterna(
  tx: Tx,
  datos: {
    codigoOrden: string;
    descripcion: string;
    monto: number;
    centroCostoId: string;
    fecha?: Date;
  },
  audit: Auditoria
) {
  await postearAsiento(tx, {
    origen: "ORDEN_INTERNA",
    glosa: `Liquidación orden interna ${datos.codigoOrden} — ${datos.descripcion}`,
    referencia: datos.codigoOrden,
    fecha: datos.fecha,
    lineas: [
      { clave: "GASTO_ORDEN_INTERNA", debe: datos.monto, centroCostoId: datos.centroCostoId },
      { clave: "CAJA_BANCOS", haber: datos.monto },
    ],
    ...audit,
  });
}

// Claves de gasto/costo que tiene sentido reclasificar entre centros de
// costo (dimensión de gestión, no cambia el resultado ni la cuenta contable
// — solo a qué área se le atribuye).
export const CLAVES_RECLASIFICABLES: ClaveControl[] = [
  "GASTO_MANTENIMIENTO",
  "GASTO_ORDEN_INTERNA",
  "GASTO_PERSONAL",
  "GASTO_DEPRECIACION",
  "COSTO_VENTAS",
];

// Reclasificación de costo entre centros: los asientos nunca se editan, así
// que mover un gasto ya contabilizado de un centro a otro es un asiento
// nuevo con dos líneas en la MISMA cuenta (la clave no cambia) — debe en el
// centro destino, haber en el centro origen. El neto de la cuenta no se
// mueve (sigue siendo el mismo gasto del período), pero el neto por centro
// de costo sí, incluido para efectos de AVC.
export async function postearReclasificacionCosto(
  tx: Tx,
  datos: {
    clave: ClaveControl;
    monto: number;
    centroOrigenId: string;
    centroDestinoId: string;
    motivo: string;
    fecha?: Date;
  },
  audit: Auditoria
) {
  return postearAsiento(tx, {
    origen: "RECLASIFICACION_COSTO",
    glosa: `Reclasificación de costo — ${datos.motivo}`,
    fecha: datos.fecha,
    lineas: [
      { clave: datos.clave, glosa: "Entra al centro destino", debe: datos.monto, centroCostoId: datos.centroDestinoId },
      { clave: datos.clave, glosa: "Sale del centro origen", haber: datos.monto, centroCostoId: datos.centroOrigenId },
    ],
    ...audit,
  });
}

// Planilla mensual: Gasto de personal (remuneración computable + EsSalud
// patronal, por centro de costo del empleado) al debe / ONP-AFP por pagar +
// EsSalud por pagar + retención de 5ta por pagar + sueldos por pagar (neto)
// al haber. Se arma un solo asiento para todo el período.
export async function postearPlanilla(
  tx: Tx,
  datos: {
    periodo: string; // "2026-08"
    lineas: {
      empleado: string;
      centroCostoId: string | null;
      remuneracionComputable: number;
      essaludPatronal: number;
      descuentoPension: number;
      retencion5ta: number;
      neto: number;
    }[];
    fecha?: Date;
  },
  audit: Auditoria
) {
  const lineas: Parameters<typeof postearAsiento>[1]["lineas"] = [];
  let totalPension = 0;
  let totalEssalud = 0;
  let totalRetencion = 0;
  let totalNeto = 0;

  for (const l of datos.lineas) {
    lineas.push({
      clave: "GASTO_PERSONAL",
      glosa: l.empleado,
      debe: l.remuneracionComputable,
      centroCostoId: l.centroCostoId,
    });
    if (l.essaludPatronal > 0) {
      lineas.push({
        clave: "GASTO_PERSONAL",
        glosa: `EsSalud — ${l.empleado}`,
        debe: l.essaludPatronal,
        centroCostoId: l.centroCostoId,
      });
    }
    totalPension += l.descuentoPension;
    totalEssalud += l.essaludPatronal;
    totalRetencion += l.retencion5ta;
    totalNeto += l.neto;
  }

  if (totalPension > 0) lineas.push({ clave: "ONP_AFP_POR_PAGAR", haber: totalPension });
  if (totalEssalud > 0) lineas.push({ clave: "ESSALUD_POR_PAGAR", haber: totalEssalud });
  if (totalRetencion > 0) lineas.push({ clave: "RETENCION_5TA_POR_PAGAR", haber: totalRetencion });
  if (totalNeto > 0) lineas.push({ clave: "SUELDOS_POR_PAGAR", haber: totalNeto });

  return postearAsiento(tx, {
    origen: "PLANILLA",
    glosa: `Planilla ${datos.periodo}`,
    referencia: datos.periodo,
    fecha: datos.fecha,
    lineas,
    ...audit,
  });
}

// Gratificación (julio/diciembre): Gasto de personal (monto base + bono Ley
// 30334) al debe / Sueldos por pagar al haber. Inafecta a ONP/AFP/EsSalud —
// no hay líneas de descuento.
export async function postearGratificacion(
  tx: Tx,
  datos: {
    periodo: string;
    lineas: { empleado: string; centroCostoId: string | null; montoBase: number; bono: number }[];
    fecha?: Date;
  },
  audit: Auditoria
) {
  const lineas: Parameters<typeof postearAsiento>[1]["lineas"] = [];
  let totalNeto = 0;
  for (const l of datos.lineas) {
    lineas.push({ clave: "GASTO_PERSONAL", glosa: l.empleado, debe: l.montoBase, centroCostoId: l.centroCostoId });
    if (l.bono > 0) {
      lineas.push({
        clave: "GASTO_PERSONAL",
        glosa: `Bono Ley 30334 — ${l.empleado}`,
        debe: l.bono,
        centroCostoId: l.centroCostoId,
      });
    }
    totalNeto += l.montoBase + l.bono;
  }
  if (totalNeto > 0) lineas.push({ clave: "SUELDOS_POR_PAGAR", haber: totalNeto });

  return postearAsiento(tx, {
    origen: "GRATIFICACION",
    glosa: `Gratificación ${datos.periodo}`,
    referencia: datos.periodo,
    fecha: datos.fecha,
    lineas,
    ...audit,
  });
}

// CTS (mayo/noviembre): Gasto de personal (debe) / CTS por depositar (haber)
// — no se paga en efectivo, es una obligación de depósito a la cuenta CTS
// del trabajador. Inafecta a ONP/AFP/EsSalud/5ta categoría.
export async function postearCts(
  tx: Tx,
  datos: {
    periodo: string;
    lineas: { empleado: string; centroCostoId: string | null; monto: number }[];
    fecha?: Date;
  },
  audit: Auditoria
) {
  const lineas: Parameters<typeof postearAsiento>[1]["lineas"] = [];
  let total = 0;
  for (const l of datos.lineas) {
    lineas.push({ clave: "GASTO_PERSONAL", glosa: l.empleado, debe: l.monto, centroCostoId: l.centroCostoId });
    total += l.monto;
  }
  if (total > 0) lineas.push({ clave: "CTS_POR_PAGAR", haber: total });

  return postearAsiento(tx, {
    origen: "CTS",
    glosa: `CTS ${datos.periodo}`,
    referencia: datos.periodo,
    fecha: datos.fecha,
    lineas,
    ...audit,
  });
}

// Liquidación de desvinculación: CTS truncada (debe Gasto / haber CTS por
// depositar) + gratificación truncada + bono + vacaciones (debe Gasto /
// haber Sueldos por pagar, todo en efectivo).
export async function postearLiquidacion(
  tx: Tx,
  datos: {
    empleado: string;
    centroCostoId: string | null;
    ctsTruncada: number;
    gratificacionTruncada: number;
    bono: number;
    montoVacaciones: number;
    fecha?: Date;
  },
  audit: Auditoria
) {
  const lineas: Parameters<typeof postearAsiento>[1]["lineas"] = [];
  const efectivo = datos.gratificacionTruncada + datos.bono + datos.montoVacaciones;

  if (datos.ctsTruncada > 0) {
    lineas.push({ clave: "GASTO_PERSONAL", glosa: `CTS truncada — ${datos.empleado}`, debe: datos.ctsTruncada, centroCostoId: datos.centroCostoId });
    lineas.push({ clave: "CTS_POR_PAGAR", haber: datos.ctsTruncada });
  }
  if (efectivo > 0) {
    lineas.push({ clave: "GASTO_PERSONAL", glosa: `Gratificación truncada + vacaciones — ${datos.empleado}`, debe: efectivo, centroCostoId: datos.centroCostoId });
    lineas.push({ clave: "SUELDOS_POR_PAGAR", haber: efectivo });
  }

  return postearAsiento(tx, {
    origen: "LIQUIDACION",
    glosa: `Liquidación de desvinculación — ${datos.empleado}`,
    fecha: datos.fecha,
    lineas,
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
