import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReglaAsignacionFormulario from "../../ReglaAsignacionFormulario";

export default async function NuevaReglaAsignacionPage() {
  const centros = await prisma.centroCosto.findMany({
    where: { activo: true },
    orderBy: { codigo: "asc" },
  });

  return (
    <div>
      <Link
        href="/finanzas/centros-costo/reglas"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a reglas de asignación
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva regla de prorrateo
      </h1>

      <div className="max-w-2xl">
        <ReglaAsignacionFormulario
          centros={centros.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
        />
      </div>
    </div>
  );
}
