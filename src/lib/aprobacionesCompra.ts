import type { Tx } from "@/lib/inventario";

export type NivelCompra = { orden: number; nombre: string; montoDesdePen: number; rolAprobador: "GERENCIA" | "ADMIN" };

// El tipo del monto queda genérico para que el Decimal de Prisma atraviese la
// función sin convertirse: el paso se guarda tal cual vino del nivel.
export type NivelConfigurado<M = { toNumber(): number }> = {
  orden: number;
  nombre: string;
  montoDesdePen: M;
  rolAprobador: string;
  almacenId: string | null;
};

export type PasoCompra<M = { toNumber(): number }> = {
  orden: number;
  nombre: string;
  montoDesdePen: M;
  rolAprobador: "GERENCIA" | "ADMIN";
};

export function validarNivelesCompra(niveles: NivelCompra[]): boolean {
  if (!niveles.length) return false;
  const ordenes = new Set<number>();
  for (const nivel of niveles) {
    if (!Number.isInteger(nivel.orden) || nivel.orden <= 0 || ordenes.has(nivel.orden) || nivel.nombre.trim().length < 3 || !Number.isFinite(nivel.montoDesdePen) || nivel.montoDesdePen < 0 || !["GERENCIA", "ADMIN"].includes(nivel.rolAprobador)) return false;
    ordenes.add(nivel.orden);
  }
  return true;
}

/**
 * Qué niveles debe recorrer una orden, dado su monto y su planta de destino.
 *
 * Semántica deliberada: **unión, no reemplazo**. Una orden recorre los niveles
 * generales de la compañía MÁS los de su planta. Configurar una planta solo
 * puede agregar controles, nunca quitarlos — un esquema donde la planta
 * reemplaza al general permitiría aflojar la aprobación configurando una
 * planta, y eso no debería poder hacerse sin que nadie lo note.
 *
 * Si el negocio prefiere que la planta reemplace al general, el cambio es
 * acotado a esta función.
 *
 * Los niveles sin planta de destino en la orden (liberaciones de acuerdo, OC
 * adjudicadas desde un RFQ) solo recorren los generales.
 */
export function nivelesAplicables<M extends { toNumber(): number }>(
  niveles: readonly NivelConfigurado<M>[],
  totalPen: number,
  almacenId?: string | null,
): PasoCompra<M>[] {
  return niveles
    .filter((nivel) => nivel.almacenId === null || (almacenId != null && nivel.almacenId === almacenId))
    .filter((nivel) => nivel.montoDesdePen.toNumber() <= totalPen)
    .sort((a, b) => a.orden - b.orden)
    .map((nivel) => ({
      orden: nivel.orden,
      nombre: nivel.nombre,
      montoDesdePen: nivel.montoDesdePen,
      rolAprobador: nivel.rolAprobador === "ADMIN" ? ("ADMIN" as const) : ("GERENCIA" as const),
    }));
}

export async function pasosAplicablesCompra(
  tx: Tx,
  empresaId: string,
  totalPen: number,
  umbralLegacy: number,
  almacenId?: string | null,
) {
  // Se traen TODOS los niveles activos de la compañía y el filtro por planta
  // se aplica después, a propósito: el respaldo al umbral histórico depende de
  // si la compañía tiene esquema configurado, no de si esta planta en
  // particular quedó sin niveles aplicables.
  const niveles = await tx.nivelAprobacionCompra.findMany({
    where: { empresaId, activo: true },
    orderBy: { orden: "asc" },
  });
  if (niveles.length) return nivelesAplicables(niveles, totalPen, almacenId);
  // Sin niveles configurados se conserva el umbral único histórico de
  // ConfiguracionEmpresa, para no dejar sin control a quien no migró todavía.
  if (totalPen < umbralLegacy) return [];
  return [{ orden: 1, nombre: "Aprobación de Gerencia", montoDesdePen: umbralLegacy, rolAprobador: "GERENCIA" as const }];
}
