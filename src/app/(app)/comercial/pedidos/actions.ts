"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { asignarLoteVenta } from "@/lib/trazabilidad";
import { calcularAtpProducto, unidadesEquivalentes } from "@/lib/atp";
import { siguienteNumeroPedido } from "@/lib/correlativos";
import { DIAS_CONDICION } from "@/lib/etiquetas";
import { avanzarSerie } from "@/lib/series";
import { postearVenta } from "@/lib/contabilidad";
import { enviarComprobanteFactura } from "@/app/(app)/comercial/facturas/actions";
import { esAprobacionCreditoVigente, evaluarCredito } from "@/lib/credito";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";

export type EstadoFormulario = { error?: string };

type LineaPedido = { presentacionId: string; cantidad: number; precioUnitario: number };

export async function crearPedido(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const clienteId = String(formData.get("clienteId") ?? "");
  const vendedorId = String(formData.get("vendedorId") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineas: LineaPedido[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del pedido es inválido." };
  }

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!vendedorId) return { error: "Seleccione el vendedor." };

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { error: "El cliente no existe." };
  if (cliente.bloqueadoCobranza) {
    return {
      error: `${cliente.razonSocial} está bloqueado por cobranza (facturas vencidas sin regularizar). Levante el bloqueo en Finanzas → Gestión de cobranza antes de crear un pedido nuevo.`,
    };
  }
  lineas = lineas.filter(
    (l) =>
      l.presentacionId &&
      Number.isInteger(l.cantidad) &&
      l.cantidad > 0 &&
      Number.isFinite(l.precioUnitario) &&
      l.precioUnitario >= 0
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad y precio válidos." };
  }

  let pedidoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      // Reserva de stock: un pedido pendiente compromete stock disponible
      // para que dos vendedores no ofrezcan lo mismo dos veces antes de
      // facturar. Se libera al anular o al facturar (kardex real).
      for (const l of lineas) {
        const presentacion = await tx.presentacion.findUniqueOrThrow({ where: { id: l.presentacionId } });
        const disponible = presentacion.stock.toNumber() - presentacion.stockReservado.toNumber();
        if (l.cantidad > disponible) {
          // ATP informativo: no cambia el bloqueo (solo se reserva stock real),
          // pero le dice al vendedor si hay producción en camino antes de
          // rechazar la venta sin más contexto.
          const atp = await calcularAtpProducto(tx, presentacion.productoId);
          const contenidoKg = presentacion.contenidoKg.toNumber();
          const enCamino =
            unidadesEquivalentes(atp.granelSinEnvasarKg, contenidoKg) +
            unidadesEquivalentes(atp.planificadoKg, contenidoKg);
          const notaProduccion =
            enCamino > 0
              ? ` Hay ${enCamino} unidades en camino desde Producción (granel aprobado sin envasar y/o ${atp.lotesPlanificados} lote(s) en proceso) — consulte el plazo antes de prometer fecha al cliente, o cree el pedido por la cantidad disponible.`
              : "";
          throw new Error(
            `Stock disponible insuficiente de "${presentacion.nombre}": disponible ${disponible} (ya hay reservas de otros pedidos pendientes), se pide ${l.cantidad}.${notaProduccion}`
          );
        }
        await tx.presentacion.update({
          where: { id: l.presentacionId },
          data: { stockReservado: { increment: l.cantidad } },
        });
      }

      const numero = await siguienteNumeroPedido(tx);
      const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
      const pedido = await tx.pedido.create({
        data: {
          numero,
          clienteId,
          vendedorId,
          total,
          notas,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: lineas.map((l) => ({
              presentacionId: l.presentacionId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              subtotal: l.cantidad * l.precioUnitario,
            })),
          },
        },
      });
      pedidoId = pedido.id;
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/comercial/pedidos");
  redirect(`/comercial/pedidos/${pedidoId}`);
}

export async function anularPedido(id: string) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;

  await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id }, include: { detalles: true } });
    if (!pedido || pedido.estado !== "PENDIENTE") return;

    // Libera la reserva de stock (el pedido nunca llegó a facturarse).
    for (const d of pedido.detalles) {
      await tx.presentacion.update({
        where: { id: d.presentacionId },
        data: { stockReservado: { decrement: d.cantidad } },
      });
    }

    await tx.pedido.update({ where: { id }, data: { estado: "ANULADO" } });
  });

  revalidatePath("/comercial/pedidos");
  revalidatePath(`/comercial/pedidos/${id}`);
}

