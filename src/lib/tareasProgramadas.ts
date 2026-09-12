import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { ejecutarDepreciacionDelMes } from "@/lib/depreciacion";
import { aplicarRecargoAFactura } from "@/lib/recargoMora";
import { obtenerTipoCambioVigente } from "@/lib/tipoCambio";
import { generarOrdenesPreventivasVencidas } from "@/lib/mantenimientoPreventivo";
import { crearRespaldo, resolverOrigen } from "@/lib/respaldo";

export type ClaveTarea = $Enums.ClaveTareaProgramada;

export const ETIQUETA_TAREA: Record<ClaveTarea, string> = {
  DEPRECIACION_MENSUAL: "Depreciación mensual de activos fijos",
  RECARGO_MORA: "Recargo por mora en facturas vencidas",
  TIPO_CAMBIO_DIARIO: "Actualización del tipo de cambio (BCRP)",
  MANTENIMIENTO_PREVENTIVO: "Generación de órdenes de mantenimiento preventivo vencidas",
  RESPALDO_BASE: "Respaldo verificado de la base de datos",
};

// Cuántos respaldos se conservan. 7 con la tarea diaria cubre una semana.
const RETENCION_RESPALDOS = Number(process.env.RESPALDO_RETENCION ?? 7);

const ACTOR_SISTEMA = { usuarioId: "sistema", usuarioNombre: "Sistema (tarea programada)" };

async function registrarEjecucion(clave: ClaveTarea, exitoso: boolean, resumen: string) {
  await prisma.tareaProgramada.create({ data: { clave, exitoso, resumen } });
}

async function ejecutarDepreciacionMensual() {
  const hoy = new Date();
  try {
    const empresas = await prisma.empresa.findMany({ where: { activa: true }, select: { id: true } });
    let procesados = 0;
    let totalMes = 0;
    for (const empresa of empresas) {
      const resultado = await prisma.$transaction((tx) =>
        ejecutarDepreciacionDelMes(tx, hoy.getFullYear(), hoy.getMonth() + 1, {
          ...ACTOR_SISTEMA,
          empresaId: empresa.id,
        })
      );
      procesados += resultado.procesados;
      totalMes += resultado.totalMes;
    }
    await registrarEjecucion(
      "DEPRECIACION_MENSUAL",
      true,
      procesados > 0
        ? `${procesados} activo(s) depreciados, total S/ ${totalMes.toFixed(2)}.`
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

async function ejecutarMantenimientoPreventivo() {
  try {
    const resultado = await prisma.$transaction((tx) => generarOrdenesPreventivasVencidas(tx));
    await registrarEjecucion(
      "MANTENIMIENTO_PREVENTIVO",
      true,
      resultado.generadas > 0
        ? `${resultado.generadas} orden(es) generada(s): ${resultado.detalle.join(", ")}.`
        : "Sin planes vencidos."
    );
  } catch (e) {
    await registrarEjecucion(
      "MANTENIMIENTO_PREVENTIVO",
      false,
      e instanceof Error ? e.message : "Error desconocido."
    );
  }
}

// El respaldo NO corre solo: exige RESPALDO_DIR configurado. Sin esa variable
// la tarea deja constancia de que no está configurada y no toca ningún archivo,
// para que instalar una versión nueva nunca empiece a escribir copias en una
// ruta que nadie eligió.
async function ejecutarRespaldoBase() {
  const directorio = process.env.RESPALDO_DIR?.trim();
  // El motor sale de DATABASE_URL. Si es uno reconocido pero sin controlador
  // —PostgreSQL, hoy— el error que queda registrado lo dice con esas palabras,
  // en vez del viejo «no apunta a un archivo SQLite», que era cierto e inútil.
  const origen = resolverOrigen(process.env.DATABASE_URL);
  try {
    if (!directorio) {
      await registrarEjecucion(
        "RESPALDO_BASE",
        true,
        "Respaldo no configurado: defina RESPALDO_DIR para activarlo."
      );
      return;
    }
    if (!origen) {
      throw new Error(
        "DATABASE_URL no declara un motor de base reconocido: no hay qué respaldar."
      );
    }

    const resumen = await crearRespaldo({ origen, directorio, retencion: RETENCION_RESPALDOS });
    const megas = (resumen.bytes / 1024 / 1024).toFixed(2);
    await registrarEjecucion(
      "RESPALDO_BASE",
      true,
      `Respaldo verificado en ${resumen.archivo} (${megas} MB, SHA256 ${resumen.sha256.slice(0, 16)}…)` +
        (resumen.eliminados.length > 0
          ? `. ${resumen.eliminados.length} respaldo(s) antiguo(s) eliminado(s) por retención.`
          : ".")
    );
  } catch (e) {
    await registrarEjecucion(
      "RESPALDO_BASE",
      false,
      e instanceof Error ? e.message : "Error desconocido."
    );
  }
}

const EJECUTORES: Record<ClaveTarea, () => Promise<void>> = {
  DEPRECIACION_MENSUAL: ejecutarDepreciacionMensual,
  RECARGO_MORA: ejecutarRecargosMoraVencidos,
  TIPO_CAMBIO_DIARIO: ejecutarActualizacionTipoCambio,
  MANTENIMIENTO_PREVENTIVO: ejecutarMantenimientoPreventivo,
  RESPALDO_BASE: ejecutarRespaldoBase,
};

export async function ejecutarTareaIndividual(clave: ClaveTarea): Promise<void> {
  await EJECUTORES[clave]();
}

/**
 * Corre todas las tareas en secuencia. Cada una es idempotente (revisa
 * internamente si ya hizo lo que tenía que hacer para el período/día
 * correspondiente), así que llamarla de más — por ejemplo cada vez que
 * arranca el servidor, más el intervalo periódico — nunca duplica nada.
 */
export async function ejecutarTareasPendientes(): Promise<void> {
  for (const clave of Object.keys(EJECUTORES) as ClaveTarea[]) {
    await ejecutarTareaIndividual(clave);
  }
}
