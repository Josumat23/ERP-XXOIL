"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import {
  trimestreDe,
  trimestreAnterior,
  esPeriodoProyeccionValido,
  ventasHistoricasPorTrimestre,
  calcularIndiceEstacionalidad,
} from "@/lib/proyecciones";
import { obtenerFactorMacro } from "@/lib/bcrp";
import { validarLineasSimulacion } from "@/lib/simuladorPrecios";

export type EstadoFormulario = { error?: string };

const ROLES_PROYECCIONES = ["ADMIN", "GERENCIA", "VENTAS", "PRODUCCION"] as const;

/** Crea la proyección del trimestre si no existe, con estacionalidad calculada de la historia. */
export async function obtenerOCrearProyeccion(anio: number, trimestre: number): Promise<string> {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) throw new Error(auth.error);
  if (!esPeriodoProyeccionValido(anio, trimestre)) {
    throw new Error("El período de proyección no es válido.");
  }

  const existente = await prisma.proyeccion.findUnique({
    where: { empresaId_anio_trimestre: { empresaId: auth.usuario.empresaId, anio, trimestre } },
  });
  if (existente) return existente.id;

  const base = trimestreAnterior(anio, trimestre);

  const [presentaciones, historico, macro] = await Promise.all([
    prisma.presentacion.findMany({ where: { empresaId: auth.usuario.empresaId, activo: true } }),
    ventasHistoricasPorTrimestre(auth.usuario.empresaId),
    obtenerFactorMacro(),
  ]);

  const proyeccion = await prisma.proyeccion.create({
    data: {
      empresaId: auth.usuario.empresaId,
      anio,
      trimestre,
      anioBase: base.anio,
      trimestreBase: base.trimestre,
      macroPbiManufacturaVar: macro.pbiManufacturaVar,
      macroInflacionVar: macro.inflacionVar,
      macroTipoCambio: macro.tipoCambio,
      macroActualizadoEn: new Date(),
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
      detalles: {
        create: presentaciones.map((p) => {
          const historicoPresentacion = historico.get(p.id);
          const ventasBase = historicoPresentacion?.get(`${base.anio}-${base.trimestre}`) ?? 0;
          const indice = calcularIndiceEstacionalidad(historicoPresentacion, trimestre, base.trimestre);
          return {
            presentacionId: p.id,
            ventasBase,
            indiceEstacionalidad: indice ?? 1,
          };
        }),
      },
    },
  });

  return proyeccion.id;
}

export async function irAProyeccionActual() {
  const { anio, trimestre } = trimestreDe(new Date());
  // El trimestre a proyectar es el siguiente al actual (estamos parados en
  // el trimestre en curso, proyectando el que viene).
  const siguiente = trimestre === 4 ? { anio: anio + 1, trimestre: 1 } : { anio, trimestre: trimestre + 1 };
  const id = await obtenerOCrearProyeccion(siguiente.anio, siguiente.trimestre);
  redirect(`/proyecciones/${id}`);
}

export async function actualizarSupuestosMarketing(
  proyeccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return auth;

  const crecimientoMercadoPct = Number(formData.get("crecimientoMercadoPct") ?? 0);
  const factorCompetenciaPct = Number(formData.get("factorCompetenciaPct") ?? 0);
  const presupuestoPublicidad = Number(formData.get("presupuestoPublicidad") ?? 0);

  if (!Number.isFinite(crecimientoMercadoPct) || !Number.isFinite(factorCompetenciaPct)) {
    return { error: "Los porcentajes ingresados no son válidos." };
  }
  if (!Number.isFinite(presupuestoPublicidad) || presupuestoPublicidad < 0) {
    return { error: "El presupuesto de publicidad debe ser mayor o igual a 0." };
  }

  const actualizada = await prisma.proyeccion.updateMany({
    where: { id: proyeccionId, empresaId: auth.usuario.empresaId },
    data: { crecimientoMercadoPct, factorCompetenciaPct, presupuestoPublicidad },
  });
  if (actualizada.count !== 1) return { error: "La proyección no existe en la empresa activa." };

  revalidatePath(`/proyecciones/${proyeccionId}`);
  return {};
}

