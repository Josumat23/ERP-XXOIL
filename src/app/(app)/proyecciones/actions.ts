"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import {
  trimestreDe,
  trimestreAnterior,
  ventasHistoricasPorTrimestre,
  calcularIndiceEstacionalidad,
} from "@/lib/proyecciones";
import { obtenerFactorMacro } from "@/lib/bcrp";

export type EstadoFormulario = { error?: string };

const ROLES_PROYECCIONES = ["ADMIN", "GERENCIA", "VENTAS", "PRODUCCION"] as const;

/** Crea la proyección del trimestre si no existe, con estacionalidad calculada de la historia. */
export async function obtenerOCrearProyeccion(anio: number, trimestre: number): Promise<string> {
  const existente = await prisma.proyeccion.findUnique({
    where: { empresaId_anio_trimestre: { empresaId: "1", anio, trimestre } },
  });
  if (existente) return existente.id;

  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) throw new Error(auth.error);

  const base = trimestreAnterior(anio, trimestre);

  const [presentaciones, historico, macro] = await Promise.all([
    prisma.presentacion.findMany({ where: { activo: true } }),
    ventasHistoricasPorTrimestre(),
    obtenerFactorMacro(),
  ]);

  const proyeccion = await prisma.proyeccion.create({
    data: {
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

  await prisma.proyeccion.update({
    where: { id: proyeccionId },
    data: { crecimientoMercadoPct, factorCompetenciaPct, presupuestoPublicidad },
  });

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

  await prisma.proyeccion.update({ where: { id: proyeccionId }, data: { cajaMinimaDeseada } });
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

  const detalle = await prisma.proyeccionDetalle.update({
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

export async function refrescarFactorMacro(proyeccionId: string) {
  const auth = await requerirRol([...ROLES_PROYECCIONES]);
  if ("error" in auth) return;

  const macro = await obtenerFactorMacro();
  await prisma.proyeccion.update({
    where: { id: proyeccionId },
    data: {
      macroPbiManufacturaVar: macro.pbiManufacturaVar,
      macroInflacionVar: macro.inflacionVar,
      macroTipoCambio: macro.tipoCambio,
      macroActualizadoEn: new Date(),
    },
  });

  revalidatePath(`/proyecciones/${proyeccionId}`);
}
