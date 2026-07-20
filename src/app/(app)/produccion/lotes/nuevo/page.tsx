import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LoteFormulario from "../LoteFormulario";

export default async function NuevoLotePage() {
  const formulas = await prisma.formula.findMany({
    where: { activo: true },
    include: { producto: true, detalles: { include: { insumo: true } } },
    orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
  });

  return (
    <div className="max-w-2xl">
      <Link href="/produccion/lotes" className="text-sm text-neutral-500 hover:underline">
        ← Volver a órdenes de producción
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva orden de producción
      </h1>
      <p className="text-neutral-500 mt-1">
        Al crear el lote se descuentan los insumos de la fórmula (escalados a los kg objetivo) y el
        consumo queda registrado en el kardex.
      </p>

      <div className="mt-6">
        <LoteFormulario
          formulas={formulas.map((f) => ({
            id: f.id,
            etiqueta: `${f.producto.nombre} — v${f.version} (batch ${f.rendimientoKg.toNumber()} kg)`,
            rendimientoKg: f.rendimientoKg.toNumber(),
            detalles: f.detalles.map((d) => ({
              nombre: d.insumo.nombre,
              unidad: d.insumo.unidadMedida,
              cantidad: d.cantidad.toNumber(),
              stock: d.insumo.stock.toNumber(),
            })),
          }))}
        />
      </div>
    </div>
  );
}
