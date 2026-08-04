"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { avanzarSerie } from "@/lib/series";

export type EstadoFormulario = { error?: string };

type LineaGuia = { presentacionId: string; cantidad: number };

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
  const fechaTraslado = String(formData.get("fechaTraslado") ?? "");
  const puntoPartida = String(formData.get("puntoPartida") ?? "").trim();
  const puntoLlegada = String(formData.get("puntoLlegada") ?? "").trim();
  const motivoTraslado = String(formData.get("motivoTraslado") ?? "Venta").trim();
  const transportista = String(formData.get("transportista") ?? "").trim() || null;
  const placaVehiculo = String(formData.get("placaVehiculo") ?? "").trim().toUpperCase() || null;
  const dniConductor = String(formData.get("dniConductor") ?? "").trim() || null;
  const equipoId = String(formData.get("equipoId") ?? "") || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const serieId = String(formData.get("serieId") ?? "") || null;

  let lineas: LineaGuia[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la guía es inválido." };
  }

  if (!numero) return { error: "Ingrese el número de la guía (serie SUNAT)." };
  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!fechaTraslado) return { error: "Indique la fecha de traslado." };
  if (!puntoPartida || !puntoLlegada) {
    return { error: "El punto de partida y el punto de llegada son obligatorios." };
  }
  lineas = lineas.filter((l) => l.presentacionId && Number.isInteger(l.cantidad) && l.cantidad > 0);
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad válida." };
  }

  let guiaId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const guia = await tx.guiaRemision.create({
        data: {
          numero,
          facturaId,
          clienteId,
          // "T00:00:00" fuerza interpretación en hora local (evita el corrimiento de un día)
          fechaTraslado: new Date(`${fechaTraslado}T00:00:00`),
          puntoPartida,
          puntoLlegada,
          motivoTraslado,
          transportista,
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
    throw e;
  }

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

  await prisma.guiaRemision.update({
    where: { id: guiaId },
    data: { estadoDespacho: "EN_RUTA", fechaSalida: new Date() },
  });

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

  await prisma.guiaRemision.update({
    where: { id: guiaId },
    data: { estadoDespacho: "ENTREGADO", fechaEntrega: new Date() },
  });

  revalidatePath("/logistica/guias-remision");
  revalidatePath(`/logistica/guias-remision/${guiaId}`);
  return {};
}
