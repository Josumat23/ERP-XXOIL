"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { avanzarSerie } from "@/lib/series";
import { enviarComprobanteGuiaInterno } from "@/lib/guiasRemision";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { registrarMovimiento } from "@/lib/inventario";
import { asignarLoteVenta } from "@/lib/trazabilidad";
import { postearSalidaMercancia } from "@/lib/contabilidad";
import { revertirDespacho } from "@/lib/reversaDespacho";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export type EstadoFormulario = { error?: string };

type LineaGuia = { pedidoDetalleId?: string; presentacionId: string; cantidad: number };

const MODALIDADES_VALIDAS: $Enums.ModalidadTransporte[] = ["PUBLICO", "PRIVADO"];

// El reenvío manual es una Server Action y debe autorizarse en este límite.
export async function enviarComprobanteGuia(guiaId: string): Promise<void> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) throw new Error(auth.error);
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    throw new Error("Su grupo de seguridad no permite editar registros en Materiales.");
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (await prisma.guiaRemision.count({ where: { id: guiaId, empresaId } }) !== 1) return;

  await enviarComprobanteGuiaInterno(guiaId);
}

// La guía de remisión documenta el traslado (formato SUNAT). No mueve stock:
// el stock salió con la factura; la guía acompaña el transporte.
export async function crearGuiaRemision(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase();
  const pedidoId = String(formData.get("pedidoId") ?? "") || null;
  const facturaId = String(formData.get("facturaId") ?? "") || null;
  const clienteId = String(formData.get("clienteId") ?? "");
  const fechaTraslado = crearFechaCalendarioLocal(String(formData.get("fechaTraslado") ?? ""));
  const puntoPartida = String(formData.get("puntoPartida") ?? "").trim();
  const puntoLlegada = String(formData.get("puntoLlegada") ?? "").trim();
  const ubigeoPartidaId = String(formData.get("ubigeoPartidaId") ?? "") || null;
  const ubigeoLlegadaId = String(formData.get("ubigeoLlegadaId") ?? "") || null;
  const motivoTraslado = String(formData.get("motivoTraslado") ?? "Venta").trim();
  const pesoBrutoTotal = Number(formData.get("pesoBrutoTotal"));
  const modalidadTransporte = String(formData.get("modalidadTransporte") ?? "PRIVADO") as $Enums.ModalidadTransporte;
  const licitacionFleteId = String(formData.get("licitacionFleteId") ?? "").trim() || null;
  let transportistaId = String(formData.get("transportistaId") ?? "").trim() || null;
  let transportista = String(formData.get("transportista") ?? "").trim() || null;
  let transportistaRuc = String(formData.get("transportistaRuc") ?? "").trim() || null;
  const placaVehiculo = String(formData.get("placaVehiculo") ?? "").trim().toUpperCase() || null;
  const dniConductor = String(formData.get("dniConductor") ?? "").trim() || null;
  const equipoId = String(formData.get("equipoId") ?? "") || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const serieId = String(formData.get("serieId") ?? "") || null;

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la guía es inválido." };
  }
  if (!Array.isArray(lineasRaw)) return { error: "El detalle de la guía es inválido." };

  if (!numero) return { error: "Ingrese el número de la guía (serie SUNAT)." };
  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!fechaTraslado) return { error: "Indique una fecha de traslado válida." };
  if (motivoTraslado === "Venta" && !pedidoId) {
    return { error: "Seleccione el pedido de venta que origina la entrega." };
  }
  if (!puntoPartida || !puntoLlegada) {
    return { error: "El punto de partida y el punto de llegada son obligatorios." };
  }
  if (!ubigeoPartidaId || !ubigeoLlegadaId) {
    return { error: "Seleccione el ubigeo de partida y de llegada (obligatorio para SUNAT)." };
  }
  if (!Number.isFinite(pesoBrutoTotal) || pesoBrutoTotal <= 0) {
    return { error: "El peso bruto total (kg) debe ser mayor a 0." };
  }
  if (!MODALIDADES_VALIDAS.includes(modalidadTransporte)) {
    return { error: "Seleccione la modalidad de transporte." };
  }
  // El id del transportista llega del navegador: se relee acotado a la
  // compañía activa, y de la ficha salen la razón social y el RUC. Nunca se
  // persiste lo que el formulario diga de ellos — ese texto termina impreso en
  // la guía y declarado ante SUNAT.
  const empresaIdGuia = await obtenerEmpresaActivaId();

  // Si la guía sale de una licitación, el transportista es el de la oferta
  // ADJUDICADA, no el que venga en el formulario. Adjudicar a uno y despachar
  // con otro vaciaría la licitación entera.
  if (licitacionFleteId) {
    const licitacion = await prisma.licitacionFlete.findFirst({
      where: { id: licitacionFleteId, empresaId: empresaIdGuia, estado: "ADJUDICADA" },
      select: { ofertas: { where: { estado: "ADJUDICADA" }, select: { transportistaId: true } } },
    });
    if (!licitacion) {
      return { error: "La licitación no pertenece a la compañía activa o no está adjudicada." };
    }
    const ganadora = licitacion.ofertas[0];
    if (!ganadora) return { error: "La licitación no tiene una oferta adjudicada." };
    transportistaId = ganadora.transportistaId;
  }

  if (transportistaId) {
    const ficha = await prisma.transportista.findFirst({
      where: { id: transportistaId, empresaId: empresaIdGuia, activo: true },
      select: { razonSocial: true, ruc: true },
    });
    if (!ficha) {
      return { error: "El transportista no pertenece a la compañía activa o está desactivado." };
    }
    transportista = ficha.razonSocial;
    transportistaRuc = ficha.ruc;
  }
  if (modalidadTransporte === "PUBLICO" && !transportistaRuc) {
    return {
      error: transportistaId
        ? "El transportista elegido no tiene RUC registrado y el transporte público lo exige. Complételo en Logística → Transportistas."
        : "El RUC del transportista es obligatorio en transporte público.",
    };
  }
  if (modalidadTransporte === "PRIVADO" && (!placaVehiculo || !dniConductor)) {
    return { error: "La placa del vehículo y el DNI del conductor son obligatorios en transporte privado." };
  }

  const lineas: LineaGuia[] = [];
  const claves = new Set<string>();
  for (const candidata of lineasRaw) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("presentacionId" in candidata) ||
      !("cantidad" in candidata) ||
      typeof candidata.presentacionId !== "string" ||
      typeof candidata.cantidad !== "number" ||
      !candidata.presentacionId ||
      !Number.isInteger(candidata.cantidad) ||
      candidata.cantidad <= 0
    ) continue;
    const pedidoDetalleId =
      "pedidoDetalleId" in candidata && typeof candidata.pedidoDetalleId === "string"
        ? candidata.pedidoDetalleId || undefined
        : undefined;
    const clave = pedidoDetalleId ?? candidata.presentacionId;
    if (claves.has(clave)) return { error: "Cada línea de origen debe aparecer una sola vez." };
    claves.add(clave);
    lineas.push({ pedidoDetalleId, presentacionId: candidata.presentacionId, cantidad: candidata.cantidad });
  }
  if (lineas.length === 0) return { error: "Agregue al menos una línea con cantidad válida." };
  const empresaId = await obtenerEmpresaActivaId();

  let guiaId = "";
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.cliente.count({ where: { id: clienteId, empresaId, activo: true } }) !== 1) throw new Error("El cliente no pertenece a la empresa activa.");
      if (await tx.presentacion.count({ where: { id: { in: lineas.map((linea) => linea.presentacionId) }, empresaId, activo: true } }) !== lineas.length) throw new Error("Una presentación no pertenece a la empresa activa.");
      if (equipoId && await tx.equipo.count({ where: { id: equipoId, empresaId, activo: true } }) !== 1) throw new Error("El equipo no pertenece a la empresa activa.");
      if (pedidoId) {
        const pedido = await tx.pedido.findFirst({
          where: { id: pedidoId, empresaId },
          include: {
            detalles: {
              include: {
                guiaDetalles: { select: { cantidad: true, guia: { select: { estadoDespacho: true } } } },
              },
            },
          },
        });
        if (!pedido || pedido.estado === "ANULADO") throw new Error("El pedido no existe o está anulado.");
        if (pedido.clienteId !== clienteId) throw new Error("El pedido pertenece a otro cliente.");
        if (!pedido.requiereEntrega) {
          throw new Error("Este pedido histórico usa el flujo de guía posterior a factura.");
        }
        const reclamoPedido = await tx.pedido.updateMany({
          where: { id: pedido.id, empresaId, fulfillmentVersion: pedido.fulfillmentVersion },
          data: { fulfillmentVersion: { increment: 1 } },
        });
        if (reclamoPedido.count !== 1) {
          throw new Error("El saldo de entrega cambió. Actualice la página e intente nuevamente.");
        }
        const porId = new Map(pedido.detalles.map((detalle) => [detalle.id, detalle]));
        for (const linea of lineas) {
          if (!linea.pedidoDetalleId) throw new Error("La entrega requiere la línea exacta del pedido.");
          const detalle = porId.get(linea.pedidoDetalleId);
          if (!detalle || detalle.presentacionId !== linea.presentacionId) {
            throw new Error("La entrega contiene una línea que no pertenece al pedido.");
          }
          const planificado = detalle.guiaDetalles
            .filter((gd) => gd.guia.estadoDespacho !== "ANULADO")
            .reduce((total, gd) => total + gd.cantidad, 0);
          const disponible = detalle.cantidad - planificado;
          if (linea.cantidad > disponible) {
            throw new Error(`La cantidad supera las ${disponible} unidad(es) pendientes de entrega.`);
          }
        }
        if (facturaId) {
          const factura = await tx.factura.findFirst({
            where: { id: facturaId, empresaId, pedidoId: pedido.id, estado: { not: "ANULADA" } },
          });
          if (!factura) throw new Error("La factura de referencia no pertenece al pedido o está anulada.");
        }
      } else if (facturaId) {
        const factura = await tx.factura.findFirst({
          where: { id: facturaId, empresaId, clienteId, estado: { not: "ANULADA" } },
        });
        if (!factura) throw new Error("La factura asociada no existe, está anulada o pertenece a otro cliente.");
      }

      const guia = await tx.guiaRemision.create({
        data: {
          numero,
          empresaId,
          pedidoId,
          facturaId,
          clienteId,
          fechaTraslado,
          puntoPartida,
          puntoLlegada,
          ubigeoPartidaId,
          ubigeoLlegadaId,
          motivoTraslado,
          pesoBrutoTotal,
          modalidadTransporte,
          transportistaId,
          licitacionFleteId,
          transportista,
          transportistaRuc,
          placaVehiculo,
          dniConductor,
          equipoId,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: lineas.map((linea) => ({
              pedidoDetalleId: linea.pedidoDetalleId,
              presentacionId: linea.presentacionId,
              cantidad: linea.cantidad,
            })),
          },
        },
      });
      guiaId = guia.id;
      await avanzarSerie(tx, serieId, empresaId);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una guía con el número ${numero}.` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  await enviarComprobanteGuiaInterno(guiaId);
  revalidatePath("/logistica/guias-remision");
  revalidatePath("/comercial/pedidos");
  redirect(`/logistica/guias-remision/${guiaId}`);
}
// Avance del estado de ejecución del despacho (flota propia): visibilidad
// de qué guía ya salió y cuál ya se entregó, sin necesitar GPS ni
// integración con terceros.
export async function marcarSalidaGuia(guiaId: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const guia = await tx.guiaRemision.findFirst({
        where: { id: guiaId, empresaId },
        include: {
          pedido: true,
          detalles: { include: { pedidoDetalle: true, presentacion: true } },
        },
      });
      if (!guia) throw new Error("La guía no existe.");
      if (guia.estadoDespacho !== "PLANIFICADO") {
        throw new Error("Esta guía ya no está planificada.");
      }

      const reclamo = await tx.guiaRemision.updateMany({
        where: { id: guiaId, empresaId, estadoDespacho: "PLANIFICADO" },
        data: { estadoDespacho: "EN_RUTA", fechaSalida: new Date() },
      });
      if (reclamo.count !== 1) {
        throw new Error("La guía cambió mientras se marcaba la salida. Actualice la página e intente nuevamente.");
      }

      if (guia.pedido?.requiereEntrega) {
        let costoTotal = 0;
        for (const detalle of guia.detalles) {
          if (!detalle.pedidoDetalle || detalle.pedidoDetalle.pedidoId !== guia.pedido.id) {
            throw new Error("La guía contiene una línea sin origen válido en el pedido.");
          }
          const movimiento = await registrarMovimiento(tx, {
            tipoItem: "PRESENTACION",
            presentacionId: detalle.presentacionId,
            tipoMovimiento: "SALIDA",
            origen: "VENTA",
            cantidad: detalle.cantidad,
            almacenId: guia.pedido.almacenId ?? undefined,
            referencia: `Guía ${guia.numero} (pedido ${guia.pedido.numero})`,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          });
          if (!movimiento.ok) throw new Error(movimiento.error);

          const reserva = await tx.presentacion.updateMany({
            where: { id: detalle.presentacionId, empresaId, stockReservado: { gte: detalle.cantidad } },
            data: { stockReservado: { decrement: detalle.cantidad } },
          });
          if (reserva.count !== 1) {
            throw new Error("La reserva de stock cambió antes del despacho. Actualice la página.");
          }
          await tx.guiaRemisionDetalle.update({
            where: { id: detalle.id },
            data: { costoUnitario: detalle.presentacion.costoPromedio },
          });
          costoTotal += detalle.cantidad * detalle.presentacion.costoPromedio.toNumber();
          await asignarLoteVenta(tx, {
            guiaDetalleId: detalle.id,
            pedidoDetalleId: detalle.pedidoDetalle.id,
            presentacionId: detalle.presentacionId,
            cantidad: detalle.cantidad,
          });
        }
        await postearSalidaMercancia(
          tx,
          { numeroGuia: guia.numero, pedido: guia.pedido.numero, costoTotal },
          { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre, empresaId: guia.empresaId }
        );
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  revalidatePath("/comercial/pedidos");
  return {};
}
export async function anularDespachoGuia(
  guiaId: string,
  motivo: string
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }
  const motivoNormalizado = motivo.trim();
  if (motivoNormalizado.length < 10) {
    return { error: "Explique el motivo de la anulación con al menos 10 caracteres." };
  }
  const empresaId = await obtenerEmpresaActivaId();
  if (await prisma.guiaRemision.count({ where: { id: guiaId, empresaId } }) !== 1) return { error: "La guía no pertenece a la empresa activa." };

  let pedidoId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const resultado = await revertirDespacho(tx, guiaId, motivoNormalizado, {
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      });
      pedidoId = resultado.pedidoId;
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  revalidatePath("/comercial/pedidos");
  if (pedidoId) revalidatePath(`/comercial/pedidos/${pedidoId}`);
  return {};
}
export async function marcarEntregaGuia(guiaId: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }
  const empresaId = await obtenerEmpresaActivaId();

  const guia = await prisma.guiaRemision.findFirst({ where: { id: guiaId, empresaId } });
  if (!guia) return { error: "La guía no existe." };
  if (guia.estadoDespacho !== "EN_RUTA") {
    return { error: "Esta guía todavía no salió a ruta." };
  }

  const resultado = await prisma.guiaRemision.updateMany({
    where: { id: guiaId, empresaId, estadoDespacho: "EN_RUTA" },
    data: { estadoDespacho: "ENTREGADO", fechaEntrega: new Date() },
  });
  if (resultado.count !== 1) {
    return { error: "La gu\u00eda cambi\u00f3 mientras se marcaba la entrega. Actualice la p\u00e1gina e intente nuevamente." };
  }

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  return {};
}
