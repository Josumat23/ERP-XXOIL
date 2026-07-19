"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

// El resultado de calidad es un registro único e inmutable por lote.
// Si se aprueba, el granel queda disponible para envasar.
export async function registrarCalidad(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;

  const loteId = String(formData.get("loteId") ?? "");
  const resultado = String(formData.get("resultado") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (!loteId) return { error: "Falta el lote." };
  if (resultado !== "APROBADO" && resultado !== "RECHAZADO") {
    return { error: "Seleccione el resultado de la evaluación." };
  }
  if (resultado === "RECHAZADO" && !observaciones) {
    return { error: "Al rechazar un lote, las observaciones son obligatorias." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findUnique({
        where: { id: loteId },
        include: { controlCalidad: true },
      });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "PENDIENTE_CALIDAD") {
        throw new Error("El lote no está pendiente de calidad.");
      }
      if (lote.controlCalidad) throw new Error("El lote ya fue evaluado.");

      await tx.controlCalidad.create({
        data: {
          loteGranelId: loteId,
          resultado,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      await tx.loteGranel.update({
        where: { id: loteId },
        data: {
          estado: resultado,
          kgDisponibles: resultado === "APROBADO" ? lote.kgProducidos : 0,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/calidad");
  revalidatePath("/produccion/lotes");
  return {};
}
