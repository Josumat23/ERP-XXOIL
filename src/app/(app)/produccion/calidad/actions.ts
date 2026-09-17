"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { postearAsiento } from "@/lib/contabilidad";
import { densidadMedida, normalizarLecturasCalidad, resultadosDelEnsayo } from "@/lib/planesCalidad";
import { EstadoLote, ResultadoCalidad } from "@/generated/prisma/client";
import { controlAlLiberar, respaldoDeMedicion } from "@/lib/calibracion";

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
      const lote = await tx.loteGranel.findFirst({
        where: { id: loteId, empresaId: auth.usuario.empresaId },
        include: { controlCalidad: true, formula: true },
      });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "PENDIENTE_CALIDAD") {
        throw new Error("El lote no está pendiente de calidad.");
      }
      if (lote.controlCalidad) throw new Error("El lote ya fue evaluado.");
      if (causaId) {
        const causa = await tx.causaCalidad.findFirst({
          where: { id: causaId, empresaId: auth.usuario.empresaId, activo: true },
          select: { id: true },
        });
        if (!causa) throw new Error("La causa no pertenece a la empresa activa.");
      }

      let planVersion: number | null = null;
      // La densidad que el laboratorio midió en este ensayo, cuando el plan
      // declara cuál de sus características lo es. Gobierna la conversión a
      // litros de cada comprobante que salga de este lote.
      let densidadDelEnsayo: number | null = null;
      let resultados: { secuencia: number; nombre: string; unidadMedida: string; limiteInferior: number | null; limiteSuperior: number | null; metodoEnsayo: string | null; valorMedido: number; conforme: boolean; instrumentoId: string | null }[] = [];
      const plan = await tx.planInspeccionCalidad.findFirst({ where: { productoId: lote.formula.productoId, empresaId: auth.usuario.empresaId, activo: true }, include: { caracteristicas: { orderBy: { secuencia: "asc" } } } });
      if (plan && planId !== plan.id) throw new Error("Debe evaluar el lote con el plan de inspección vigente. Actualice la página.");
      if (!plan && planId) throw new Error("El plan de inspección ya no está vigente para este producto. Actualice la página.");
      if (plan) {
        const lecturas = normalizarLecturasCalidad(String(formData.get("lecturas") ?? ""));
        resultados = resultadosDelEnsayo(plan.caracteristicas.map(c => ({
          ...c,
          limiteInferior: c.limiteInferior === null ? null : c.limiteInferior.toNumber(),
          limiteSuperior: c.limiteSuperior === null ? null : c.limiteSuperior.toNumber(),
        })), lecturas);
        // Los instrumentos llegan del navegador: se comprueban antes de
        // asentar el ensayo.
        const instrumentosUsados = [...new Set(resultados.map(r => r.instrumentoId).filter((x): x is string => x !== null))];
        if (instrumentosUsados.length > 0) {
          const usados = await tx.instrumentoMedicion.findMany({
            where: { id: { in: instrumentosUsados }, empresaId: auth.usuario.empresaId },
            select: {
              codigo: true,
              calibraciones: { select: { fecha: true, vigenteHasta: true, resultado: true } },
            },
          });
          if (usados.length !== instrumentosUsados.length) throw new Error("Algún instrumento no pertenece a la empresa activa.");

          // Y el control que la empresa eligió. El nivel se lee acá y no se
          // confía en lo que diga el formulario: bloquear o dejar pasar es una
          // decisión de la compañía, no del navegador que envía el ensayo.
          const configuracion = await tx.configuracionEmpresa.findUnique({
            where: { empresaId: auth.usuario.empresaId },
            select: { nivelControlCalibracion: true },
          });
          const ahora = new Date();
          const sinRespaldo = usados
            .filter(i => respaldoDeMedicion(i.calibraciones, ahora) !== "CALIBRADO")
            .map(i => i.codigo);
          const politica = controlAlLiberar(
            configuracion?.nivelControlCalibracion ?? "NO_APLICA",
            sinRespaldo
          );
          if (politica.bloquea) throw new Error(politica.aviso ?? "El control de calibración no permite liberar este lote.");
        }
        resultado = resultados.every(r => r.conforme) ? ResultadoCalidad.APROBADO : ResultadoCalidad.RECHAZADO;
        planVersion = plan.version;
        // Se toma aunque el lote salga rechazado: es un hecho medido, y un
        // lote rechazado puede reprocesarse.
        densidadDelEnsayo = densidadMedida(plan.caracteristicas, lecturas);
      }
      if (resultado === "RECHAZADO" && !observaciones) throw new Error("Al rechazar un lote, las observaciones son obligatorias.");
      if (resultado === "RECHAZADO" && (!causaId || !accionCorrectiva)) throw new Error("Al rechazar un lote, la causa y la acción correctiva son obligatorias.");

      const reclamo = await tx.loteGranel.updateMany({
        where: { id: loteId, empresaId: auth.usuario.empresaId, estado: "PENDIENTE_CALIDAD" },
        data: {
          estado: resultado === ResultadoCalidad.APROBADO ? EstadoLote.APROBADO : EstadoLote.RECHAZADO,
          kgDisponibles: resultado === "APROBADO" ? lote.kgProducidos : 0,
          // Solo cuando el plan la mide. Si no, el lote conserva lo que se
          // haya cargado al finalizar — o nada, y rige la del producto.
          ...(densidadDelEnsayo !== null ? { densidadKgL: densidadDelEnsayo } : {}),
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("El lote cambi\u00f3 mientras se evaluaba. Actualice la p\u00e1gina e intente nuevamente.");
      }

      const control = await tx.controlCalidad.create({
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
      if (resultado === ResultadoCalidad.RECHAZADO) {
        await tx.noConformidadCalidad.create({ data: {
          empresaId: auth.usuario.empresaId, controlCalidadId: control.id,
          causaRaizConfirmada: causaRaiz, accionCorrectiva,
          eventos: { create: { estadoNuevo: "ABIERTA", comentario: observaciones ?? "Lote rechazado por calidad.", usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre } },
        } });
      }
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
      const lote = await tx.loteGranel.findFirst({
        where: { id: loteId, empresaId: auth.usuario.empresaId },
      });
      if (!lote || lote.estado !== "RECHAZADO") throw new Error("El lote no está rechazado.");
      if (lote.disposicionRechazo) throw new Error("El lote rechazado ya tiene una disposición final.");
      const reclamo = await tx.loteGranel.updateMany({
        where: {
          id: loteId,
          empresaId: auth.usuario.empresaId,
          estado: "RECHAZADO",
          disposicionRechazo: null,
        },
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
          empresaId: lote.empresaId,
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
