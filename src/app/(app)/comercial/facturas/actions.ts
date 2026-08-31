"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { liberarAsignacionesLote } from "@/lib/trazabilidad";
import { MOTIVO_DEVOLUCION_PREFIJO } from "@/lib/etiquetas";
import { avanzarSerie } from "@/lib/series";
import {
  postearCobro,
  postearNotaCredito,
  postearAnulacionFactura,
} from "@/lib/contabilidad";
import { enviarComprobanteElectronico } from "@/lib/facturacionElectronica";
import { aplicarRecargoAFactura } from "@/lib/recargoMora";
import { CODIGO_TIPO_NOTA_CREDITO } from "@/lib/catalogosSunat";
import {
  calcularAplicacionCobro,
  calcularImportesFuncionales,
  validarTipoCambio,
} from "@/lib/multimoneda";

export type EstadoFormulario = { error?: string };

// Arma los datos SUNAT de una factura ya creada y la envía al OSE configurado
// (best-effort: nunca lanza). Se usa tanto al facturar un pedido como desde
// el botón "Reenviar a SUNAT" en la ficha de la factura.
export async function enviarComprobanteFactura(facturaId: string): Promise<void> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) throw new Error(auth.error);
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    throw new Error("Su grupo de seguridad no permite editar registros en Ventas.");
  }

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cliente: true,
      detalles: { include: { presentacion: true } },
    },
  });
  if (!factura) return;

  const [serie, numeroStr] = factura.numero.split("-");
  const numero = parseInt(numeroStr ?? "", 10);

  await enviarComprobanteElectronico({
    tipoDocumento: "FACTURA",
    documentoId: factura.id,
    numeroDocumento: factura.numero,
    datos: {
      tipoDocumento: "FACTURA",
      serie: serie || factura.numero,
      numero: Number.isFinite(numero) ? numero : 0,
      clienteRuc: factura.cliente.ruc ?? "",
      clienteDenominacion: factura.cliente.razonSocial,
      clienteDireccion: factura.cliente.direccion,
      fechaEmision: factura.fechaEmision,
      moneda: factura.moneda,
      totalGravada: factura.subtotal.toNumber(),
      totalIgv: factura.igv.toNumber(),
      total: factura.total.toNumber(),
      tasaIgv: factura.tasaIgv.toNumber(),
      items: factura.detalles.map((d) => ({
        descripcion: d.presentacion.nombre,
        unidadMedida: d.presentacion.unidadMedidaSunat,
        cantidad: d.cantidad,
        valorUnitario: d.precioUnitario.toNumber(),
      })),
    },
  });
}

// Arma los datos SUNAT de una nota de crédito ya creada y la envía al OSE.
// A diferencia de la versión anterior, usa las líneas reales de la factura
// afectada (NotaCreditoDetalle) — no un ítem fabricado a partir del motivo.
export async function enviarComprobanteNotaCredito(notaCreditoId: string): Promise<void> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) throw new Error(auth.error);
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    throw new Error("Su grupo de seguridad no permite editar registros en Ventas.");
  }

  const nc = await prisma.notaCredito.findUnique({
    where: { id: notaCreditoId },
    include: {
      factura: { include: { cliente: true } },
      detalles: { include: { pedidoDetalle: { include: { presentacion: true } } } },
    },
  });
  if (!nc) return;

  const [serie, numeroStr] = nc.numero.split("-");
  const numero = parseInt(numeroStr ?? "", 10);
  const [facturaSerie, facturaNumeroStr] = nc.factura.numero.split("-");

  const montoBase = nc.monto.toNumber() / (1 + nc.factura.tasaIgv.toNumber() / 100);
  const montoIgv = nc.monto.toNumber() - montoBase;

  await enviarComprobanteElectronico({
    tipoDocumento: "NOTA_CREDITO",
    documentoId: nc.id,
    numeroDocumento: nc.numero,
    datos: {
      tipoDocumento: "NOTA_CREDITO",
      serie: serie || nc.numero,
      numero: Number.isFinite(numero) ? numero : 0,
      clienteRuc: nc.factura.cliente.ruc ?? "",
      clienteDenominacion: nc.factura.cliente.razonSocial,
      clienteDireccion: nc.factura.cliente.direccion,
      fechaEmision: nc.fecha,
      moneda: nc.factura.moneda,
      totalGravada: montoBase,
      totalIgv: montoIgv,
      total: nc.monto.toNumber(),
      tasaIgv: nc.factura.tasaIgv.toNumber(),
      items: nc.detalles.map((d) => ({
        descripcion: d.pedidoDetalle.presentacion.nombre,
        unidadMedida: d.pedidoDetalle.presentacion.unidadMedidaSunat,
        cantidad: d.cantidad.toNumber(),
        valorUnitario: d.precioUnitario.toNumber(),
      })),
      facturaAfectadaSerie: facturaSerie || nc.factura.numero,
      facturaAfectadaNumero: facturaNumeroStr || "",
      motivo: nc.motivo,
      tipoNota: CODIGO_TIPO_NOTA_CREDITO[nc.tipoNota],
    },
  });
}

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

