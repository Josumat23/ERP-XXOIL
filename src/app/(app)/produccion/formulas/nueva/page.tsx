import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FormulaFormulario from "../FormulaFormulario";

export default async function NuevaFormulaPage() {
  const [productos, insumos] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.insumo.findMany({
      where: { activo: true, tipo: "MATERIA_PRIMA" },
      orderBy: { codigo: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/produccion/formulas" className="text-sm text-neutral-500 hover:underline">
        ← Volver a fórmulas
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva versión de fórmula
      </h1>
      <p className="text-neutral-500 mt-1">
        La versión se asigna automáticamente (siguiente número para el producto elegido).
      </p>

      <div className="mt-6">
        <FormulaFormulario
          productos={productos}
          insumos={insumos.map((i) => ({
            id: i.id,
            codigo: i.codigo,
            nombre: i.nombre,
            unidadMedida: i.unidadMedida,
          }))}
        />
      </div>
    </div>
  );
}
