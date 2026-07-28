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

export type EstadoFormulario = { error?: string };

// Arma los datos SUNAT de una factura ya creada y la envía al OSE configurado
// (best-effort: nunca lanza). Se usa tanto al facturar un pedido como desde
// el botón "Reenviar a SUNAT" en la ficha de la factura.
export async function enviarComprobanteFactura(facturaId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cliente: true,
      pedido: { include: { detalles: { include: { presentacion: true } } } },
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
      items: factura.pedido.detalles.map((d) => ({
        descripcion: d.presentacion.nombre,
        unidadMedida: "NIU",
        cantidad: d.cantidad,
        valorUnitario: d.precioUnitario.toNumber(),
      })),
    },
  });
}

// Arma los datos SUNAT de una nota de crédito ya creada y la envía al OSE.
export async function enviarComprobanteNotaCredito(notaCreditoId: string): Promise<void> {
  const nc = await prisma.notaCredito.findUnique({
    where: { id: notaCreditoId },
    include: { factura: { include: { cliente: true } } },
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
      items: [
        {
          descripcion: nc.motivo,
          unidadMedida: "NIU",
          cantidad: 1,
          valorUnitario: montoBase,
        },
      ],
      facturaAfectadaSerie: facturaSerie || nc.factura.numero,
      facturaAfectadaNumero: facturaNumeroStr || "",
      motivo: nc.motivo,
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
        throw new Error(`El monto supera el saldo pendiente (${saldo.toFixed(2)}).`);
      }

      await tx.cobro.create({
        data: {
          facturaId,
          monto,
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
          concepto: `Cobro factura ${factura.numero}`,
          monto,
          medioPago,
          referencia: factura.numero,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      const nuevoSaldo = saldo - monto;
      await tx.factura.update({
        where: { id: facturaId },
        data: {
          saldo: nuevoSaldo,
          estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE",
        },
      });

      await postearCobro(
        tx,
        { numeroFactura: factura.numero, monto },
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

// Nota de crédito: reduce el saldo de la factura y revierte la comisión
// en forma proporcional con un registro nuevo (nunca se edita la original).
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
  const monto = Number(formData.get("monto"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const serieId = String(formData.get("serieId") ?? "") || null;

  if (!numero) return { error: "Ingrese el número de la nota de crédito (SUNAT)." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!motivo) return { error: "El motivo es obligatorio." };

  let notaCreditoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: { notasCredito: true, comisiones: true },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const totalNC = factura.notasCredito.reduce((acc, nc) => acc + nc.monto.toNumber(), 0);
      const maximo = factura.total.toNumber() - totalNC;
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
          motivo,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      notaCreditoId = nc.id;

      // El saldo por cobrar baja hasta un mínimo de cero.
      const nuevoSaldo = Math.max(0, factura.saldo.toNumber() - monto);
      await tx.factura.update({
        where: { id: facturaId },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : factura.estado },
      });

      // Reversión proporcional de la comisión generada. El monto de la NC
      // incluye IGV: se lleva a base imponible antes de aplicar la tasa.
      const generada = factura.comisiones.find((c) => c.tipo === "GENERADA");
      if (generada) {
        const tasa = generada.tasa.toNumber();
        const montoBase = monto / (1 + factura.tasaIgv.toNumber() / 100);
        await tx.comision.create({
          data: {
            vendedorId: factura.vendedorId,
            facturaId,
            tipo: "REVERSION",
            tasa,
            monto: -(montoBase * tasa) / 100,
            motivo: `Nota de crédito ${numero}`,
          },
        });
      }

      await avanzarSerie(tx, serieId);

      const montoBaseNC = monto / (1 + factura.tasaIgv.toNumber() / 100);
      await postearNotaCredito(
        tx,
        {
          numeroNC: numero,
          numeroFactura: factura.numero,
          montoBase: montoBaseNC,
          montoIgv: monto - montoBaseNC,
          montoTotal: monto,
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
          pedido: { include: { detalles: true } },
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

      // Reingreso del stock vendido
      for (const d of factura.pedido.detalles) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: d.presentacionId,
          tipoMovimiento: "ENTRADA",
          origen: "ANULACION_VENTA",
          cantidad: d.cantidad,
          motivo,
          referencia: `Anulación factura ${factura.numero}`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);

        await liberarAsignacionesLote(tx, {
          pedidoDetalleId: d.id,
          motivo: `Anulación factura ${factura.numero}`,
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

      await tx.factura.update({
        where: { id: facturaId },
        data: {
          estado: "ANULADA",
          saldo: 0,
          motivoAnulacion: motivo,
          anuladaEn: new Date(),
          anuladaPor: auth.usuario.nombre,
        },
      });

      // El pedido queda anulado junto con su factura; si la venta se
      // retoma, se registra un pedido nuevo (la historia no se reutiliza).
      await tx.pedido.update({
        where: { id: factura.pedidoId },
        data: { estado: "ANULADO" },
      });

      const costoVentasAnulado = factura.pedido.detalles.reduce(
        (acc, d) => acc + d.cantidad * d.costoUnitario.toNumber(),
        0
      );
      await postearAnulacionFactura(
        tx,
        {
          numeroFactura: factura.numero,
          subtotal:
            factura.subtotal.toNumber() > 0
              ? factura.subtotal.toNumber()
              : factura.total.toNumber(),
          igv: factura.igv.toNumber(),
          total: factura.total.toNumber(),
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
      const factura = await tx.factura.findUnique({ where: { id: facturaId } });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const detalle = await tx.pedidoDetalle.findUnique({ where: { id: pedidoDetalleId } });
      if (!detalle || detalle.pedidoId !== factura.pedidoId) {
        throw new Error("La línea seleccionada no pertenece a esta factura.");
      }

      const liberacionesPrevias = await tx.asignacionLoteVenta.findMany({
        where: { pedidoDetalleId, tipo: "LIBERADA", motivo: { startsWith: MOTIVO_DEVOLUCION_PREFIJO } },
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

      await liberarAsignacionesLote(tx, {
        pedidoDetalleId,
        cantidad,
        motivo: `${MOTIVO_DEVOLUCION_PREFIJO} factura ${factura.numero}: ${motivo}`,
      });
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
export async function aplicarRecargoMora(facturaId: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: { recargosMora: { orderBy: { fecha: "desc" }, take: 1 } },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado !== "PENDIENTE") throw new Error("Solo aplica a facturas pendientes.");

      const hoy = new Date();
      if (factura.fechaVencimiento >= hoy) throw new Error("La factura todavía no está vencida.");

      const config = await tx.configuracionEmpresa.findUniqueOrThrow({ where: { id: "1" } });
      const tasa = config.tasaRecargoMora.toNumber();
      if (tasa <= 0) throw new Error("La tasa de recargo por mora no está configurada (Configuración → Empresa).");

      const desde = factura.recargosMora[0]?.fecha ?? factura.fechaVencimiento;
      const diasCalculados = Math.floor((hoy.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
      if (diasCalculados <= 0) throw new Error("Ya se cobró el recargo hasta el día de hoy.");

      const monto = factura.saldo.toNumber() * (tasa / 100) * (diasCalculados / 30);

      await tx.recargoMora.create({
        data: {
          facturaId,
          diasCalculados,
          tasaAplicada: tasa,
          monto,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      await tx.factura.update({
        where: { id: facturaId },
        data: { saldo: { increment: monto } },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  return {};
}
