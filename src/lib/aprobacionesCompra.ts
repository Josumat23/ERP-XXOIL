import type { Tx } from "@/lib/inventario";

export type NivelCompra = { orden: number; nombre: string; montoDesdePen: number; rolAprobador: "GERENCIA" | "ADMIN" };

export function validarNivelesCompra(niveles: NivelCompra[]): boolean {
  if (!niveles.length) return false;
  const ordenes = new Set<number>();
  for (const nivel of niveles) {
    if (!Number.isInteger(nivel.orden) || nivel.orden <= 0 || ordenes.has(nivel.orden) || nivel.nombre.trim().length < 3 || !Number.isFinite(nivel.montoDesdePen) || nivel.montoDesdePen < 0 || !["GERENCIA", "ADMIN"].includes(nivel.rolAprobador)) return false;
    ordenes.add(nivel.orden);
  }
  return true;
}

export async function pasosAplicablesCompra(tx: Tx, empresaId: string, totalPen: number, umbralLegacy: number) {
  const niveles = await tx.nivelAprobacionCompra.findMany({ where: { empresaId, activo: true }, orderBy: { orden: "asc" } });
  const configurados = niveles.filter((nivel) => nivel.montoDesdePen.toNumber() <= totalPen);
  if (niveles.length) return configurados.map((n) => ({ orden: n.orden, nombre: n.nombre, montoDesdePen: n.montoDesdePen, rolAprobador: n.rolAprobador === "ADMIN" ? "ADMIN" as const : "GERENCIA" as const }));
  if (totalPen < umbralLegacy) return [];
  return [{ orden: 1, nombre: "Aprobación de Gerencia", montoDesdePen: umbralLegacy, rolAprobador: "GERENCIA" as const }];
}
