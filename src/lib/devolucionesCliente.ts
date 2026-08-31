import type { DecisionDevolucionCliente, Prisma } from "@/generated/prisma/client";
import { postearReingresoDevolucionCliente } from "@/lib/contabilidad";
import { registrarMovimiento, type Tx } from "@/lib/inventario";
import { liberarAsignacionesLote } from "@/lib/trazabilidad";

export type AuditoriaDevolucion = { usuarioId: string; usuarioNombre: string };
export type LineaRecepcionDevolucion = { facturaDetalleId: string; cantidad: number };

export function calcularSaldoAcreditableDevolucion(cantidadAcreditable: number, cantidadesAcreditadas: readonly number[]): number {
  return cantidadAcreditable - cantidadesAcreditadas.reduce((total, cantidad) => total + cantidad, 0);
}

function enteroNoNegativo(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0;
}

export async function crearDocumentoDevolucion(
  tx: Tx,
  params: {
    numero: string;
    facturaId: string;
    almacenId: string;
    motivo: string;
    lineas: readonly LineaRecepcionDevolucion[];
    audit: AuditoriaDevolucion;
  }
): Promise<string> {
  const bloqueo = await tx.factura.updateMany({
    where: { id: params.facturaId, estado: { not: "ANULADA" } },
    data: { saldo: { increment: 0 } },
  });
  if (bloqueo.count !== 1) throw new Error("La factura no existe o está anulada.");
  const factura = await tx.factura.findUniqueOrThrow({
    where: { id: params.facturaId },
    include: { detalles: true },
  });
  const almacen = await tx.almacen.findFirst({ where: { id: params.almacenId, activo: true } });
  if (!almacen) throw new Error("Seleccione un almacén activo para la recepción bloqueada.");
  if (!params.numero.trim()) throw new Error("Ingrese el número interno de devolución.");
  if (params.motivo.trim().length < 10) throw new Error("Explique el motivo con al menos 10 caracteres.");
  if (params.lineas.length === 0) throw new Error("Ingrese al menos una línea devuelta.");

  const ids = new Set<string>();
  for (const linea of params.lineas) {
    if (ids.has(linea.facturaDetalleId)) throw new Error("Cada línea de factura debe aparecer una sola vez.");
    ids.add(linea.facturaDetalleId);
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error("Las cantidades devueltas deben ser enteros mayores a cero.");
    }
  }
  const porId = new Map(factura.detalles.map((detalle) => [detalle.id, detalle]));
  const previas = await tx.devolucionClienteDetalle.findMany({
    where: { facturaDetalle: { facturaId: factura.id } },
  });
  const netoRecibido = new Map<string, number>();
  for (const previa of previas) {
    netoRecibido.set(
      previa.facturaDetalleId,
      (netoRecibido.get(previa.facturaDetalleId) ?? 0) + previa.cantidad - previa.cantidadDevolverCliente
    );
  }
  for (const linea of params.lineas) {
    const detalle = porId.get(linea.facturaDetalleId);
    if (!detalle) throw new Error("Una línea no pertenece a la factura indicada.");
    const disponible = detalle.cantidad - (netoRecibido.get(detalle.id) ?? 0);
    if (linea.cantidad > disponible) {
      throw new Error(`Solo quedan ${disponible} unidad(es) por recibir de una línea.`);
    }
  }

  const documento = await tx.devolucionCliente.create({
    data: {
      numero: params.numero.trim().toUpperCase(),
      empresaId: factura.empresaId,
      facturaId: factura.id,
      almacenId: almacen.id,
      motivo: params.motivo.trim(),
      ...params.audit,
      detalles: {
        create: params.lineas.map((linea) => ({
          facturaDetalleId: linea.facturaDetalleId,
          cantidad: linea.cantidad,
        })),
      },
    },
  });
  return documento.id;
}

type FacturaDetalleConOrigen = Prisma.FacturaDetalleGetPayload<{
  include: { entregas: true };
}>;

async function liberarDesdeOrigen(
  tx: Tx,
  detalle: FacturaDetalleConOrigen,
  devolucionDetalleId: string,
  cantidad: number,
  restaurarDisponible: boolean,
  motivo: string
): Promise<void> {
  if (cantidad <= 0) return;
  let restante = cantidad;
  if (detalle.entregas.length === 0) {
    restante -= await liberarAsignacionesLote(tx, {
      facturaDetalleId: detalle.id,
      devolucionDetalleId,
      pedidoDetalleId: detalle.pedidoDetalleId,
      cantidad: restante,
      restaurarDisponible,
      motivo,
    });
  } else {
    for (const entrega of detalle.entregas) {
      if (restante <= 0) break;
      restante -= await liberarAsignacionesLote(tx, {
        facturaDetalleId: detalle.id,
        guiaDetalleId: entrega.guiaDetalleId,
        devolucionDetalleId,
        pedidoDetalleId: detalle.pedidoDetalleId,
        cantidad: restante,
        restaurarDisponible,
        motivo,
      });
    }
  }
  if (restante > 0) throw new Error("No se pudo identificar el lote físico completo de la devolución.");
}

