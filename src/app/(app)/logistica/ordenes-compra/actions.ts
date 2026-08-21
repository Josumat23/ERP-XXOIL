"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import { siguienteNumeroRecepcion } from "@/lib/correlativos";
import { postearRecepcionCompra, postearDevolucionCompra } from "@/lib/contabilidad";
import { convertirAPen } from "@/lib/tipoCambio";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";
import {
  esTipoComprobanteRecepcionValido,
  normalizarLineasRecepcionCompra,
  sonDiasCreditoRecepcionValidos,
  type LineaRecepcionCompra,
} from "@/lib/recepcionesCompra";
import {
  esMonedaOrdenCompraValida,
  normalizarLineasOrdenCompra,
  type LineaOrdenCompraNormalizada,
} from "@/lib/lineasOrdenCompra";
import { crearOrdenCompraDesdeDatos } from "@/lib/ordenesCompra";

export type EstadoFormulario = { error?: string };


export async function crearOrdenCompra(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const proveedorId = String(formData.get("proveedorId") ?? "");
  const almacenId = String(formData.get("almacenId") ?? "") || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const moneda = String(formData.get("moneda") ?? "PEN");
  if (!esMonedaOrdenCompraValida(moneda)) {
    return { error: "Seleccione una moneda válida para la orden." };
  }
  const tipoCambio = moneda === "USD" ? Number(formData.get("tipoCambio")) : 1;
  const proyectoId = String(formData.get("proyectoId") ?? "") || null;
  const edtId = String(formData.get("edtId") ?? "") || null;

  if (moneda === "USD" && (!Number.isFinite(tipoCambio) || tipoCambio <= 0)) {
    return { error: "Ingrese un tipo de cambio válido para la orden en dólares." };
  }

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la orden es inválido." };
  }
  const lineas: LineaOrdenCompraNormalizada[] | null =
    normalizarLineasOrdenCompra(lineasRaw);
  if (lineas === null) {
    return { error: "El detalle de la orden es inválido." };
  }

  if (!proveedorId) return { error: "Seleccione el proveedor." };
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad y costo válidos." };
  }

  let ocId: string;
  try {
    ocId = await crearOrdenCompraDesdeDatos(
      { proveedorId, almacenId, notas, moneda, tipoCambio, lineas, proyectoId, edtId },
      { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
    );
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/ordenes-compra");
  redirect(`/logistica/ordenes-compra/${ocId}`);
}

export async function anularOrdenCompra(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo de anulación es obligatorio." };

  const existe = await prisma.ordenCompra.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return { error: "La orden no existe." };

  const resultado = await prisma.ordenCompra.updateMany({
    where: { id, estado: "PENDIENTE", recepciones: { none: {} } },
    data: { estado: "ANULADA", motivoAnulacion: motivo },
  });
  if (resultado.count !== 1) {
    return { error: "Solo se puede anular una orden pendiente sin recepciones." };
  }

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}


// Recepción de mercadería: entra al kardex (origen COMPRA), actualiza el costo
// promedio ponderado del insumo y genera la cuenta por pagar al proveedor.
export async function registrarRecepcion(
  ordenCompraId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const numeroDocumento = String(formData.get("numeroDocumento") ?? "").trim();
  const tipoComprobante = String(formData.get("tipoComprobante") ?? "01").trim();
  const diasCredito = Number(formData.get("diasCredito") ?? 0);
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la recepción es inválido." };
  }
  const lineas: LineaRecepcionCompra[] | null = normalizarLineasRecepcionCompra(lineasRaw);
  if (lineas === null) {
    return { error: "El detalle de la recepción es inválido." };
  }

  if (!numeroDocumento) {
    return { error: "Ingrese el número de la factura o guía del proveedor." };
  }
  if (!esTipoComprobanteRecepcionValido(tipoComprobante)) {
    return { error: "Seleccione un tipo de comprobante válido." };
  }
  if (!sonDiasCreditoRecepcionValidos(diasCredito)) {
    return { error: "Seleccione una condición de pago válida." };
  }
  if (lineas.length === 0) {
    return { error: "Ingrese al menos una cantidad recibida mayor a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({
        where: { id: ordenCompraId },
        include: { detalles: { include: { insumo: true } }, proveedor: true },
      });
      if (!oc) throw new Error("La orden de compra no existe.");
      if (oc.estado === "ANULADA" || oc.estado === "RECIBIDA") {
        throw new Error("La orden no admite más recepciones.");
      }
      if (oc.estadoAprobacion === "PENDIENTE") {
        throw new Error("Esta orden supera el monto de aprobación y todavía no fue aprobada por Gerencia.");
      }
      if (oc.estadoAprobacion === "RECHAZADA") {
        throw new Error("Esta orden fue rechazada por Gerencia y no admite recepciones.");
      }

      if (oc.estado === "PENDIENTE") {
        const reclamo = await tx.ordenCompra.updateMany({
          where: { id: ordenCompraId, estado: "PENDIENTE" },
          data: { estado: "PARCIAL" },
        });
        if (reclamo.count !== 1) {
          throw new Error("La orden cambió mientras se registraba la recepción. Actualice la página e intente nuevamente.");
        }
      }

      // Reclama todas las cantidades antes de generar cualquier efecto de la
      // recepción. El snapshot evita que dos solicitudes sumen desde el mismo
      // saldo pendiente o que una sobrescriba la cantidad recibida por otra.
      for (const linea of lineas) {
        const detalle = oc.detalles.find((item) => item.id === linea.detalleId);
        if (!detalle) throw new Error("Línea de recepción inválida.");

        const pendiente = detalle.cantidad.toNumber() - detalle.cantidadRecibida.toNumber();
        if (linea.cantidad > pendiente + 1e-9) {
          throw new Error(
            `"${detalle.insumo.nombre}": se intenta recibir ${linea.cantidad} pero quedan ${pendiente} pendientes.`
          );
        }

        const reclamoLinea = await tx.ordenCompraDetalle.updateMany({
          where: { id: detalle.id, cantidadRecibida: detalle.cantidadRecibida },
          data: { cantidadRecibida: { increment: linea.cantidad } },
        });
        if (reclamoLinea.count !== 1) {
          throw new Error(
            `La cantidad pendiente de "${detalle.insumo.nombre}" cambió durante la recepción. Actualice la página e intente nuevamente.`
          );
        }
      }

      const numero = await siguienteNumeroRecepcion(tx);
      const recepcion = await tx.recepcionCompra.create({
        data: {
          numero,
          ordenCompraId,
          notas,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      let totalRecepcion = 0; // en la moneda de la OC (lo que dice el documento del proveedor)
      let totalRecepcionPen = 0; // convertido a PEN — lo que usan CxP y el asiento contable
      // Verificación de factura en 3 vías (orden↔recepción↔lo que se paga):
      // se guarda la mayor variación de precio encontrada entre lo pactado
      // en la OC y lo realmente registrado al recibir, para marcar la CxP
      // sin bloquear la recepción (las regularizaciones no deben ser rígidas).
      let maxVariacionPct = 0;

      for (const linea of lineas) {
        const detalle = oc.detalles.find((d) => d.id === linea.detalleId);
        if (!detalle) throw new Error("Línea de recepción inválida.");

        // costo queda en la moneda de la OC (lo que dice el documento);
        // costoPen es lo que se usa para valorizar inventario y contabilizar
        // (el kardex/costo promedio del insumo siempre vive en PEN).
        const costo = Number.isFinite(linea.costoUnitario) && linea.costoUnitario >= 0
          ? linea.costoUnitario
          : detalle.costoUnitario.toNumber();
        const costoPen = convertirAPen(costo, oc.moneda, oc.tipoCambio.toNumber());

        const precioPactado = detalle.costoUnitario.toNumber();
        if (precioPactado > 0) {
          const variacionPct = Math.abs(costo - precioPactado) / precioPactado;
          maxVariacionPct = Math.max(maxVariacionPct, variacionPct);
        }

        const detalleRecepcion = await tx.recepcionCompraDetalle.create({
          data: {
            recepcionId: recepcion.id,
            insumoId: detalle.insumoId,
            cantidad: linea.cantidad,
            costoUnitario: costo,
            numeroLoteProveedor: linea.numeroLoteProveedor?.trim() || null,
          },
        });

        const insumo = detalle.insumo;
        if (insumo.requiereInspeccion) {
          // No suma stock ni recalcula costo promedio hasta que calidad
          // apruebe — cantidadDisponible se activa recién ahí (ver
          // resolverInspeccionCompra).
          await tx.inspeccionCompra.create({
            data: { recepcionCompraDetalleId: detalleRecepcion.id },
          });
        } else {
          await tx.recepcionCompraDetalle.update({
            where: { id: detalleRecepcion.id },
            data: { cantidadDisponible: linea.cantidad },
          });
          // Costo promedio ponderado ANTES de mover el stock (siempre en PEN).
          const costoActualizado = await actualizarCostoPromedioEntrada(tx, {
            tipoItem: "INSUMO",
            itemId: insumo.id,
            stockActual: insumo.stock,
            costoActual: insumo.costoUnitario,
            cantidadEntrada: linea.cantidad,
            costoEntrada: costoPen,
          });
          if (!costoActualizado.ok) throw new Error(costoActualizado.error);

          const mov = await registrarMovimiento(tx, {
            tipoItem: "INSUMO",
            insumoId: detalle.insumoId,
            tipoMovimiento: "ENTRADA",
            origen: "COMPRA",
            cantidad: linea.cantidad,
            // Si la OC tiene almacén de destino, la recepción entra ahí
            // directo; si no, se resuelve como siempre (zona del insumo o
            // el almacén activo más antiguo).
            almacenId: oc.almacenId ?? undefined,
            referencia: `Recepción ${numero} (${oc.numero}, doc. ${numeroDocumento})`,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          });
          if (!mov.ok) throw new Error(mov.error);
        }

        totalRecepcion += linea.cantidad * costo;
        totalRecepcionPen += linea.cantidad * costoPen;
      }

      // Estado de la OC según lo recibido acumulado
      const detallesActualizados = await tx.ordenCompraDetalle.findMany({
        where: { ordenCompraId },
      });
      const completa = detallesActualizados.every(
        (d) => d.cantidadRecibida.toNumber() >= d.cantidad.toNumber() - 1e-9
      );
      await tx.ordenCompra.update({
        where: { id: ordenCompraId },
        data: { estado: completa ? "RECIBIDA" : "PARCIAL" },
      });

      // Cuenta por pagar por lo efectivamente recibido
      const fechaVencimiento =
        diasCredito > 0
          ? new Date(Date.now() + diasCredito * 24 * 60 * 60 * 1000)
          : null;
      const TOLERANCIA_DISCREPANCIA = 0.05; // 5%
      await tx.cuentaPorPagar.create({
        data: {
          proveedorId: oc.proveedorId,
          ordenCompraId,
          recepcionCompraId: recepcion.id,
          numeroDocumento,
          tipoComprobante,
          fechaVencimiento,
          moneda: "PEN",
          total: totalRecepcionPen,
          saldo: totalRecepcionPen,
          ...(oc.moneda !== "PEN"
            ? { montoOriginal: totalRecepcion, monedaOriginal: oc.moneda, tipoCambio: oc.tipoCambio }
            : {}),
          discrepanciaPrecioPct: maxVariacionPct > TOLERANCIA_DISCREPANCIA ? maxVariacionPct * 100 : null,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      await postearRecepcionCompra(
        tx,
        {
          numeroRecepcion: numero,
          documentoProveedor: numeroDocumento,
          proveedor: oc.proveedor.razonSocial,
          total: totalRecepcionPen,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${ordenCompraId}`);
  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath("/inventario/kardex");
  return {};
}

// Aprobación por monto: solo Gerencia (o un Administrador) puede resolver
// una orden que superó el umbral configurado en Configuración → Empresa.
export async function aprobarOrdenCompra(id: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite aprobar órdenes de compra." };
  }

  const oc = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!oc) return { error: "La orden no existe." };
  if (!puedeResolverSolicitud(oc.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó la orden no puede aprobarla." };
  }
  if (oc.estadoAprobacion !== "PENDIENTE") {
    return { error: "Esta orden no está pendiente de aprobación." };
  }

  const resultado = await prisma.ordenCompra.updateMany({
    where: { id, estadoAprobacion: "PENDIENTE", usuarioId: { not: auth.usuario.id } },
    data: { estadoAprobacion: "APROBADA", aprobadaPor: auth.usuario.nombre, aprobadaEn: new Date() },
  });
  if (resultado.count !== 1) return { error: "La orden ya fue resuelta por otro usuario." };

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}

export async function rechazarOrdenCompra(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver órdenes de compra." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };

  const oc = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!oc) return { error: "La orden no existe." };
  if (!puedeResolverSolicitud(oc.usuarioId, auth.usuario.id)) {
    return { error: "La persona que creó la orden no puede rechazarla." };
  }
  if (oc.estadoAprobacion !== "PENDIENTE") {
    return { error: "Esta orden no está pendiente de aprobación." };
  }

  const resultado = await prisma.ordenCompra.updateMany({
    where: { id, estadoAprobacion: "PENDIENTE", usuarioId: { not: auth.usuario.id } },
    data: {
      estadoAprobacion: "RECHAZADA",
      aprobadaPor: auth.usuario.nombre,
      aprobadaEn: new Date(),
      motivoRechazo: motivo,
    },
  });
  if (resultado.count !== 1) return { error: "La orden ya fue resuelta por otro usuario." };

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}

// Devolución de un insumo ya recibido a su proveedor (defecto detectado
// después de recibido, no conformidad, etc.). Reduce el stock físico y se
// aplica como crédito contra la cuenta por pagar generada por esa misma
// recepción — el equivalente a una nota de crédito de proveedor.
export async function registrarDevolucionProveedor(
  ordenCompraId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const recepcionCompraDetalleId = String(formData.get("recepcionCompraDetalleId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!recepcionCompraDetalleId) return { error: "Seleccione la línea recibida a devolver." };
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser mayor a 0." };
  }
  if (!motivo) return { error: "El motivo es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const bloqueo = await tx.recepcionCompraDetalle.updateMany({
        where: { id: recepcionCompraDetalleId },
        data: { cantidad: { increment: 0 } },
      });
      if (bloqueo.count !== 1) throw new Error("La línea recibida no existe.");

      const detalle = await tx.recepcionCompraDetalle.findUnique({
        where: { id: recepcionCompraDetalleId },
        include: {
          insumo: true,
          devoluciones: true,
          recepcion: { include: { ordenCompra: { include: { proveedor: true } } } },
        },
      });
      if (!detalle) throw new Error("La línea recibida no existe.");
      if (detalle.recepcion.ordenCompra.id !== ordenCompraId) {
        throw new Error("La línea seleccionada no pertenece a esta orden de compra.");
      }

      const yaDevuelto = detalle.devoluciones.reduce((acc, d) => acc + d.cantidad.toNumber(), 0);
      const maxDevolvible = detalle.cantidad.toNumber() - yaDevuelto;
      if (cantidad > maxDevolvible + 1e-9) {
        throw new Error(
          `Solo puede devolver hasta ${maxDevolvible} de esta línea (ya se devolvieron ${yaDevuelto} de ${detalle.cantidad.toNumber()}).`
        );
      }

      const mov = await registrarMovimiento(tx, {
        tipoItem: "INSUMO",
        insumoId: detalle.insumoId,
        tipoMovimiento: "SALIDA",
        origen: "DEVOLUCION_PROVEEDOR",
        cantidad,
        motivo,
        referencia: `Devolución a ${detalle.recepcion.ordenCompra.proveedor.razonSocial} (recepción ${detalle.recepcion.numero})`,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      if (!mov.ok) throw new Error(mov.error);

      const montoCredito = cantidad * detalle.costoUnitario.toNumber();

      await tx.devolucionCompra.create({
        data: {
          recepcionCompraDetalleId,
          cantidad,
          motivo,
          montoCredito,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Aplica el crédito a la CxP que generó esta misma recepción. Si el
      // crédito supera el saldo pendiente (ya se pagó total o parcial), el
      // saldo baja hasta 0 y el remanente queda como diferencia a favor de
      // XXOil frente al proveedor, a coordinar fuera del sistema.
      const cxp = await tx.cuentaPorPagar.findFirst({
        where: { recepcionCompraId: detalle.recepcion.id },
      });
      if (cxp) {
        const nuevoTotal = Math.max(0, cxp.total.toNumber() - montoCredito);
        const nuevoSaldo = Math.max(0, cxp.saldo.toNumber() - montoCredito);
        const actualizada = await tx.cuentaPorPagar.updateMany({
          where: { id: cxp.id, total: cxp.total, saldo: cxp.saldo, estado: cxp.estado },
          data: {
            total: nuevoTotal,
            saldo: nuevoSaldo,
            estado: nuevoSaldo <= 1e-9 ? "PAGADA" : cxp.estado,
          },
        });
        if (actualizada.count !== 1) {
          throw new Error("La cuenta por pagar cambió durante la devolución. Intente nuevamente.");
        }
      }

      await postearDevolucionCompra(
        tx,
        {
          insumo: detalle.insumo.nombre,
          proveedor: detalle.recepcion.ordenCompra.proveedor.razonSocial,
          cantidad,
          monto: montoCredito,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/logistica/ordenes-compra/${ordenCompraId}`);
  revalidatePath("/inventario/kardex");
  revalidatePath("/finanzas/cuentas-por-pagar");
  return {};
}
