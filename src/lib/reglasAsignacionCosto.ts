import { ETIQUETA_CONTROL, type ClaveControl } from "@/lib/contabilidad";

export function esClaveControlValida(valor: unknown): valor is ClaveControl {
  return typeof valor === "string" && Object.hasOwn(ETIQUETA_CONTROL, valor);
}

export type DestinoControlCosto =
  | { tipo: "centro"; id: string }
  | { tipo: "regla"; id: string };

export function normalizarDestinoControlCosto(valor: unknown): DestinoControlCosto | null {
  if (typeof valor !== "string") return null;
  const coincidencia = /^(centro|regla):([^:]+)$/.exec(valor);
  if (!coincidencia) return null;

  const [, tipo, idRaw] = coincidencia;
  const id = idRaw.trim();
  if (!id) return null;
  return tipo === "regla" ? { tipo, id } : { tipo: "centro", id };
}
export type LineaReglaAsignacionNormalizada = {
  centroCostoId: string;
  porcentaje: number;
};

export function normalizarLineasReglaAsignacion(
  valor: unknown
): LineaReglaAsignacionNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaReglaAsignacionNormalizada[] = [];
  const centros = new Set<string>();
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("centroCostoId" in candidata) ||
      !("porcentaje" in candidata) ||
      typeof candidata.centroCostoId !== "string" ||
      typeof candidata.porcentaje !== "number"
    ) {
      continue;
    }

    const centroCostoId = candidata.centroCostoId.trim();
    if (
      !centroCostoId ||
      !Number.isFinite(candidata.porcentaje) ||
      candidata.porcentaje <= 0 ||
      candidata.porcentaje > 100
    ) {
      continue;
    }
    if (centros.has(centroCostoId)) return null;

    centros.add(centroCostoId);
    lineas.push({ centroCostoId, porcentaje: candidata.porcentaje });
  }

  return lineas;
}