export async function inspeccionarDetalleDevolucion(
  tx: Tx,
  params: {
    detalleId: string;
    cantidadReingreso: number;
    cantidadDesecho: number;
    cantidadDevolverCliente: number;
    cantidadAcreditable: number;
    observacion: string;
    audit: AuditoriaDevolucion;
  }
): Promise<{ devolucionId: string; facturaId: string }> {
  const cantidades = [
    params.cantidadReingreso,
    params.cantidadDesecho,
    params.cantidadDevolverCliente,
    params.cantidadAcreditable,
  ];
  if (!cantidades.every(enteroNoNegativo)) throw new Error("Las cantidades de inspección deben ser enteros no negativos.");
  if (params.observacion.trim().length < 5) throw new Error("Registre una observación de calidad de al menos 5 caracteres.");

  const detalle = await tx.devolucionClienteDetalle.findUnique({
    where: { id: params.detalleId },
    include: {
      devolucion: { include: { factura: true } },
      facturaDetalle: { include: { entregas: true } },
    },
  });
  if (!detalle) throw new Error("La línea de devolución no existe.");
  if (detalle.decision !== "PENDIENTE") throw new Error("La línea ya tiene una decisión de calidad.");
  const totalDecision = params.cantidadReingreso + params.cantidadDesecho + params.cantidadDevolverCliente;
  if (totalDecision !== detalle.cantidad) throw new Error("La disposición debe sumar exactamente la cantidad recibida.");
  if (params.cantidadAcreditable > params.cantidadReingreso + params.cantidadDesecho) {
    throw new Error("No se puede acreditar mercadería que será devuelta físicamente al cliente.");
  }

  const decisionesActivas = [params.cantidadReingreso, params.cantidadDesecho, params.cantidadDevolverCliente]
    .filter((cantidad) => cantidad > 0).length;
  const decision: DecisionDevolucionCliente = decisionesActivas > 1
    ? "MIXTA"
    : params.cantidadReingreso > 0
      ? "REINGRESO_STOCK"
      : params.cantidadDesecho > 0
        ? "DESECHO"
        : "DEVOLVER_CLIENTE";
  const reclamo = await tx.devolucionClienteDetalle.updateMany({
    where: { id: detalle.id, decision: "PENDIENTE" },
    data: {
      decision,
      cantidadReingreso: params.cantidadReingreso,
      cantidadDesecho: params.cantidadDesecho,
      cantidadDevolverCliente: params.cantidadDevolverCliente,
      cantidadAcreditable: params.cantidadAcreditable,
      observacionCalidad: params.observacion.trim(),
      inspeccionadaEn: new Date(),
      inspeccionadaPorId: params.audit.usuarioId,
      inspeccionadaPorNombre: params.audit.usuarioNombre,
    },
  });
  if (reclamo.count !== 1) throw new Error("La línea cambió mientras se inspeccionaba. Actualice la página.");

  const motivoLote = `Devolución ${detalle.devolucion.numero}: ${params.observacion.trim()}`;
  await liberarDesdeOrigen(
    tx,
    detalle.facturaDetalle,
    detalle.id,
    params.cantidadReingreso,
    true,
    motivoLote
  );
  await liberarDesdeOrigen(
    tx,
    detalle.facturaDetalle,
    detalle.id,
    params.cantidadDesecho,
    false,
    motivoLote
  );

  if (params.cantidadReingreso > 0) {
    const movimiento = await registrarMovimiento(tx, {
      tipoItem: "PRESENTACION",
      presentacionId: detalle.facturaDetalle.presentacionId,
      tipoMovimiento: "ENTRADA",
      origen: "DEVOLUCION_CLIENTE",
      cantidad: params.cantidadReingreso,
      almacenId: detalle.devolucion.almacenId,
      motivo: params.observacion.trim(),
      referencia: `Devolución ${detalle.devolucion.numero} / factura ${detalle.devolucion.factura.numero}`,
      ...params.audit,
    });
    if (!movimiento.ok) throw new Error(movimiento.error);
    await postearReingresoDevolucionCliente(
      tx,
      {
        numeroDevolucion: detalle.devolucion.numero,
        factura: detalle.devolucion.factura.numero,
        costoTotal: params.cantidadReingreso * detalle.facturaDetalle.costoUnitario.toNumber(),
      },
      params.audit
    );
  }

  const pendientes = await tx.devolucionClienteDetalle.count({
    where: { devolucionId: detalle.devolucionId, decision: "PENDIENTE" },
  });
  if (pendientes === 0) {
    await tx.devolucionCliente.update({
      where: { id: detalle.devolucionId },
      data: {
        estado: "CERRADA",
        cerradoEn: new Date(),
        cerradoPorId: params.audit.usuarioId,
        cerradoPorNombre: params.audit.usuarioNombre,
      },
    });
  }
  return { devolucionId: detalle.devolucionId, facturaId: detalle.devolucion.facturaId };
}
