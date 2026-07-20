"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

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
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

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
    const guia = await prisma.guiaRemision.create({
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
        observaciones,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: {
          create: lineas.map((l) => ({ presentacionId: l.presentacionId, cantidad: l.cantidad })),
        },
      },
    });
    guiaId = guia.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una guía con el número ${numero}.` };
    }
    throw e;
  }

  revalidatePath("/logistica/guias-remision");
  redirect(`/logistica/guias-remision/${guiaId}`);
}