export async function actualizarCajaMinima(
  proyeccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return auth;

  const cajaMinimaDeseada = Number(formData.get("cajaMinimaDeseada") ?? 0);
  if (!Number.isFinite(cajaMinimaDeseada) || cajaMinimaDeseada < 0) {
    return { error: "La caja mínima debe ser mayor o igual a 0." };
  }

  const actualizada = await prisma.proyeccion.updateMany({
    where: { id: proyeccionId, empresaId: auth.usuario.empresaId },
    data: { cajaMinimaDeseada },
  });
  if (actualizada.count !== 1) return { error: "La proyección no existe en la empresa activa." };
  revalidatePath(`/proyecciones/${proyeccionId}`);
  return {};
}

// Ajuste cualitativo por presentación (y estacionalidad manual cuando no hay histórico).
export async function actualizarDetalleProyeccion(
  detalleId: string,
  ajusteCualitativoPct: number,
  indiceEstacionalidadManual?: number
) {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return;
  if (
    !Number.isFinite(ajusteCualitativoPct) ||
    (indiceEstacionalidadManual !== undefined && !Number.isFinite(indiceEstacionalidadManual))
  ) {
    return;
  }

  const detalle = await prisma.proyeccionDetalle.findFirst({
    where: { id: detalleId, proyeccion: { empresaId: auth.usuario.empresaId } },
    select: { proyeccionId: true },
  });
  if (!detalle) return;

  await prisma.proyeccionDetalle.update({
    where: { id: detalleId },
    data: {
      ajusteCualitativoPct,
      ...(indiceEstacionalidadManual !== undefined
        ? { indiceEstacionalidad: indiceEstacionalidadManual }
        : {}),
    },
  });

  revalidatePath(`/proyecciones/${detalle.proyeccionId}`);
}

// Guarda la hipótesis del simulador de precios (no toca Presentacion.precio,
// que es el precio real de venta — esto es solo el escenario "qué pasaría si").
export async function guardarSimulacionPrecios(
  proyeccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return auth;

  const metaRaw = String(formData.get("metaUtilidadOperativa") ?? "").trim();
  const metaUtilidadOperativa = metaRaw ? Number(metaRaw) : null;
  if (metaRaw && !Number.isFinite(metaUtilidadOperativa)) {
    return { error: "La meta de utilidad debe ser un número válido." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la simulación es inválido." };
  }
  const resultadoLineas = validarLineasSimulacion(payload);
  if ("error" in resultadoLineas) return resultadoLineas;

  try {
    await prisma.$transaction(async (tx) => {
      const proyeccion = await tx.proyeccion.updateMany({
        where: { id: proyeccionId, empresaId: auth.usuario.empresaId },
        data: { metaUtilidadOperativa },
      });
      if (proyeccion.count !== 1) throw new Error("PROYECCION_AJENA");
      for (const linea of resultadoLineas.lineas) {
        const actualizada = await tx.proyeccionDetalle.updateMany({
          where: {
            id: linea.detalleId,
            proyeccionId,
            proyeccion: { empresaId: auth.usuario.empresaId },
          },
          data: {
            precioSimulado: linea.precioSimulado,
            precioCompetidorRef: linea.precioCompetidorRef,
          },
        });
        if (actualizada.count !== 1) {
          throw new Error("LINEA_SIMULACION_AJENA");
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && ["LINEA_SIMULACION_AJENA", "PROYECCION_AJENA"].includes(error.message)) {
      return { error: "Una línea no pertenece a la proyección indicada." };
    }
    throw error;
  }

  revalidatePath(`/proyecciones/${proyeccionId}`);
  return {};
}

export async function refrescarFactorMacro(proyeccionId: string) {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return;

  const macro = await obtenerFactorMacro();
  await prisma.proyeccion.updateMany({
    where: { id: proyeccionId, empresaId: auth.usuario.empresaId },
    data: {
      macroPbiManufacturaVar: macro.pbiManufacturaVar,
      macroInflacionVar: macro.inflacionVar,
      macroTipoCambio: macro.tipoCambio,
      macroActualizadoEn: new Date(),
    },
  });

  revalidatePath(`/proyecciones/${proyeccionId}`);
}
