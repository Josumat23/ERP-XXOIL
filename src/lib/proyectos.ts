import type { Tx } from "@/lib/inventario";
import { convertirAPen } from "@/lib/tipoCambio";

const MS_DIA = 24 * 60 * 60 * 1000;

function maximoSegmento(codigos: string[], codigoPadre: string | null): number {
  const prefijo = codigoPadre ? `${codigoPadre}.` : "";
  return codigos.reduce((maximo, codigo) => {
    const segmento = codigoPadre
      ? codigo.startsWith(prefijo)
        ? codigo.slice(prefijo.length)
        : ""
      : codigo;
    if (!/^\d+$/.test(segmento)) return maximo;
    const numero = Number(segmento);
    return Number.isSafeInteger(numero) && numero > maximo ? numero : maximo;
  }, 0);
}

export function siguienteCodigoEdt(codigos: string[], codigoPadre: string | null): string {
  const siguiente = maximoSegmento(codigos, codigoPadre) + 1;
  return codigoPadre ? `${codigoPadre}.${siguiente}` : String(siguiente);
}

export function siguienteCodigoActividad(codigos: string[]): string {
  const numeros = codigos.map((codigo) => (codigo.startsWith("A-") ? codigo.slice(2) : ""));
  const siguiente = maximoSegmento(numeros, null) + 1;
  return `A-${String(siguiente).padStart(2, "0")}`;
}

// Costo real = CostoProyecto (ledger manual) + OrdenCompra etiquetadas no
// anuladas (convertidas a PEN) — sin doble registro, sin campo acumulado
// propio que se pueda desincronizar.
export async function costoRealProyecto(tx: Tx, proyectoId: string): Promise<number> {
  const [costos, ordenes] = await Promise.all([
    tx.costoProyecto.aggregate({ where: { proyectoId }, _sum: { monto: true } }),
    tx.ordenCompra.findMany({
      where: { proyectoId, estado: { not: "ANULADA" } },
      select: { total: true, moneda: true, tipoCambio: true },
    }),
  ]);
  const totalCostos = costos._sum.monto?.toNumber() ?? 0;
  const totalOC = ordenes.reduce(
    (acc, oc) => acc + convertirAPen(oc.total.toNumber(), oc.moneda, oc.tipoCambio.toNumber()),
    0
  );
  return totalCostos + totalOC;
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_DIA);
}

