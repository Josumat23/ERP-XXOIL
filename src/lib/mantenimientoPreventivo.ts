import type { Tx } from "@/lib/inventario";
import { siguienteCodigoOrdenMantenimiento } from "@/lib/correlativos";

// ---------------------------------------------------------------------------
// Mantenimiento preventivo por planes (PM). Un plan vence por tiempo
// (frecuenciaDias desde la última ejecución) o por contador (frecuenciaContador
// de uso desde la última ejecución) — nunca ambos. El ciclo se reinicia recién
// cuando la ORDEN generada se completa (ver completarOrdenMantenimiento), no
// cuando se genera, para que el próximo vencimiento refleje la fecha/contador
// real de ejecución.
// ---------------------------------------------------------------------------

export function planVencido(
  plan: {
    tipo: "POR_TIEMPO" | "POR_CONTADOR";
    frecuenciaDias: number | null;
    frecuenciaContador: number | null;
    ultimaEjecucionFecha: Date | null;
    ultimaEjecucionContador: number | null;
    creadoEn: Date;
  },
  equipoContadorActual: number,
  fechaReferencia: Date = new Date()
): boolean {
  if (plan.tipo === "POR_TIEMPO") {
    if (!plan.frecuenciaDias) return false;
    const base = plan.ultimaEjecucionFecha ?? plan.creadoEn;
    const proxima = new Date(base);
    proxima.setDate(proxima.getDate() + plan.frecuenciaDias);
    return fechaReferencia >= proxima;
  }
  if (!plan.frecuenciaContador) return false;
  const base = plan.ultimaEjecucionContador ?? 0;
  return equipoContadorActual >= base + plan.frecuenciaContador;
}

const ACTOR_SISTEMA = { usuarioId: "sistema", usuarioNombre: "Sistema (tarea programada)" };

// Genera una OrdenMantenimiento PREVENTIVO por cada plan activo vencido que no
// tenga ya una orden abierta (PROGRAMADA/EN_PROCESO) pendiente — idempotente,
// se puede llamar de más sin duplicar.
export async function generarOrdenesPreventivasVencidas(
  tx: Tx
): Promise<{ generadas: number; detalle: string[] }> {
  const planes = await tx.planMantenimiento.findMany({
    where: { activo: true },
    include: { equipo: true, ordenes: { where: { estado: { in: ["PROGRAMADA", "EN_PROCESO"] } } } },
  });

  let generadas = 0;
  const detalle: string[] = [];

  for (const plan of planes) {
    if (plan.ordenes.length > 0) continue; // ya hay una orden abierta de este plan
    if (!plan.equipo.activo) continue;

    const vencido = planVencido(
      {
        tipo: plan.tipo,
        frecuenciaDias: plan.frecuenciaDias,
        frecuenciaContador: plan.frecuenciaContador?.toNumber() ?? null,
        ultimaEjecucionFecha: plan.ultimaEjecucionFecha,
        ultimaEjecucionContador: plan.ultimaEjecucionContador?.toNumber() ?? null,
        creadoEn: plan.creadoEn,
      },
      plan.equipo.contadorActual.toNumber()
    );
    if (!vencido) continue;

    const codigo = await siguienteCodigoOrdenMantenimiento(tx);
    await tx.ordenMantenimiento.create({
      data: {
        codigo,
        equipoId: plan.equipoId,
        tipo: "PREVENTIVO",
        descripcion: plan.nombre,
        fechaProgramada: new Date(),
        centroCostoId: plan.centroCostoId ?? plan.equipo.centroCostoId,
        planMantenimientoId: plan.id,
        ...ACTOR_SISTEMA,
      },
    });
    generadas++;
    detalle.push(`${codigo} — ${plan.nombre} (${plan.equipo.codigo})`);
  }

  return { generadas, detalle };
}