// Facturar: registra el número emitido en SUNAT, descuenta stock por kardex
// y genera la comisión del vendedor con su tasa vigente.
export async function facturarPedido(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase();
  const condicionPago = String(formData.get("condicionPago") ?? "") as $Enums.CondicionPago;
  const serieId = String(formData.get("serieId") ?? "") || null;

  if (!numero) return { error: "Ingrese el número de factura emitido en SUNAT." };
  if (!["CONTADO", "DIAS_15", "DIAS_30"].includes(condicionPago)) {
    return { error: "Seleccione la condición de pago." };
  }

  let facturaId = "";
  let errorCredito: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: {
          detalles: { include: { presentacion: true } },
          vendedor: true,
          cliente: true,
        },
      });
      if (!pedido) throw new Error("El pedido no existe.");
      if (pedido.estado !== "PENDIENTE") {
        throw new Error("Solo se puede facturar un pedido pendiente.");
      }

      // IGV: los precios del pedido son valor de venta (sin IGV); la tasa
      // vigente de la configuración de empresa se congela en la factura.
      const config =
        (await tx.configuracionEmpresa.findUnique({ where: { id: "1" } })) ??
        (await tx.configuracionEmpresa.create({ data: { id: "1" } }));
      const tasaIgv = config.tasaIgv.toNumber();
      const subtotal = pedido.total.toNumber();
      const igv = Math.round(subtotal * tasaIgv) / 100;
      const totalConIgv = subtotal + igv;

      // Control de límite de crédito (0 = sin límite). Solo aplica a ventas
      // al crédito: la deuda vigente más esta factura (IGV incluido) no puede
      // exceder el límite.
      const limite = pedido.cliente.limiteCredito.toNumber();
      if (limite > 0 && condicionPago !== "CONTADO") {
        const pendientes = await tx.factura.findMany({
          where: { clienteId: pedido.clienteId, estado: "PENDIENTE" },
        });
        const deudaActual = pendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
        const evaluacion = evaluarCredito(deudaActual, totalConIgv, limite);
        if (evaluacion.excede) {
          const mismaEvaluacion =
            pedido.condicionPagoCredito === condicionPago &&
            pedido.deudaCreditoEvaluada?.toNumber() === deudaActual &&
            pedido.montoCreditoEvaluado?.toNumber() === totalConIgv &&
            pedido.limiteCreditoEvaluado?.toNumber() === limite;
          const aprobada = esAprobacionCreditoVigente(pedido, {
            condicionPago,
            deudaActual,
            montoFactura: totalConIgv,
            limite,
          });
          if (!aprobada) {
            if (pedido.estadoAprobacionCredito === "RECHAZADA" && mismaEvaluacion) {
              errorCredito = `La excepción de crédito fue rechazada: ${pedido.motivoRechazoCredito ?? "sin motivo registrado"}.`;
              return;
            }
            if (pedido.estadoAprobacionCredito !== "PENDIENTE" || !mismaEvaluacion) {
              await tx.pedido.update({
                where: { id: pedido.id },
                data: {
                  estadoAprobacionCredito: "PENDIENTE",
                  condicionPagoCredito: condicionPago,
                  deudaCreditoEvaluada: deudaActual,
                  montoCreditoEvaluado: totalConIgv,
                  limiteCreditoEvaluado: limite,
                  creditoSolicitadoEn: new Date(),
                  creditoResueltoEn: null,
                  creditoResueltoPor: null,
                  motivoRechazoCredito: null,
                },
              });
            }
            errorCredito = `Se solicitó aprobación de Gerencia: la exposición proyectada de S/ ${evaluacion.exposicionProyectada.toFixed(2)} supera el límite de S/ ${limite.toFixed(2)}.`;
            return;
          }
        }
      }
      const fechaEmision = new Date();
      const fechaVencimiento = new Date(
        fechaEmision.getTime() + DIAS_CONDICION[condicionPago] * 24 * 60 * 60 * 1000
      );

      const factura = await tx.factura.create({
        data: {
          numero,
          pedidoId: pedido.id,
          clienteId: pedido.clienteId,
          vendedorId: pedido.vendedorId,
          condicionPago,
          fechaEmision,
          fechaVencimiento,
          subtotal,
          tasaIgv,
          igv,
          total: totalConIgv,
          saldo: totalConIgv,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      facturaId = factura.id;

      // Salida de stock por cada línea, congelando el costo de venta del momento
      let costoVentas = 0;
      for (const d of pedido.detalles) {
        costoVentas += d.cantidad * d.presentacion.costoPromedio.toNumber();
        await tx.pedidoDetalle.update({
          where: { id: d.id },
          data: { costoUnitario: d.presentacion.costoPromedio },
        });
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: d.presentacionId,
          tipoMovimiento: "SALIDA",
          origen: "VENTA",
          cantidad: d.cantidad,
          referencia: `Factura ${numero} (pedido ${pedido.numero})`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);

        // Trazabilidad: qué lote(s) de envasado cubrieron esta venta (FIFO).
        await asignarLoteVenta(tx, {
          pedidoDetalleId: d.id,
          presentacionId: d.presentacionId,
          cantidad: d.cantidad,
        });

        // La reserva ya cumplió su propósito: el stock se descontó de verdad arriba.
        await tx.presentacion.update({
          where: { id: d.presentacionId },
          data: { stockReservado: { decrement: d.cantidad } },
        });
      }

      // Comisión generada con la tasa vigente del vendedor, sobre la base
      // imponible (valor de venta sin IGV: el impuesto no es ingreso).
      const tasa = pedido.vendedor.tasaComision.toNumber();
      await tx.comision.create({
        data: {
          vendedorId: pedido.vendedorId,
          facturaId: factura.id,
          tipo: "GENERADA",
          tasa,
          monto: (subtotal * tasa) / 100,
        },
      });

      await tx.pedido.update({ where: { id }, data: { estado: "FACTURADO" } });
      await avanzarSerie(tx, serieId);

      // Asiento contable automático (best-effort: sin controles configurados
      // la venta se registra igual, solo sin asiento)
      await postearVenta(
        tx,
        {
          numeroFactura: numero,
          cliente: pedido.cliente.razonSocial,
          subtotal,
          igv,
          total: totalConIgv,
          costoVentas,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una factura con el número ${numero}.` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  if (errorCredito) {
    revalidatePath(`/comercial/pedidos/${id}`);
    return { error: errorCredito };
  }
  // Envío al OSE fuera de la transacción (llamada de red): best-effort, si
  // falla la factura ya quedó creada y se puede reintentar desde su ficha.
  await enviarComprobanteFactura(facturaId);

  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial/facturas");
  redirect(`/comercial/facturas/${facturaId}`);
}

export async function aprobarCreditoPedido(id: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite aprobar excepciones de crédito." };
  }
  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.estado !== "PENDIENTE") return { error: "El pedido no está pendiente." };
  if (!puedeResolverSolicitud(pedido.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó el pedido no puede resolver su excepción de crédito." };
  }
  if (pedido.estadoAprobacionCredito !== "PENDIENTE") {
    return { error: "El pedido no tiene una excepción de crédito pendiente." };
  }
  const resultado = await prisma.pedido.updateMany({
    where: {
      id,
      estado: "PENDIENTE",
      estadoAprobacionCredito: "PENDIENTE",
      usuarioId: { not: auth.usuario.id },
    },
    data: {
      estadoAprobacionCredito: "APROBADA",
      creditoResueltoEn: new Date(),
      creditoResueltoPor: auth.usuario.nombre,
      motivoRechazoCredito: null,
    },
  });
  if (resultado.count !== 1) return { error: "La excepción ya fue resuelta por otro usuario." };
  revalidatePath(`/comercial/pedidos/${id}`);
  return {};
}

export async function rechazarCreditoPedido(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver excepciones de crédito." };
  }
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };
  if (motivo.length > 500) return { error: "El motivo no puede superar 500 caracteres." };
  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.estado !== "PENDIENTE") return { error: "El pedido no está pendiente." };
  if (!puedeResolverSolicitud(pedido.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó el pedido no puede resolver su excepción de crédito." };
  }
  if (pedido.estadoAprobacionCredito !== "PENDIENTE") {
    return { error: "El pedido no tiene una excepción de crédito pendiente." };
  }
  const resultado = await prisma.pedido.updateMany({
    where: {
      id,
      estado: "PENDIENTE",
      estadoAprobacionCredito: "PENDIENTE",
      usuarioId: { not: auth.usuario.id },
    },
    data: {
      estadoAprobacionCredito: "RECHAZADA",
      creditoResueltoEn: new Date(),
      creditoResueltoPor: auth.usuario.nombre,
      motivoRechazoCredito: motivo,
    },
  });
  if (resultado.count !== 1) return { error: "La excepción ya fue resuelta por otro usuario." };
  revalidatePath(`/comercial/pedidos/${id}`);
  return {};
}
