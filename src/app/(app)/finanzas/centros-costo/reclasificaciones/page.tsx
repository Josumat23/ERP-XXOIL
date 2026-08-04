import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CLAVES_RECLASIFICABLES, ETIQUETA_CONTROL } from "@/lib/contabilidad";
import ReclasificacionFormulario from "./ReclasificacionFormulario";

export default async function ReclasificacionesPage() {
  const centros = await prisma.centroCosto.findMany({
    where: { activo: true },
    orderBy: { codigo: "asc" },
  });

  return (
    <div>
      <Link
        href="/finanzas/centros-costo"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a centros de costo
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Reclasificación de costos entre centros
      </h1>
      <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--epicor-texto-tenue)" }}>
        Los asientos nunca se editan: esto genera un asiento nuevo con dos líneas en la misma
        cuenta contable (no cambia el resultado del período), moviendo el monto del centro de
        origen al de destino — útil cuando un gasto se atribuyó al área equivocada.
      </p>

      <div className="max-w-xl mt-6">
        <ReclasificacionFormulario
          claves={CLAVES_RECLASIFICABLES.map((c) => ({ valor: c, etiqueta: ETIQUETA_CONTROL[c] }))}
          centros={centros.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
        />
      </div>
    </div>
  );
}
