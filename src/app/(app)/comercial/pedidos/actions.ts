"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CondicionPago, Prisma, type $Enums } from "@/generated/prisma/client";
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
import {
  normalizarLineasSolicitudPedido,
  type LineaSolicitudPedido,
} from "@/lib/lineasVenta";
import { calcularTotalesPedido, resolverCondicionPrecioPedido } from "@/lib/preciosPedido";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { esValorEnum } from "@/lib/enums";
import { calcularImportesFuncionales, convertirAMonedaFuncional } from "@/lib/multimoneda";
import { calcularSaldoFacturable, calcularTotalesFacturaParcial } from "@/lib/facturacionParcial";
import { asignarEntregasFifo } from "@/lib/cumplimientoVentas";

export type EstadoFormulario = { error?: string };

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
  const almacenId = String(formData.get("almacenId") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambioRaw = Number(formData.get("tipoCambio") ?? 1);
  const tipoCambio = moneda === "PEN" ? 1 : tipoCambioRaw;
  const condicionPago = String(formData.get("condicionPago") ?? "CONTADO");
  const fechaEntregaSolicitada = crearFechaCalendarioLocal(
    String(formData.get("fechaEntregaSolicitada") ?? "")
  );
  const direccionEntrega = String(formData.get("direccionEntrega") ?? "").trim();
  const ordenCompraCliente = String(formData.get("ordenCompraCliente") ?? "").trim() || null;
  const referenciaCliente = String(formData.get("referenciaCliente") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del pedido es inválido." };
  }
  const lineas: LineaSolicitudPedido[] | null = normalizarLineasSolicitudPedido(lineasRaw);
  if (lineas === null) {
    return { error: "El detalle del pedido es inválido." };
  }

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!vendedorId) return { error: "Seleccione el vendedor." };
  if (!almacenId) return { error: "Seleccione el centro de despacho." };
  if (moneda !== "PEN" && moneda !== "USD") return { error: "Seleccione una moneda válida." };
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    return { error: "El tipo de cambio debe ser mayor a 0." };
  }
  if (!esValorEnum(Object.values(CondicionPago), condicionPago)) {
    return { error: "Seleccione una condición de pago válida." };
  }
  if (!fechaEntregaSolicitada) return { error: "Ingrese una fecha de entrega válida." };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fechaEntregaSolicitada < hoy) {
    return { error: "La fecha solicitada de entrega no puede estar en el pasado." };
  }
  if (!direccionEntrega) return { error: "Ingrese la dirección de entrega." };
  if (direccionEntrega.length > 500) return { error: "La dirección de entrega es demasiado extensa." };
  if (ordenCompraCliente && ordenCompraCliente.length > 100) {
    return { error: "La orden de compra del cliente no puede superar 100 caracteres." };
  }
  if (referenciaCliente && referenciaCliente.length > 100) {
    return { error: "La referencia del cliente no puede superar 100 caracteres." };
  }

  const [cliente, vendedor, almacen] = await Promise.all([
    prisma.cliente.findFirst({ where: { id: clienteId, activo: true } }),
    prisma.vendedor.findFirst({ where: { id: vendedorId, activo: true } }),
    prisma.almacen.findFirst({ where: { id: almacenId, activo: true } }),
  ]);
  if (!cliente) return { error: "El cliente no existe o está inactivo." };
  if (!vendedor) return { error: "El vendedor no existe o está inactivo." };
  if (!almacen) return { error: "El centro de despacho no existe o está inactivo." };
  if (cliente.empresaId !== vendedor.empresaId || cliente.empresaId !== almacen.empresaId) {
    return { error: "Cliente, vendedor y centro de despacho deben pertenecer a la misma compañía." };
  }
  if (cliente.bloqueadoCobranza) {
    return {
      error: `${cliente.razonSocial} está bloqueado por cobranza (facturas vencidas sin regularizar). Levante el bloqueo en Finanzas → Gestión de cobranza antes de crear un pedido nuevo.`,
    };
  }
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con una cantidad válida." };
  }
  if (new Set(lineas.map((linea) => linea.presentacionId)).size !== lineas.length) {
    return { error: "Cada presentación debe aparecer una sola vez en el pedido." };
  }

  let pedidoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const configuracion =
        (await tx.configuracionEmpresa.findUnique({ where: { id: "1" } })) ??
        (await tx.configuracionEmpresa.create({ data: { id: "1" } }));
      const descuentoCanal = cliente.canal
        ? await tx.descuentoCanal.findUnique({ where: { canal: cliente.canal } })
        : null;
      const descuentoCanalPct = descuentoCanal?.descuentoPct.toNumber() ?? 0;
      const lineasConPrecio: Array<
        LineaSolicitudPedido & ReturnType<typeof resolverCondicionPrecioPedido>
      > = [];

      // Reserva de stock: un pedido pendiente compromete stock disponible
      // para que dos vendedores no ofrezcan lo mismo dos veces antes de
      // facturar. Se libera al anular o al facturar (kardex real).
      for (const l of [...lineas].sort((a, b) => a.presentacionId.localeCompare(b.presentacionId))) {
        // La escritura neutra adquiere el bloqueo antes de calcular el
        // disponible. Todas las reservas usan el mismo orden determinista.
        const presentacion = await tx.presentacion.update({
          where: { id: l.presentacionId },
          data: { stockReservado: { increment: 0 } },
          include: { escalonesPrecio: true },
        });
        if (!presentacion.activo) {
          throw new Error(`La presentación "${presentacion.nombre}" está inactiva.`);
        }
        if (presentacion.empresaId !== cliente.empresaId) {
          throw new Error(`La presentación "${presentacion.nombre}" pertenece a otra compañía.`);
        }
        if (presentacion.moneda !== moneda) {
          throw new Error(
            `La presentación "${presentacion.nombre}" está valorizada en ${presentacion.moneda}; no puede incluirse en un pedido ${moneda}.`
          );
        }
        const condicionPrecio = resolverCondicionPrecioPedido({
          precioBase: presentacion.precio.toNumber(),
          escalones: presentacion.escalonesPrecio.map((escalon) => ({
            cantidadMinima: escalon.cantidadMinima,
            precio: escalon.precio.toNumber(),
          })),
          cantidad: l.cantidad,
          descuentoCanalPct,
        });
        lineasConPrecio.push({ ...l, ...condicionPrecio });
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
      const totales = calcularTotalesPedido(
        lineasConPrecio,
        configuracion.tasaIgv.toNumber()
      );
      const pedido = await tx.pedido.create({
        data: {
          numero,
          empresaId: cliente.empresaId,
          clienteId,
          vendedorId,
          almacenId,
          moneda,
          tipoCambio,
          condicionPago,
          fechaEntregaSolicitada,
          direccionEntrega,
          ordenCompraCliente,
          referenciaCliente,
          requiereEntrega: true,
          subtotalBruto: totales.subtotalBruto,
          descuentoTotal: totales.descuentoTotal,
          total: totales.total,
          tasaIgv: totales.tasaIgv,
          igv: totales.igv,
          totalConIgv: totales.totalConIgv,
          notas,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: lineasConPrecio.map((linea) => ({
              presentacionId: linea.presentacionId,
              cantidad: linea.cantidad,
              precioLista: linea.precioLista,
              origenPrecio: linea.origenPrecio,
              cantidadMinimaPrecio: linea.cantidadMinimaPrecio,
              descuentoPct: linea.descuentoPct,
              descuentoMonto: linea.descuentoMonto,
              precioUnitario: linea.precioUnitario,
              subtotal: linea.subtotal,
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

    const reclamo = await tx.pedido.updateMany({
      where: { id, estado: "PENDIENTE" },
      data: { estado: "ANULADO" },
    });
    if (reclamo.count !== 1) return;

    // Libera la reserva de stock (el pedido nunca llegó a facturarse).
    for (const d of pedido.detalles) {
      await tx.presentacion.update({
        where: { id: d.presentacionId },
        data: { stockReservado: { decrement: d.cantidad } },
      });
    }
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
          detalles: {
            include: {
              presentacion: true,
              facturaDetalles: { include: { factura: { select: { estado: true } } } },
              guiaDetalles: {
                include: {
                  guia: { select: { estadoDespacho: true, fechaSalida: true, creadoEn: true } },
                  facturaAsignaciones: {
                    include: { facturaDetalle: { include: { factura: { select: { estado: true } } } } },
                  },
                },
              },
            },
          },
          vendedor: true,
          cliente: true,
        },
      });
      if (!pedido) throw new Error("El pedido no existe.");
      if (pedido.estado !== "PENDIENTE" && pedido.estado !== "PARCIAL") {
        throw new Error("Solo se puede facturar un pedido pendiente o parcialmente facturado.");
      }
      if (condicionPago !== pedido.condicionPago) {
        throw new Error("La condición de pago debe coincidir con la aprobada en el pedido.");
      }

      const lineas = pedido.detalles.map((detalle) => {
        const facturado = detalle.facturaDetalles
          .filter((fd) => fd.factura.estado !== "ANULADA")
          .reduce((total, fd) => total + fd.cantidad, 0);
        const entregado = detalle.guiaDetalles
          .filter((gd) => gd.guia.estadoDespacho !== "PLANIFICADO")
          .reduce((total, gd) => total + gd.cantidad, 0);
        const limiteDocumento = pedido.requiereEntrega ? entregado : detalle.cantidad;
        const saldo = calcularSaldoFacturable(limiteDocumento, [facturado]);
        const cantidad = Number(formData.get(`cantidad:${detalle.id}`) ?? 0);
        if (!Number.isInteger(cantidad) || cantidad < 0) {
          throw new Error(`La cantidad a facturar de ${detalle.presentacion.nombre} debe ser un entero mayor o igual a 0.`);
        }
        if (cantidad > saldo) {
          const origen = pedido.requiereEntrega ? "entregado y pendiente de facturar" : "pendiente";
          throw new Error(`La cantidad de ${detalle.presentacion.nombre} supera el saldo ${origen} (${saldo}).`);
        }
        return { detalle, facturado, entregado, saldo, cantidad };
      });
      const seleccionadas = lineas.filter((linea) => linea.cantidad > 0);
      if (seleccionadas.length === 0) {
        throw new Error("Ingrese al menos una cantidad a facturar.");
      }

      const tasaIgv = pedido.tasaIgv.toNumber();
      const { subtotal, igv, total: totalConIgv } = calcularTotalesFacturaParcial(
        seleccionadas.map((linea) => ({
          cantidad: linea.cantidad,
          precioUnitario: linea.detalle.precioUnitario.toNumber(),
        })),
        tasaIgv
      );
      const empresa = await tx.empresa.findUnique({ where: { id: pedido.empresaId } });
      const tipoCambio = pedido.tipoCambio.toNumber();
      const importesFuncionales = calcularImportesFuncionales({
        moneda: pedido.moneda,
        tipoCambio,
        monedaFuncional: empresa?.monedaFuncional ?? "PEN",
        subtotal,
        igv,
        total: totalConIgv,
      });

      const limite =
        condicionPago === "CONTADO"
          ? 0
          : (
              await tx.cliente.update({
                where: { id: pedido.clienteId },
                data: { limiteCredito: { increment: 0 } },
                select: { limiteCredito: true },
              })
            ).limiteCredito.toNumber();
      if (limite > 0) {
        const pendientes = await tx.factura.findMany({
          where: { clienteId: pedido.clienteId, estado: "PENDIENTE" },
        });
        const deudaActual = pendientes.reduce((acc, f) => acc + f.saldoFuncional.toNumber(), 0);
        const evaluacion = evaluarCredito(deudaActual, importesFuncionales.totalFuncional, limite);
        if (evaluacion.excede) {
          const mismaEvaluacion =
            pedido.condicionPagoCredito === condicionPago &&
            pedido.deudaCreditoEvaluada?.toNumber() === deudaActual &&
            pedido.montoCreditoEvaluado?.toNumber() === importesFuncionales.totalFuncional &&
            pedido.limiteCreditoEvaluado?.toNumber() === limite;
          const aprobada = esAprobacionCreditoVigente(pedido, {
            condicionPago,
            deudaActual,
            montoFactura: importesFuncionales.totalFuncional,
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
                  montoCreditoEvaluado: importesFuncionales.totalFuncional,
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

      const reclamo = await tx.pedido.updateMany({
        where: {
          id: pedido.id,
          estado: pedido.estado,
          fulfillmentVersion: pedido.fulfillmentVersion,
        },
        data: { fulfillmentVersion: { increment: 1 } },
      });
      if (reclamo.count !== 1) {
        throw new Error("El saldo del pedido cambió mientras se facturaba. Actualice la página e intente nuevamente.");
      }

      const fechaEmision = new Date();
      const fechaVencimiento = new Date(
        fechaEmision.getTime() + DIAS_CONDICION[condicionPago] * 24 * 60 * 60 * 1000
      );
      const factura = await tx.factura.create({
        data: {
          numero,
          empresaId: pedido.empresaId,
          pedidoId: pedido.id,
          clienteId: pedido.clienteId,
          vendedorId: pedido.vendedorId,
          moneda: pedido.moneda,
          tipoCambio,
          monedaFuncional: importesFuncionales.monedaFuncional,
          condicionPago,
          fechaEmision,
          fechaVencimiento,
          subtotal,
          tasaIgv,
          igv,
          total: totalConIgv,
          saldo: totalConIgv,
          subtotalFuncional: importesFuncionales.subtotalFuncional,
          igvFuncional: importesFuncionales.igvFuncional,
          totalFuncional: importesFuncionales.totalFuncional,
          saldoFuncional: importesFuncionales.totalFuncional,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      facturaId = factura.id;

      let costoVentas = 0;
      for (const linea of seleccionadas) {
        const d = linea.detalle;
        const subtotalLinea = calcularTotalesFacturaParcial(
          [{ cantidad: linea.cantidad, precioUnitario: d.precioUnitario.toNumber() }],
          0
        ).subtotal;
        const descuentoLinea = calcularTotalesFacturaParcial(
          [
            {
              cantidad: linea.cantidad,
              precioUnitario: d.precioLista.toNumber() - d.precioUnitario.toNumber(),
            },
          ],
          0
        ).subtotal;

        const asignacionesEntrega: Array<{ guiaDetalleId: string; cantidad: number }> = [];
        let costoUnitario = d.presentacion.costoPromedio.toNumber();
        if (pedido.requiereEntrega) {
          const asignacion = asignarEntregasFifo(
            d.guiaDetalles
              .filter((gd) => gd.guia.estadoDespacho !== "PLANIFICADO")
              .map((entrega) => ({
                guiaDetalleId: entrega.id,
                cantidadEntregada: entrega.cantidad,
                cantidadFacturada: entrega.facturaAsignaciones
                  .filter((registro) => registro.facturaDetalle.factura.estado !== "ANULADA")
                  .reduce((total, registro) => total + registro.cantidad, 0),
                costoUnitario: entrega.costoUnitario.toNumber(),
                fechaSalida: entrega.guia.fechaSalida ?? entrega.guia.creadoEn,
              })),
            linea.cantidad
          );
          asignacionesEntrega.push(...asignacion.asignaciones);
          costoUnitario = asignacion.costoUnitario;
        }
        costoVentas += linea.cantidad * costoUnitario;

        const facturaDetalle = await tx.facturaDetalle.create({
          data: {
            facturaId: factura.id,
            pedidoDetalleId: d.id,
            presentacionId: d.presentacionId,
            cantidad: linea.cantidad,
            precioLista: d.precioLista,
            origenPrecio: d.origenPrecio,
            cantidadMinimaPrecio: d.cantidadMinimaPrecio,
            descuentoPct: d.descuentoPct,
            descuentoMonto: descuentoLinea,
            precioUnitario: d.precioUnitario,
            subtotal: subtotalLinea,
            precioUnitarioFuncional: convertirAMonedaFuncional(
              d.precioUnitario.toNumber(),
              pedido.moneda,
              tipoCambio,
              importesFuncionales.monedaFuncional
            ),
            subtotalFuncional: convertirAMonedaFuncional(
              subtotalLinea,
              pedido.moneda,
              tipoCambio,
              importesFuncionales.monedaFuncional
            ),
            costoUnitario,
          },
        });
        await tx.pedidoDetalle.update({ where: { id: d.id }, data: { costoUnitario } });

        if (pedido.requiereEntrega) {
          await tx.facturaDetalleEntrega.createMany({
            data: asignacionesEntrega.map((asignacion) => ({
              facturaDetalleId: facturaDetalle.id,
              ...asignacion,
            })),
          });
        } else {
          const movimiento = await registrarMovimiento(tx, {
            tipoItem: "PRESENTACION",
            presentacionId: d.presentacionId,
            tipoMovimiento: "SALIDA",
            origen: "VENTA",
            cantidad: linea.cantidad,
            almacenId: pedido.almacenId ?? undefined,
            referencia: `Factura ${numero} (pedido ${pedido.numero})`,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          });
          if (!movimiento.ok) throw new Error(movimiento.error);
          await asignarLoteVenta(tx, {
            facturaDetalleId: facturaDetalle.id,
            pedidoDetalleId: d.id,
            presentacionId: d.presentacionId,
            cantidad: linea.cantidad,
          });
          await tx.presentacion.update({
            where: { id: d.presentacionId },
            data: { stockReservado: { decrement: linea.cantidad } },
          });
        }
      }
      const completo = lineas.every((linea) => linea.facturado + linea.cantidad === linea.detalle.cantidad);
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { estado: completo ? "FACTURADO" : "PARCIAL" },
      });

      const tasa = pedido.vendedor.tasaComision.toNumber();
      await tx.comision.create({
        data: {
          vendedorId: pedido.vendedorId,
          facturaId: factura.id,
          tipo: "GENERADA",
          tasa,
          monto: (importesFuncionales.subtotalFuncional * tasa) / 100,
        },
      });
      await avanzarSerie(tx, serieId);
      await postearVenta(
        tx,
        {
          numeroFactura: numero,
          cliente: pedido.cliente.razonSocial,
          subtotal: importesFuncionales.subtotalFuncional,
          igv: importesFuncionales.igvFuncional,
          total: importesFuncionales.totalFuncional,
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
  if (!facturaId) return { error: "No se pudo registrar la factura." };
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
  if (!pedido || (pedido.estado !== "PENDIENTE" && pedido.estado !== "PARCIAL")) return { error: "El pedido no tiene saldo pendiente." };
  if (!puedeResolverSolicitud(pedido.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó el pedido no puede resolver su excepción de crédito." };
  }
  if (pedido.estadoAprobacionCredito !== "PENDIENTE") {
    return { error: "El pedido no tiene una excepción de crédito pendiente." };
  }
  const resultado = await prisma.pedido.updateMany({
    where: {
      id,
      estado: { in: ["PENDIENTE", "PARCIAL"] },
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
  if (!pedido || (pedido.estado !== "PENDIENTE" && pedido.estado !== "PARCIAL")) return { error: "El pedido no tiene saldo pendiente." };
  if (!puedeResolverSolicitud(pedido.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó el pedido no puede resolver su excepción de crédito." };
  }
  if (pedido.estadoAprobacionCredito !== "PENDIENTE") {
    return { error: "El pedido no tiene una excepción de crédito pendiente." };
  }
  const resultado = await prisma.pedido.updateMany({
    where: {
      id,
      estado: { in: ["PENDIENTE", "PARCIAL"] },
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
