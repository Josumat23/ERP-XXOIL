import { prisma } from "@/lib/prisma";
import type { Tx } from "@/lib/inventario";

// ATP (Available To Promise) informativo: hoy el pedido solo se compara contra
// Presentacion.stock - stockReservado (ver crearPedido). Esto agrega, sin
// cambiar esa regla de bloqueo, visibilidad sobre lo que Producción ya tiene
// en camino para el mismo producto: granel ya aprobado que solo falta
// envasar (disponible casi de inmediato) y lotes todavía en proceso o en
// espera de calidad (planificado, con plazo incierto).
export type AtpProducto = {
  granelSinEnvasarKg: number;
  planificadoKg: number;
  lotesPlanificados: number;
};

const ATP_VACIO: AtpProducto = { granelSinEnvasarKg: 0, planificadoKg: 0, lotesPlanificados: 0 };

export async function calcularAtpPorProducto(cliente: Tx = prisma): Promise<Map<string, AtpProducto>> {
  const lotes = await cliente.loteGranel.findMany({
    where: { estado: { in: ["APROBADO", "EN_PROCESO", "PENDIENTE_CALIDAD"] } },
    select: { estado: true, kgDisponibles: true, kgObjetivo: true, formula: { select: { productoId: true } } },
  });

  const mapa = new Map<string, AtpProducto>();
  for (const lote of lotes) {
    const productoId = lote.formula.productoId;
    const acc = mapa.get(productoId) ?? { granelSinEnvasarKg: 0, planificadoKg: 0, lotesPlanificados: 0 };
    if (lote.estado === "APROBADO") {
      acc.granelSinEnvasarKg += lote.kgDisponibles.toNumber();
    } else {
      acc.planificadoKg += lote.kgObjetivo.toNumber();
      acc.lotesPlanificados++;
    }
    mapa.set(productoId, acc);
  }
  return mapa;
}

export async function calcularAtpProducto(cliente: Tx, productoId: string): Promise<AtpProducto> {
  const mapa = await calcularAtpPorProducto(cliente);
  return mapa.get(productoId) ?? ATP_VACIO;
}

export function unidadesEquivalentes(kg: number, contenidoKg: number): number {
  return contenidoKg > 0 ? Math.floor(kg / contenidoKg) : 0;
}
