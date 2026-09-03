"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { postearAsiento } from "@/lib/contabilidad";
import { normalizarLecturasCalidad, valorCumpleEspecificacion } from "@/lib/planesCalidad";
import { EstadoLote, ResultadoCalidad } from "@/generated/prisma/client";

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
  const resultadoSolicitado = String(formData.get("resultado") ?? "");
  let resultado: ResultadoCalidad = resultadoSolicitado === ResultadoCalidad.RECHAZADO ? ResultadoCalidad.RECHAZADO : ResultadoCalidad.APROBADO;
  const planId = String(formData.get("planId") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const causaId = String(formData.get("causaId") ?? "").trim() || null;
  const causaRaiz = String(formData.get("causaRaiz") ?? "").trim() || null;
  const accionCorrectiva = String(formData.get("accionCorrectiva") ?? "").trim() || null;

  if (!loteId) return { error: "Falta el lote." };
  if (resultadoSolicitado !== ResultadoCalidad.APROBADO && resultadoSolicitado !== ResultadoCalidad.RECHAZADO) {
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
        include: { controlCalidad: true, formula: true },
      });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "PENDIENTE_CALIDAD") {
        throw new Error("El lote no está pendiente de calidad.");
      }
      if (lote.controlCalidad) throw new Error("El lote ya fue evaluado.");

      let planVersion: number | null = null;
      let resultados: { secuencia: number; nombre: string; unidadMedida: string; limiteInferior: number | null; limiteSuperior: number | null; metodoEnsayo: string | null; valorMedido: number; conforme: boolean }[] = [];
      const plan = await tx.planInspeccionCalidad.findFirst({ where: { productoId: lote.formula.productoId, empresaId: auth.usuario.empresaId, activo: true }, include: { caracteristicas: { orderBy: { secuencia: "asc" } } } });
      if (plan && planId !== plan.id) throw new Error("Debe evaluar el lote con el plan de inspección vigente. Actualice la página.");
      if (!plan && planId) throw new Error("El plan de inspección ya no está vigente para este producto. Actualice la página.");
      if (plan) {
        const lecturas = normalizarLecturasCalidad(String(formData.get("lecturas") ?? ""));
        const porId = new Map(lecturas.map(l => [l.caracteristicaId, l.valorMedido]));
        const idsPlan = new Set(plan.caracteristicas.map(c => c.id));
        if (new Set(lecturas.map(l => l.caracteristicaId)).size !== lecturas.length || lecturas.some(l => !idsPlan.has(l.caracteristicaId)) || plan.caracteristicas.some(c => c.obligatoria && !porId.has(c.id))) throw new Error("Las mediciones no corresponden exactamente al plan vigente.");
        resultados = plan.caracteristicas.filter(c => porId.has(c.id)).map(c => {
          const valorMedido = porId.get(c.id);
          if (valorMedido === undefined) throw new Error(`Falta la medición de ${c.nombre}.`);
          const minimo = c.limiteInferior === null ? null : c.limiteInferior.toNumber();
          const maximo = c.limiteSuperior === null ? null : c.limiteSuperior.toNumber();
          return { secuencia: c.secuencia, nombre: c.nombre, unidadMedida: c.unidadMedida, limiteInferior: minimo, limiteSuperior: maximo, metodoEnsayo: c.metodoEnsayo, valorMedido, conforme: valorCumpleEspecificacion(valorMedido, minimo, maximo) };
        });
        resultado = resultados.every(r => r.conforme) ? ResultadoCalidad.APROBADO : ResultadoCalidad.RECHAZADO;
        planVersion = plan.version;
      }
      if (resultado === "RECHAZADO" && !observaciones) throw new Error("Al rechazar un lote, las observaciones son obligatorias.");
      if (resultado === "RECHAZADO" && (!causaId || !accionCorrectiva)) throw new Error("Al rechazar un lote, la causa y la acción correctiva son obligatorias.");

      const reclamo = await tx.loteGranel.updateMany({
        where: { id: loteId, estado: "PENDIENTE_CALIDAD" },
        data: {
          estado: resultado === ResultadoCalidad.APROBADO ? EstadoLote.APROBADO : EstadoLote.RECHAZADO,
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
          planInspeccionId: plan?.id ?? null,
          planVersion,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          resultadosCaracteristica: { create: resultados },
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