export async function registrarCobro(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const monto = Number(formData.get("monto"));
  const tipoCambioIngresado = Number(formData.get("tipoCambio") ?? 1);
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto debe ser mayor a 0." };
  }
  if (!MEDIOS_VALIDOS.includes(medioPago)) {
    return { error: "Seleccione el medio de pago." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({ where: { id: facturaId } });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const saldo = factura.saldo.toNumber();
      if (monto > saldo + 1e-9) {
        throw new Error(`El monto supera el saldo pendiente (${saldo.toFixed(2)} ${factura.moneda}).`);
      }
      const tipoCambio = factura.moneda === "PEN" ? 1 : tipoCambioIngresado;
      if (!validarTipoCambio(factura.moneda, tipoCambio)) {
        throw new Error("Ingrese un tipo de cambio de cobranza válido.");
      }
      const aplicacion = calcularAplicacionCobro({
        moneda: factura.moneda,
        montoDocumento: monto,
        saldoDocumento: saldo,
        saldoFuncional: factura.saldoFuncional.toNumber(),
        tipoCambioCobro: tipoCambio,
      });

      const reclamo = await tx.factura.updateMany({
        where: { id: facturaId, estado: factura.estado, saldo: factura.saldo, saldoFuncional: factura.saldoFuncional },
        data: {
          saldo: aplicacion.nuevoSaldoDocumento,
          saldoFuncional: aplicacion.nuevoSaldoFuncional,
          estado: aplicacion.nuevoSaldoDocumento <= 1e-9 ? "PAGADA" : "PENDIENTE",
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("La factura cambió mientras se registraba el cobro. Revise el saldo e intente nuevamente.");
      }

      await tx.cobro.create({
        data: {
          empresaId: factura.empresaId,
          facturaId,
          monto,
          moneda: factura.moneda,
          tipoCambio,
          montoFuncional: aplicacion.montoFuncional,
          cxcFuncionalAplicada: aplicacion.cxcFuncionalAplicada,
          diferenciaCambio: aplicacion.diferenciaCambio,
          medioPago,
          referencia,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Ingreso automático en el libro de caja
      await tx.movimientoCaja.create({
        data: {
          tipo: "INGRESO",
          empresaId: factura.empresaId,
          concepto: `Cobro factura ${factura.numero}`,
          monto: aplicacion.montoFuncional,
          moneda: factura.moneda,
          tipoCambio,
          montoOriginal: monto,
          medioPago,
          referencia: factura.numero,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      await postearCobro(
        tx,
        {
          numeroFactura: factura.numero,
          montoCaja: aplicacion.montoFuncional,
          montoCxc: aplicacion.cxcFuncionalAplicada,
          diferenciaCambio: aplicacion.diferenciaCambio,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/finanzas/caja");
  return {};
}

const TIPOS_NOTA_VALIDOS: $Enums.TipoNotaCredito[] = [
  "ANULACION_OPERACION",
  "ANULACION_ERROR_RUC",
  "CORRECCION_DESCRIPCION",
  "DESCUENTO_GLOBAL",
  "DESCUENTO_ITEM",
  "DEVOLUCION_TOTAL",
  "DEVOLUCION_ITEM",
  "BONIFICACION",
  "DISMINUCION_VALOR",
  "OTROS_CONCEPTOS",
];

type LineaNotaCredito = { pedidoDetalleId: string; cantidad: number };

// Nota de crédito: reduce el saldo de la factura y revierte la comisión
// en forma proporcional con un registro nuevo (nunca se edita la original).
// Cita líneas reales de la factura afectada (NotaCreditoDetalle) — el monto
// y el IGV se calculan a partir de ellas, no se ingresan sueltos.
export async function crearNotaCredito(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const tipoNota = String(formData.get("tipoNota") ?? "") as $Enums.TipoNotaCredito;
  const serieId = String(formData.get("serieId") ?? "") || null;

  if (!numero) return { error: "Ingrese el número de la nota de crédito (SUNAT)." };
  if (!motivo) return { error: "El motivo es obligatorio." };
  if (!TIPOS_NOTA_VALIDOS.includes(tipoNota)) {
    return { error: "Seleccione el tipo de nota de crédito (Catálogo 9 SUNAT)." };
  }

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la nota de crédito es inválido." };
  }
  if (!Array.isArray(lineasRaw)) {
    return { error: "El detalle de la nota de crédito es inválido." };
  }

  const cantidadesPorDetalle = new Map<string, number>();
  for (const linea of lineasRaw) {
    if (
      typeof linea !== "object" ||
      linea === null ||
      !("pedidoDetalleId" in linea) ||
      !("cantidad" in linea) ||
      typeof linea.pedidoDetalleId !== "string" ||
      typeof linea.cantidad !== "number" ||
      !linea.pedidoDetalleId ||
      !Number.isFinite(linea.cantidad) ||
      linea.cantidad <= 0
    ) {
      continue;
    }
    cantidadesPorDetalle.set(
      linea.pedidoDetalleId,
      (cantidadesPorDetalle.get(linea.pedidoDetalleId) ?? 0) + linea.cantidad
    );
  }
  const lineas: LineaNotaCredito[] = [...cantidadesPorDetalle].map(
    ([pedidoDetalleId, cantidad]) => ({ pedidoDetalleId, cantidad })
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad válida." };
  }

  let notaCreditoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const bloqueo = await tx.factura.updateMany({
        where: { id: facturaId },
        data: { saldo: { increment: 0 } },
      });
      if (bloqueo.count !== 1) throw new Error("La factura no existe.");

      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: { notasCredito: true, comisiones: true, detalles: true },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");
      const detallesPorId = new Map(factura.detalles.map((d) => [d.pedidoDetalleId, d]));
      const notasPrevias = await tx.notaCreditoDetalle.findMany({
        where: { notaCredito: { facturaId } },
      });
      const yaAcreditado = new Map<string, number>();
      for (const nd of notasPrevias) {
        yaAcreditado.set(
          nd.pedidoDetalleId,
          (yaAcreditado.get(nd.pedidoDetalleId) ?? 0) + nd.cantidad.toNumber()
        );
      }

      let montoBase = 0;
      const detallesNC: {
        pedidoDetalleId: string;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
      }[] = [];
      for (const l of lineas) {
        const detalle = detallesPorId.get(l.pedidoDetalleId);
        if (!detalle) throw new Error("Una de las líneas seleccionadas no pertenece a esta factura.");
        const disponible = detalle.cantidad - (yaAcreditado.get(l.pedidoDetalleId) ?? 0);
        if (l.cantidad > disponible) {
          throw new Error(
            `Solo puede acreditar hasta ${disponible} unidad(es) de esa línea (ya se acreditó ${
              yaAcreditado.get(l.pedidoDetalleId) ?? 0
            } de ${detalle.cantidad}).`
          );
        }
        const precioUnitario = detalle.precioUnitario.toNumber();
        const subtotal = l.cantidad * precioUnitario;
        montoBase += subtotal;
        detallesNC.push({ pedidoDetalleId: l.pedidoDetalleId, cantidad: l.cantidad, precioUnitario, subtotal });
      }

      const montoIgv = Math.round(montoBase * factura.tasaIgv.toNumber()) / 100;
      const monto = montoBase + montoIgv;
      const importesFuncionales = calcularImportesFuncionales({
        moneda: factura.moneda,
        tipoCambio: factura.tipoCambio.toNumber(),
        monedaFuncional: factura.monedaFuncional,
        subtotal: montoBase,
        igv: montoIgv,
        total: monto,
      });

      const totalNC = factura.notasCredito.reduce((acc, nc) => acc + nc.monto.toNumber(), 0);
      const maximo = Math.min(
        factura.total.toNumber() - totalNC,
        factura.saldo.toNumber()
      );
      if (monto > maximo + 1e-9) {
        throw new Error(
          `El monto supera lo disponible para notas de crédito (${maximo.toFixed(2)}).`
        );
      }

      const nc = await tx.notaCredito.create({
        data: {
          numero,
          facturaId,
          monto,
          moneda: factura.moneda,
          tipoCambio: factura.tipoCambio,
          montoFuncional: importesFuncionales.totalFuncional,
          motivo,
          tipoNota,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: { create: detallesNC },
        },
      });
      notaCreditoId = nc.id;

      // El saldo por cobrar baja hasta un mínimo de cero.
      const nuevoSaldo = Math.max(0, factura.saldo.toNumber() - monto);
      const nuevoSaldoFuncional = Math.max(
        0,
        factura.saldoFuncional.toNumber() - importesFuncionales.totalFuncional
      );
      const actualizada = await tx.factura.updateMany({
        where: {
          id: facturaId,
          estado: factura.estado,
          saldo: factura.saldo,
          saldoFuncional: factura.saldoFuncional,
        },
        data: {
          saldo: nuevoSaldo,
          saldoFuncional: nuevoSaldoFuncional,
          estado: nuevoSaldo <= 1e-9 ? "PAGADA" : factura.estado,
        },
      });
      if (actualizada.count !== 1) {
        throw new Error("La factura cambió mientras se registraba la nota de crédito. Intente nuevamente.");
      }

      // Reversión proporcional de la comisión generada, sobre la base
      // imponible real de la NC (ya calculada arriba, no una estimación).
      const generada = factura.comisiones.find((c) => c.tipo === "GENERADA");
      if (generada) {
        const tasa = generada.tasa.toNumber();
        await tx.comision.create({
          data: {
            vendedorId: factura.vendedorId,
            facturaId,
            tipo: "REVERSION",
            tasa,
            monto: -(importesFuncionales.subtotalFuncional * tasa) / 100,
            motivo: `Nota de crédito ${numero}`,
          },
        });
      }

      await avanzarSerie(tx, serieId);

      await postearNotaCredito(
        tx,
        {
          numeroNC: numero,
          numeroFactura: factura.numero,
          montoBase: importesFuncionales.subtotalFuncional,
          montoIgv: importesFuncionales.igvFuncional,
          montoTotal: importesFuncionales.totalFuncional,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una nota de crédito con el número ${numero}.` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  await enviarComprobanteNotaCredito(notaCreditoId);

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/comercial/comisiones");
  return {};
}

// Anular factura: solo sin cobros; reingresa el stock por kardex y revierte
// la comisión completa. Queda registrado quién, cuándo y por qué.
export async function anularFactura(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo de anulación es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: {
          cobros: true,
          comisiones: true,
          notasCredito: true,
          pedido: true,
          detalles: { include: { entregas: { include: { guiaDetalle: true } } } },
        },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura ya está anulada.");
      if (factura.cobros.length > 0) {
        throw new Error("No se puede anular una factura con cobros registrados.");
      }
      if (factura.notasCredito.length > 0) {
        throw new Error("No se puede anular una factura con notas de crédito.");
      }

      const reclamo = await tx.factura.updateMany({
        where: {
          id: facturaId,
          estado: factura.estado,
          saldo: factura.saldo,
          saldoFuncional: factura.saldoFuncional,
          cobros: { none: {} },
          notasCredito: { none: {} },
        },
        data: {
          estado: "ANULADA",
          saldo: 0,
          saldoFuncional: 0,
          motivoAnulacion: motivo,
          anuladaEn: new Date(),
          anuladaPor: auth.usuario.nombre,
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("La factura cambió mientras se anulaba. Actualice la página e intente nuevamente.");
      }

      // Solo las facturas históricas hicieron la salida física al facturar.
      // En el flujo nuevo la entrega sigue vigente y anular la factura reabre
      // únicamente el saldo de facturación, sin duplicar stock ni reservas.
      for (const detalle of factura.detalles) {
        if (detalle.entregas.length > 0) continue;
        const movimiento = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: detalle.presentacionId,
          tipoMovimiento: "ENTRADA",
          origen: "ANULACION_VENTA",
          cantidad: detalle.cantidad,
          motivo,
          referencia: `Anulación factura ${factura.numero}`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!movimiento.ok) throw new Error(movimiento.error);

        await liberarAsignacionesLote(tx, {
          facturaDetalleId: detalle.id,
          pedidoDetalleId: detalle.pedidoDetalleId,
          motivo: `Anulación factura ${factura.numero}`,
        });
        await tx.presentacion.update({
          where: { id: detalle.presentacionId },
          data: { stockReservado: { increment: detalle.cantidad } },
        });
      }
      // Reversión total de la comisión generada
      const generada = factura.comisiones.find((c) => c.tipo === "GENERADA");
      if (generada) {
        await tx.comision.create({
          data: {
            vendedorId: factura.vendedorId,
            facturaId,
            tipo: "REVERSION",
            tasa: generada.tasa,
            monto: -generada.monto.toNumber(),
            motivo: `Anulación de factura: ${motivo}`,
          },
        });
      }


      // Anular un documento parcial reabre únicamente su saldo comercial.
      // El pedido conserva las demás facturas vigentes y vuelve a quedar
      // parcial o pendiente para permitir una nueva entrega/factura.
      const otrasLineasVigentes = await tx.facturaDetalle.count({
        where: {
          factura: { pedidoId: factura.pedidoId, estado: { not: "ANULADA" } },
        },
      });
      await tx.pedido.update({
        where: { id: factura.pedidoId },
        data: {
          estado: otrasLineasVigentes > 0 ? "PARCIAL" : "PENDIENTE",
          fulfillmentVersion: { increment: 1 },
        },
      });

      const costoVentasAnulado = factura.detalles
        .filter((detalle) => detalle.entregas.length === 0)
        .reduce((total, detalle) => total + detalle.cantidad * detalle.costoUnitario.toNumber(), 0);
      await postearAnulacionFactura(
        tx,
        {
          numeroFactura: factura.numero,
          subtotal:
            factura.subtotalFuncional.toNumber() > 0
              ? factura.subtotalFuncional.toNumber()
              : factura.totalFuncional.toNumber(),
          igv: factura.igvFuncional.toNumber(),
          total: factura.totalFuncional.toNumber(),
          costoVentas: costoVentasAnulado,
          motivo,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial/comisiones");
  return {};
}

// Devolución física de mercadería: reingresa stock al kardex y libera la
// asignación de lote correspondiente. A diferencia de la Nota de Crédito
// (que solo ajusta dinero/comisión) y de la Anulación (que revierte TODO),
// esto es una cantidad parcial que no toca el saldo por cobrar — si además
// corresponde devolver dinero, se registra una Nota de Crédito aparte.
export async function registrarDevolucion(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const pedidoDetalleId = String(formData.get("pedidoDetalleId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!pedidoDetalleId) return { error: "Seleccione la línea a devolver." };
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un entero mayor a 0." };
  }
  if (!motivo) return { error: "El motivo es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      // Serializa devoluciones y anulaciones sobre la misma factura antes de
      // calcular el acumulado devuelto. Sin este reclamo, dos solicitudes
      // concurrentes podrían validar contra el mismo saldo y reingresar más
      // unidades de las que se vendieron.
      const bloqueo = await tx.factura.updateMany({
        where: { id: facturaId, estado: { not: "ANULADA" } },
        data: { saldo: { increment: 0 } },
      });
      if (bloqueo.count !== 1) {
        throw new Error("La factura no existe, está anulada o cambió mientras se registraba la devolución.");
      }

      const factura = await tx.factura.findUnique({ where: { id: facturaId } });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const detalle = await tx.facturaDetalle.findUnique({
        where: { facturaId_pedidoDetalleId: { facturaId, pedidoDetalleId } },
        include: { entregas: true },
      });
      if (!detalle) {
        throw new Error("La línea seleccionada no pertenece a esta factura.");
      }

      const liberacionesPrevias = await tx.asignacionLoteVenta.findMany({
        where: { facturaDetalleId: detalle.id, tipo: "LIBERADA", motivo: { startsWith: MOTIVO_DEVOLUCION_PREFIJO } },
      });
      const yaDevuelto = liberacionesPrevias.reduce((acc, l) => acc + l.cantidad, 0);
      const maxDevolvible = detalle.cantidad - yaDevuelto;
      if (cantidad > maxDevolvible) {
        throw new Error(
          `Solo puede devolver hasta ${maxDevolvible} unidad(es) de esta línea (ya se devolvieron ${yaDevuelto} de ${detalle.cantidad}).`
        );
      }

      const mov = await registrarMovimiento(tx, {
        tipoItem: "PRESENTACION",
        presentacionId: detalle.presentacionId,
        tipoMovimiento: "ENTRADA",
        origen: "DEVOLUCION_CLIENTE",
        cantidad,
        motivo,
        referencia: `Devolución factura ${factura.numero}`,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!mov.ok) throw new Error(mov.error);

      const motivoLote = `${MOTIVO_DEVOLUCION_PREFIJO} factura ${factura.numero}: ${motivo}`;
      if (detalle.entregas.length === 0) {
        await liberarAsignacionesLote(tx, {
          facturaDetalleId: detalle.id,
          pedidoDetalleId,
          cantidad,
          motivo: motivoLote,
        });
      } else {
        let restante = cantidad;
        for (const entrega of detalle.entregas) {
          if (restante <= 0) break;
          const devueltoDesdeEntrega = liberacionesPrevias
            .filter((evento) => evento.guiaDetalleId === entrega.guiaDetalleId)
            .reduce((total, evento) => total + evento.cantidad, 0);
          const disponible = entrega.cantidad - devueltoDesdeEntrega;
          if (disponible <= 0) continue;
          const solicitado = Math.min(restante, disponible);
          const liberado = await liberarAsignacionesLote(tx, {
            facturaDetalleId: detalle.id,
            guiaDetalleId: entrega.guiaDetalleId,
            pedidoDetalleId,
            cantidad: solicitado,
            motivo: motivoLote,
          });
          restante -= liberado;
        }
        if (restante > 0) {
          throw new Error("No se pudo identificar el lote físico completo de la devolución.");
        }
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/inventario/kardex");
  return {};
}

// Recargo por mora: solo cubre los días transcurridos desde el último
// recargo aplicado (o desde el vencimiento, si es el primero) — nunca se
// puede duplicar el cobro de los mismos días. Incrementa el saldo por
// cobrar, no el total original de la factura (valor de venta emitido).
export async function aplicarRecargoMora(
  facturaId: string,
  _prevState: EstadoFormulario,
  _formData: FormData
): Promise<EstadoFormulario> {
  void _prevState;
  void _formData;
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  try {
    const resultado = await prisma.$transaction((tx) =>
      aplicarRecargoAFactura(tx, facturaId, {
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      })
    );
    if (!resultado.ok) return { error: resultado.error };
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  return {};
}
