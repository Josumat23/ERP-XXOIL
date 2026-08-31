import type { EstadoDespacho } from "@/generated/prisma/client";
import { postearReversoSalidaMercancia } from "@/lib/contabilidad";
import { registrarMovimiento, type Tx } from "@/lib/inventario";
import { liberarAsignacionesLote } from "@/lib/trazabilidad";

export type AuditoriaReversaDespacho = { usuarioId: string; usuarioNombre: string };

export function validarAnulacionDespacho(estado: EstadoDespacho, tieneFacturaVigente: boolean): string | null {
  if (estado === "ENTREGADO") return "Una entrega confirmada requiere una devolución física; no puede anularse.";
  if (estado === "ANULADO") return "El despacho ya está anulado.";
  if (tieneFacturaVigente) return "Anule primero las facturas vigentes que consumen esta entrega.";
  return null;
}

export async function revertirDespacho(
  tx: Tx,
  guiaId: string,
  motivo: string,
  audit: AuditoriaReversaDespacho
): Promise<{ pedidoId: string | null }> {
  const guia = await tx.guiaRemision.findUnique({
    where: { id: guiaId },
    include: {
      pedido: true,
      detalles: {
        include: {
          pedidoDetalle: true,
          facturaAsignaciones: {
            include: { facturaDetalle: { include: { factura: { select: { estado: true } } } } },
          },
        },
      },
    },
  });
  if (!guia) throw new Error("La guía no existe.");
  const tieneFacturaVigente = guia.detalles.some((detalle) =>
    detalle.facturaAsignaciones.some((asignacion) => asignacion.facturaDetalle.factura.estado !== "ANULADA")
  );
  const errorValidacion = validarAnulacionDespacho(guia.estadoDespacho, tieneFacturaVigente);
  if (errorValidacion) throw new Error(errorValidacion);

  const estadoAnterior = guia.estadoDespacho;
  const reclamo = await tx.guiaRemision.updateMany({
    where: { id: guia.id, estadoDespacho: estadoAnterior },
    data: {
      estadoDespacho: "ANULADO",
      anuladaEn: new Date(),
      anuladaPorId: audit.usuarioId,
      anuladaPorNombre: audit.usuarioNombre,
      motivoAnulacion: motivo,
    },
  });
  if (reclamo.count !== 1) throw new Error("La guía cambió mientras se anulaba. Actualice la página.");

  if (estadoAnterior === "EN_RUTA" && guia.pedido?.requiereEntrega) {
    let costoTotal = 0;
    for (const detalle of guia.detalles) {
      if (!detalle.pedidoDetalle || detalle.pedidoDetalle.pedidoId !== guia.pedido.id) {
        throw new Error("La guía contiene una línea sin origen válido en el pedido.");
      }
      const movimiento = await registrarMovimiento(tx, {
        tipoItem: "PRESENTACION",
        presentacionId: detalle.presentacionId,
        tipoMovimiento: "ENTRADA",
        origen: "REVERSO_ENTREGA",
        cantidad: detalle.cantidad,
        almacenId: guia.pedido.almacenId ?? undefined,
        motivo,
        referencia: `Reverso guía ${guia.numero} (pedido ${guia.pedido.numero})`,
        ...audit,
      });
      if (!movimiento.ok) throw new Error(movimiento.error);
      await tx.presentacion.update({
        where: { id: detalle.presentacionId },
        data: { stockReservado: { increment: detalle.cantidad } },
      });
      const liberado = await liberarAsignacionesLote(tx, {
        guiaDetalleId: detalle.id,
        pedidoDetalleId: detalle.pedidoDetalle.id,
        cantidad: detalle.cantidad,
        motivo: `Reverso guía ${guia.numero}: ${motivo}`,
      });
      if (liberado !== detalle.cantidad) {
        throw new Error("No se pudo revertir la trazabilidad completa de lotes del despacho.");
      }
      costoTotal += detalle.cantidad * detalle.costoUnitario.toNumber();
    }
    await postearReversoSalidaMercancia(
      tx,
      { numeroGuia: guia.numero, pedido: guia.pedido.numero, costoTotal, motivo },
      audit
    );
  }
  if (guia.pedido) {
    await tx.pedido.update({ where: { id: guia.pedido.id }, data: { fulfillmentVersion: { increment: 1 } } });
  }
  return { pedidoId: guia.pedidoId };
}