// Método de la Ruta Crítica (CPM): forward pass (ES/EF) + backward pass
// (LS/LF) sobre el grafo de actividades del proyecto, solo precedencia
// Fin-a-Inicio, en días corridos desde Proyecto.fechaInicioPlan (día 0).
// Escribe fechaInicioPlan/fechaFinPlan/esCritica/holguraDias en cada
// ActividadProyecto. Se invoca después de crear/borrar una actividad o
// precedencia, o de cambiar una duración o la fecha de inicio del proyecto.
export async function recalcularRutaCritica(tx: Tx, proyectoId: string): Promise<void> {
  const proyecto = await tx.proyecto.findUniqueOrThrow({ where: { id: proyectoId } });
  const edts = await tx.edtProyecto.findMany({ where: { proyectoId }, select: { id: true } });
  const edtIds = edts.map((e) => e.id);
  if (edtIds.length === 0) return;

  const actividades = await tx.actividadProyecto.findMany({ where: { edtId: { in: edtIds } } });
  if (actividades.length === 0) return;

  const actividadIds = actividades.map((a) => a.id);
  const precedencias = await tx.precedenciaActividad.findMany({
    where: { actividadSucesoraId: { in: actividadIds }, actividadPredecesoraId: { in: actividadIds } },
  });

  const predecesorasDe = new Map<string, string[]>();
  const sucesorasDe = new Map<string, string[]>();
  for (const a of actividades) {
    predecesorasDe.set(a.id, []);
    sucesorasDe.set(a.id, []);
  }
  for (const p of precedencias) {
    predecesorasDe.get(p.actividadSucesoraId)?.push(p.actividadPredecesoraId);
    sucesorasDe.get(p.actividadPredecesoraId)?.push(p.actividadSucesoraId);
  }

  // Orden topológico (Kahn). Si hubiera un ciclo (no debería — se valida al
  // crear cada precedencia), las actividades que quedan fuera del orden
  // simplemente no se recalculan, en vez de romper el resto del cálculo.
  const gradoEntrada = new Map<string, number>();
  for (const a of actividades) gradoEntrada.set(a.id, predecesorasDe.get(a.id)!.length);
  const cola = actividades.filter((a) => gradoEntrada.get(a.id) === 0).map((a) => a.id);
  const orden: string[] = [];
  while (cola.length > 0) {
    const id = cola.shift()!;
    orden.push(id);
    for (const sucId of sucesorasDe.get(id) ?? []) {
      const g = (gradoEntrada.get(sucId) ?? 0) - 1;
      gradoEntrada.set(sucId, g);
      if (g === 0) cola.push(sucId);
    }
  }

  const duracionDe = new Map(actividades.map((a) => [a.id, a.duracionDias]));

  // Forward pass: ES/EF en días desde el inicio del proyecto.
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of orden) {
    const preds = predecesorasDe.get(id) ?? [];
    const inicio = preds.length === 0 ? 0 : Math.max(...preds.map((p) => ef.get(p) ?? 0));
    es.set(id, inicio);
    ef.set(id, inicio + (duracionDe.get(id) ?? 0));
  }

  const finProyecto = orden.length > 0 ? Math.max(...orden.map((id) => ef.get(id) ?? 0)) : 0;

  // Backward pass: LS/LF, recorriendo el orden topológico al revés.
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (let i = orden.length - 1; i >= 0; i--) {
    const id = orden[i];
    const sucs = sucesorasDe.get(id) ?? [];
    const fin = sucs.length === 0 ? finProyecto : Math.min(...sucs.map((s) => ls.get(s) ?? finProyecto));
    lf.set(id, fin);
    ls.set(id, fin - (duracionDe.get(id) ?? 0));
  }

  for (const id of orden) {
    const holgura = (ls.get(id) ?? 0) - (es.get(id) ?? 0);
    await tx.actividadProyecto.update({
      where: { id },
      data: {
        fechaInicioPlan: sumarDias(proyecto.fechaInicioPlan, es.get(id) ?? 0),
        fechaFinPlan: sumarDias(proyecto.fechaInicioPlan, ef.get(id) ?? 0),
        esCritica: holgura === 0,
        holguraDias: holgura,
      },
    });
  }
}

// Antes de insertar una precedencia predecesora->sucesora: ¿ya existe un
// camino sucesora -> ... -> predecesora? Si sí, el nuevo arco cerraría un
// ciclo (DFS simple, no se valida en la base porque SQLite no tiene CHECK
// recursivo).
export async function formariaCiclo(
  tx: Tx,
  actividadPredecesoraId: string,
  actividadSucesoraId: string
): Promise<boolean> {
  if (actividadPredecesoraId === actividadSucesoraId) return true;

  const precedencias = await tx.precedenciaActividad.findMany({
    select: { actividadPredecesoraId: true, actividadSucesoraId: true },
  });
  const sucesorasDe = new Map<string, string[]>();
  for (const p of precedencias) {
    if (!sucesorasDe.has(p.actividadPredecesoraId)) sucesorasDe.set(p.actividadPredecesoraId, []);
    sucesorasDe.get(p.actividadPredecesoraId)!.push(p.actividadSucesoraId);
  }

  const visitados = new Set<string>();
  const pila = [actividadSucesoraId];
  while (pila.length > 0) {
    const actual = pila.pop()!;
    if (actual === actividadPredecesoraId) return true;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    for (const siguiente of sucesorasDe.get(actual) ?? []) pila.push(siguiente);
  }
  return false;
}
