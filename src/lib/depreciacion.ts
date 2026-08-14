import type { Tx } from "@/lib/inventario";
import { postearDepreciacion } from "@/lib/contabilidad";

export type ActorTarea = { usuarioId: string; usuarioNombre: string };

// Extraído de activos-fijos/actions.ts para poder reusarlo tanto desde el
// botón manual (registrarDepreciacionMes) como desde la tarea programada
// automática — misma lógica, un solo lugar. Se salta cualquier activo que ya
// tenga su cargo del mes (restricción única activoFijoId+anio+mes), así que
// llamarlo de nuevo el mismo período nunca duplica el asiento.
export async function ejecutarDepreciacionDelMes(
  tx: Tx,
  anio: number,
  mes: number,
  actor: ActorTarea
): Promise<{ procesados: number; totalMes: number }> {
  const activos = await tx.activoFijo.findMany({
    where: { activo: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let totalMes = 0;
  let procesados = 0;
  const montoPorCentro = new Map<string | null, number>();
  for (const { id } of activos) {
    const bloqueo = await tx.activoFijo.updateMany({
      where: { id, activo: true },
      data: { depreciacionAcumulada: { increment: 0 } },
    });
    if (bloqueo.count !== 1) continue;

    const a = await tx.activoFijo.findUnique({
      where: { id },
      include: { depreciaciones: { where: { anio, mes } } },
    });
    if (!a || !a.activo || a.depreciaciones.length > 0) continue; // ya se registró este período

    const costo = a.costoAdquisicion.toNumber();
    const residual = a.valorResidual.toNumber();
    const acumulada = a.depreciacionAcumulada.toNumber();
    const baseDepreciable = costo - residual;
    const pendiente = baseDepreciable - acumulada;
    if (pendiente <= 0.01) continue;

    const cuotaMensual = baseDepreciable / (a.vidaUtilAnios * 12);
    const cargo = Math.min(cuotaMensual, pendiente);
    if (cargo <= 0.01) continue;

    await tx.depreciacionActivo.create({
      data: { activoFijoId: a.id, anio, mes, monto: cargo },
    });
    const actualizado = await tx.activoFijo.updateMany({
      where: { id: a.id, activo: true, depreciacionAcumulada: a.depreciacionAcumulada },
      data: { depreciacionAcumulada: { increment: cargo } },
    });
    if (actualizado.count !== 1) {
      throw new Error(`El activo ${a.codigo} cambió durante la depreciación. Intente nuevamente.`);
    }

    totalMes += cargo;
    procesados++;
    montoPorCentro.set(a.centroCostoId, (montoPorCentro.get(a.centroCostoId) ?? 0) + cargo);
  }

  if (totalMes > 0.01) {
    await postearDepreciacion(
      tx,
      {
        mes,
        anio,
        monto: Math.round(totalMes * 100) / 100,
        porCentro: [...montoPorCentro.entries()].map(([centroCostoId, monto]) => ({
          centroCostoId,
          monto: Math.round(monto * 100) / 100,
        })),
      },
      actor
    );
  }

  return { procesados, totalMes };
}
