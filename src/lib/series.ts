import { prisma } from "@/lib/prisma";
import type { Tx } from "@/lib/inventario";
import type { $Enums } from "@/generated/prisma/client";

// Sugiere el siguiente número de una serie (serie + correlativo con ceros a
// la izquierda). Es solo una sugerencia editable: el número real lo asigna
// SUNAT al emitir el documento externamente.
export function formatearNumeroSerie(serie: string, correlativo: number): string {
  return `${serie}-${String(correlativo).padStart(8, "0")}`;
}

export async function seriesActivas(tipoDocumento: $Enums.TipoDocumentoSerie, empresaId?: string) {
  return prisma.serieDocumento.findMany({
    where: { ...(empresaId ? { empresaId } : {}), tipoDocumento, activo: true },
    orderBy: { serie: "asc" },
  });
}

// Incrementa el correlativo de la serie elegida dentro de la misma
// transacción del documento. Si no se eligió serie (flujo libre/manual), no
// hace nada.
export async function avanzarSerie(tx: Tx, serieId: string | null, empresaId?: string): Promise<void> {
  if (!serieId) return;
  const actualizada = await tx.serieDocumento.updateMany({
    where: { id: serieId, ...(empresaId ? { empresaId } : {}), activo: true },
    data: { correlativoActual: { increment: 1 } },
  });
  if (actualizada.count !== 1) throw new Error("La serie no pertenece a la empresa activa o está inactiva.");
}
