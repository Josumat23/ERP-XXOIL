"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { EstadoNoConformidad } from "@/generated/prisma/client";
import { esValorEnum } from "@/lib/enums";
import { transicionCapaPermitida } from "@/lib/noConformidades";
export type EstadoCapaFormulario = { error?: string };
export async function actualizarCapa(id: string, _prev: EstadoCapaFormulario, formData: FormData): Promise<EstadoCapaFormulario> {
  const auth = await requerirRol(["PRODUCCION"]); if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return { error: "No tiene permiso para gestionar no conformidades." };
  const estado = String(formData.get("estado") ?? "");
  if (!esValorEnum(Object.values(EstadoNoConformidad), estado)) return { error: "Estado CAPA inválido." };
  const comentario = String(formData.get("comentario") ?? "").trim();
  const contencionInmediata = String(formData.get("contencionInmediata") ?? "").trim() || null;
  const causaRaizConfirmada = String(formData.get("causaRaizConfirmada") ?? "").trim() || null;
  const accionCorrectiva = String(formData.get("accionCorrectiva") ?? "").trim() || null;
  const responsableId = String(formData.get("responsableId") ?? "").trim() || null;
  const fechaTexto = String(formData.get("fechaCompromiso") ?? "");
  const verificacionEficacia = String(formData.get("verificacionEficacia") ?? "").trim() || null;
  const eficaz = formData.get("eficaz") === "SI" ? true : formData.get("eficaz") === "NO" ? false : null;
  if (comentario.length < 5) return { error: "Documente el motivo del cambio de etapa." };
  try { await prisma.$transaction(async tx => {
    const actual = await tx.noConformidadCalidad.findFirst({ where: { id, empresaId: auth.usuario.empresaId } });
    if (!actual) throw new Error("La no conformidad no existe.");
    if (!transicionCapaPermitida(actual.estado, estado)) throw new Error("La transición CAPA no está permitida.");
    const responsable = responsableId ? await tx.usuario.findFirst({ where: { id: responsableId, empresaId: auth.usuario.empresaId, activo: true } }) : null;
    const causaFinal = causaRaizConfirmada ?? actual.causaRaizConfirmada;
    const accionFinal = accionCorrectiva ?? actual.accionCorrectiva;
    const responsableFinalId = responsable?.id ?? actual.responsableId;
    const fechaFinal = fechaTexto ? new Date(`${fechaTexto}T12:00:00`) : actual.fechaCompromiso;
    const verificacionFinal = verificacionEficacia ?? actual.verificacionEficacia;
    const eficazFinal = eficaz ?? actual.eficaz;
    if (estado !== EstadoNoConformidad.INVESTIGACION && (!causaFinal || !accionFinal || !responsableFinalId)) throw new Error("Para avanzar, confirme causa raíz, acción y responsable.");
    if (estado === EstadoNoConformidad.IMPLEMENTACION && !fechaFinal) throw new Error("Defina una fecha de compromiso.");
    if (estado === EstadoNoConformidad.CERRADA && (!verificacionFinal || eficazFinal !== true)) throw new Error("Solo puede cerrar con verificación documentada y eficaz.");
    await tx.noConformidadCalidad.update({ where: { id }, data: { estado, contencionInmediata: contencionInmediata ?? actual.contencionInmediata, causaRaizConfirmada: causaFinal, accionCorrectiva: accionFinal, responsableId: responsableFinalId, responsableNombre: responsable?.nombre ?? actual.responsableNombre, fechaCompromiso: fechaFinal, verificacionEficacia: verificacionFinal, eficaz: eficazFinal, cerradoEn: estado === EstadoNoConformidad.CERRADA ? new Date() : null, eventos: { create: { estadoAnterior: actual.estado, estadoNuevo: estado, comentario, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre } } } });
  }); } catch (e) { return { error: e instanceof Error ? e.message : "No se pudo actualizar." }; }
  revalidatePath("/produccion/calidad/no-conformidades"); revalidatePath(`/produccion/calidad/no-conformidades/${id}`); return {};
}
