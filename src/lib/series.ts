import { prisma } from "@/lib/prisma";
import type { Tx } from "@/lib/inventario";
import type { $Enums } from "@/generated/prisma/client";

// Sugiere el siguiente número de una serie (serie + correlativo con ceros a
// la izquierda). Es solo una sugerencia editable: el número real lo asigna
// SUNAT al emitir el documento externamente.
export function formatearNumeroSerie(serie: string, correlativo: number): string {
  return `${serie}-${String(correlativo).padStart(8, "0")}`;
}

export async function seriesActivas(tipoDocumento: $Enums.TipoDocumentoSerie) {
  return prisma.serieDocumento.findMany({
    where: { tipoDocumento, activo: true },
    orderBy: { serie: "asc" },
  });
}

// Incrementa el correlativo de la serie elegida dentro de la misma
// transacción del documento. Si no se eligió serie (flujo libre/manual), no
// hace nada.
export async function avanzarSerie(tx: Tx, serieId: string | null): Promise<void> {
  if (!serieId) return;
  await tx.serieDocumento.update({
    where: { id: serieId },
    data: { correlativoActual: { increment: 1 } },
  });
}
