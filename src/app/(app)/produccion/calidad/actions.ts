"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { postearAsiento } from "@/lib/contabilidad";

export type EstadoFormulario = { error?: string };

// El resultado de calidad es un registro único e inmutable por lote.
// Si se aprueba, el granel queda disponible para envasar.
export async function registrarCalidad(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const loteId = String(formData.get("loteId") ?? "");
  const resultado = String(formData.get("resultado") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const causaId = String(formData.get("causaId") ?? "").trim() || null;
  const causaRaiz = String(formData.get("causaRaiz") ?? "").trim() || null;
  const accionCorrectiva = String(formData.get("accionCorrectiva") ?? "").trim() || null;

  if (!loteId) return { error: "Falta el lote." };
  if (resultado !== "APROBADO" && resultado !== "RECHAZADO") {
    return { error: "Seleccione el resultado de la evaluación." };
  }
  if (resultado === "RECHAZADO" && !observaciones) {
    return { error: "Al rechazar un lote, las observaciones son obligatorias." };
  }
  if (resultado === "RECHAZADO" && (!causaId || !accionCorrectiva)) {
    return { error: "Al rechazar un lote, la causa y la acción correctiva son obligatorias." };
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

      const reclamo = await tx.loteGranel.updateMany({
        where: { id: loteId, estado: "PENDIENTE_CALIDAD" },
        data: {
          estado: resultado,
          kgDisponibles: resultado === "APROBADO" ? lote.kgProducidos : 0,
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("El lote cambi\u00f3 mientras se evaluaba. Actualice la p\u00e1gina e intente nuevamente.");
      }

      await tx.controlCalidad.create({
        data: {
          loteGranelId: loteId,
          resultado,
          observaciones,
          causaId,
          causaRaiz,
          accionCorrectiva,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
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
export async function desecharLote(
  loteId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite disponer lotes rechazados." };
  }
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 10) return { error: "Describa el motivo del descarte (mínimo 10 caracteres)." };

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findUnique({ where: { id: loteId } });
      if (!lote || lote.estado !== "RECHAZADO") throw new Error("El lote no está rechazado.");
      if (lote.disposicionRechazo) throw new Error("El lote rechazado ya tiene una disposición final.");
      const reclamo = await tx.loteGranel.updateMany({
        where: { id: loteId, estado: "RECHAZADO", disposicionRechazo: null },
        data: {
          disposicionRechazo: "DESECHADO",
          motivoDisposicion: motivo,
          fechaDisposicion: new Date(),
          usuarioDisposicionId: auth.usuario.id,
          usuarioDisposicionNombre: auth.usuario.nombre,
        },
      });
      if (reclamo.count !== 1) throw new Error("El lote fue dispuesto por otro usuario.");
      const costo = lote.costoInsumos.toNumber() + lote.costoReproceso.toNumber() + lote.costoManoObra.toNumber();
      if (costo > 0) {
        await postearAsiento(tx, {
          origen: "DESECHO_PRODUCCION",
          glosa: `Descarte del lote rechazado ${lote.codigo}: ${motivo}`,
          referencia: lote.codigo,
          lineas: [
            { clave: "PERDIDA_PRODUCCION", debe: costo },
            { clave: "WIP_PRODUCCION", haber: costo },
          ],
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
  revalidatePath("/produccion/lotes");
  revalidatePath(`/produccion/lotes/${loteId}`);
  revalidatePath("/produccion/calidad");
  return {};
}
