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

export type EstadoFormulario = { error?: string };

type LineaGuia = { presentacionId: string; cantidad: number };

const MODALIDADES_VALIDAS: $Enums.ModalidadTransporte[] = ["PUBLICO", "PRIVADO"];

// El reenvío manual es una Server Action y debe autorizarse en este límite.
export async function enviarComprobanteGuia(guiaId: string): Promise<void> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) throw new Error(auth.error);
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    throw new Error("Su grupo de seguridad no permite editar registros en Materiales.");
  }

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
  const facturaId = String(formData.get("facturaId") ?? "") || null;
  const clienteId = String(formData.get("clienteId") ?? "");
  const fechaTrasladoRaw = String(formData.get("fechaTraslado") ?? "");
  const fechaTraslado = crearFechaCalendarioLocal(fechaTrasladoRaw);
  const puntoPartida = String(formData.get("puntoPartida") ?? "").trim();
  const puntoLlegada = String(formData.get("puntoLlegada") ?? "").trim();
  const ubigeoPartidaId = String(formData.get("ubigeoPartidaId") ?? "") || null;
  const ubigeoLlegadaId = String(formData.get("ubigeoLlegadaId") ?? "") || null;
  const motivoTraslado = String(formData.get("motivoTraslado") ?? "Venta").trim();
  const pesoBrutoTotal = Number(formData.get("pesoBrutoTotal"));
  const modalidadTransporte = String(formData.get("modalidadTransporte") ?? "PRIVADO") as $Enums.ModalidadTransporte;
  const transportista = String(formData.get("transportista") ?? "").trim() || null;
  const transportistaRuc = String(formData.get("transportistaRuc") ?? "").trim() || null;
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
  if (!Array.isArray(lineasRaw)) {
    return { error: "El detalle de la guía es inválido." };
  }

  if (!numero) return { error: "Ingrese el número de la guía (serie SUNAT)." };
  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!fechaTraslado) return { error: "Indique una fecha de traslado válida." };
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
  if (modalidadTransporte === "PUBLICO" && !transportistaRuc) {
    return { error: "El RUC del transportista es obligatorio en transporte público." };
  }
  if (modalidadTransporte === "PRIVADO" && (!placaVehiculo || !dniConductor)) {
    return { error: "La placa del vehículo y el DNI del conductor son obligatorios en transporte privado." };
  }
  const cantidadesPorPresentacion = new Map<string, number>();
  for (const linea of lineasRaw) {
    if (
      typeof linea !== "object" ||
      linea === null ||
      !("presentacionId" in linea) ||
      !("cantidad" in linea) ||
      typeof linea.presentacionId !== "string" ||
      typeof linea.cantidad !== "number" ||
      !linea.presentacionId ||
      !Number.isInteger(linea.cantidad) ||
      linea.cantidad <= 0
    ) {
      continue;
    }
    cantidadesPorPresentacion.set(
      linea.presentacionId,
      (cantidadesPorPresentacion.get(linea.presentacionId) ?? 0) + linea.cantidad
    );
  }
  const lineas: LineaGuia[] = [...cantidadesPorPresentacion].map(
    ([presentacionId, cantidad]) => ({ presentacionId, cantidad })
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad válida." };
  }

  let guiaId = "";
  try {
    await prisma.$transaction(async (tx) => {
      if (facturaId) {
        // Reclama una factura vigente antes de vincularla. La validación en
        // servidor no depende del autocompletado manipulable del formulario.
        const reclamoFactura = await tx.factura.updateMany({
          where: { id: facturaId, estado: { not: "ANULADA" } },
          data: { saldo: { increment: 0 } },
        });
        if (reclamoFactura.count !== 1) {
          throw new Error("La factura asociada no existe o está anulada.");
        }

        const factura = await tx.factura.findUnique({
          where: { id: facturaId },
          select: {
            clienteId: true,
            pedido: {
              select: { detalles: { select: { presentacionId: true, cantidad: true } } },
            },
            guias: {
              select: { detalles: { select: { presentacionId: true, cantidad: true } } },
            },
          },
        });
        if (!factura || factura.clienteId !== clienteId) {
          throw new Error("La factura asociada pertenece a otro cliente.");
        }

        const facturadoPorPresentacion = new Map<string, number>();
        for (const detalle of factura.pedido.detalles) {
          facturadoPorPresentacion.set(
            detalle.presentacionId,
            (facturadoPorPresentacion.get(detalle.presentacionId) ?? 0) + detalle.cantidad
          );
        }
        const guiadoPorPresentacion = new Map<string, number>();
        for (const guiaPrevia of factura.guias) {
          for (const detalle of guiaPrevia.detalles) {
            guiadoPorPresentacion.set(
              detalle.presentacionId,
              (guiadoPorPresentacion.get(detalle.presentacionId) ?? 0) + detalle.cantidad
            );
          }
        }
        for (const linea of lineas) {
          const facturado = facturadoPorPresentacion.get(linea.presentacionId) ?? 0;
          const guiado = guiadoPorPresentacion.get(linea.presentacionId) ?? 0;
          const disponible = facturado - guiado;
          if (facturado === 0) {
            throw new Error("La guía contiene una presentación que no pertenece a la factura.");
          }
          if (linea.cantidad > disponible) {
            throw new Error(
              `La cantidad de una presentación supera las ${disponible} unidad(es) pendientes de guía.`
            );
          }
        }
      }
      const guia = await tx.guiaRemision.create({
        data: {
          numero,
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
          transportista,
          transportistaRuc,
          placaVehiculo,
          dniConductor,
          equipoId,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: lineas.map((l) => ({ presentacionId: l.presentacionId, cantidad: l.cantidad })),
          },
        },
      });
      guiaId = guia.id;
      await avanzarSerie(tx, serieId);
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

  const guia = await prisma.guiaRemision.findUnique({ where: { id: guiaId } });
  if (!guia) return { error: "La guía no existe." };
  if (guia.estadoDespacho !== "PLANIFICADO") {
    return { error: "Esta guía ya no está planificada." };
  }

  const resultado = await prisma.guiaRemision.updateMany({
    where: { id: guiaId, estadoDespacho: "PLANIFICADO" },
    data: { estadoDespacho: "EN_RUTA", fechaSalida: new Date() },
  });
  if (resultado.count !== 1) {
    return { error: "La gu\u00eda cambi\u00f3 mientras se marcaba la salida. Actualice la p\u00e1gina e intente nuevamente." };
  }

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  return {};
}

export async function marcarEntregaGuia(guiaId: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const guia = await prisma.guiaRemision.findUnique({ where: { id: guiaId } });
  if (!guia) return { error: "La guía no existe." };
  if (guia.estadoDespacho !== "EN_RUTA") {
    return { error: "Esta guía todavía no salió a ruta." };
  }

  const resultado = await prisma.guiaRemision.updateMany({
    where: { id: guiaId, estadoDespacho: "EN_RUTA" },
    data: { estadoDespacho: "ENTREGADO", fechaEntrega: new Date() },
  });
  if (resultado.count !== 1) {
    return { error: "La gu\u00eda cambi\u00f3 mientras se marcaba la entrega. Actualice la p\u00e1gina e intente nuevamente." };
  }

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  return {};
}
