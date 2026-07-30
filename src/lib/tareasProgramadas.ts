import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { ejecutarDepreciacionDelMes } from "@/lib/depreciacion";
import { aplicarRecargoAFactura } from "@/lib/recargoMora";
import { obtenerTipoCambioVigente } from "@/lib/tipoCambio";

export type ClaveTarea = $Enums.ClaveTareaProgramada;

export const ETIQUETA_TAREA: Record<ClaveTarea, string> = {
  DEPRECIACION_MENSUAL: "Depreciación mensual de activos fijos",
  RECARGO_MORA: "Recargo por mora en facturas vencidas",
  TIPO_CAMBIO_DIARIO: "Actualización del tipo de cambio (BCRP)",
};

const ACTOR_SISTEMA = { usuarioId: "sistema", usuarioNombre: "Sistema (tarea programada)" };

async function registrarEjecucion(clave: ClaveTarea, exitoso: boolean, resumen: string) {
  await prisma.tareaProgramada.create({ data: { clave, exitoso, resumen } });
}

async function ejecutarDepreciacionMensual() {
  const hoy = new Date();
  try {
    const resultado = await prisma.$transaction((tx) =>
      ejecutarDepreciacionDelMes(tx, hoy.getFullYear(), hoy.getMonth() + 1, ACTOR_SISTEMA)
    );
    await registrarEjecucion(
      "DEPRECIACION_MENSUAL",
      true,
      resultado.procesados > 0
        ? `${resultado.procesados} activo(s) depreciados, total S/ ${resultado.totalMes.toFixed(2)}.`
        : "Sin activos pendientes de depreciar este mes."
    );
  } catch (e) {
    await registrarEjecucion(
      "DEPRECIACION_MENSUAL",
      false,
      e instanceof Error ? e.message : "Error desconocido."
    );
  }
}

async function ejecutarRecargosMoraVencidos() {
  const facturasVencidas = await prisma.factura.findMany({
    where: { estado: "PENDIENTE", fechaVencimiento: { lt: new Date() } },
    select: { id: true },
  });

  let aplicados = 0;
  for (const f of facturasVencidas) {
    try {
      const resultado = await prisma.$transaction((tx) => aplicarRecargoAFactura(tx, f.id, ACTOR_SISTEMA));
      if (resultado.ok) aplicados++;
    } catch {
      // Una factura con error (ej. tasa no configurada) no debe frenar el resto.
    }
  }

  await registrarEjecucion(
    "RECARGO_MORA",
    true,
    `${aplicados} factura(s) con recargo aplicado de ${facturasVencidas.length} vencida(s) revisada(s).`
  );
}

async function ejecutarActualizacionTipoCambio() {
  try {
    const valor = await obtenerTipoCambioVigente();
    await registrarEjecucion(
      "TIPO_CAMBIO_DIARIO",
      valor !== null,
      valor !== null
        ? `Tipo de cambio del día: ${valor.toFixed(3)}.`
        : "El BCRP no respondió y no hay ningún valor cacheado."
    );
  } catch (e) {
    await registrarEjecucion(
      "TIPO_CAMBIO_DIARIO",
      false,
      e instanceof Error ? e.message : "Error desconocido."
    );
  }
}

const EJECUTORES: Record<ClaveTarea, () => Promise<void>> = {
  DEPRECIACION_MENSUAL: ejecutarDepreciacionMensual,
  RECARGO_MORA: ejecutarRecargosMoraVencidos,
  TIPO_CAMBIO_DIARIO: ejecutarActualizacionTipoCambio,
};

export async function ejecutarTareaIndividual(clave: ClaveTarea): Promise<void> {
  await EJECUTORES[clave]();
}

/**
 * Corre las tres tareas en secuencia. Cada una es idempotente (revisa
 * internamente si ya hizo lo que tenía que hacer para el período/día
 * correspondiente), así que llamarla de más — por ejemplo cada vez que
 * arranca el servidor, más el intervalo periódico — nunca duplica nada.
 */
export async function ejecutarTareasPendientes(): Promise<void> {
  for (const clave of Object.keys(EJECUTORES) as ClaveTarea[]) {
    await ejecutarTareaIndividual(clave);
  }
}
