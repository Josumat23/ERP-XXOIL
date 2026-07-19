import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EnvasadoFormulario from "../EnvasadoFormulario";

export default async function NuevoEnvasadoPage({
  searchParams,
}: {
  searchParams: Promise<{ loteId?: string }>;
}) {
  const { loteId } = await searchParams;

  const [lotes, presentaciones, insumos] = await Promise.all([
    prisma.loteGranel.findMany({
      where: { estado: "APROBADO", kgDisponibles: { gt: 0 } },
      include: { formula: { include: { producto: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.presentacion.findMany({ where: { activo: true }, orderBy: { sku: "asc" } }),
    prisma.insumo.findMany({
      where: { activo: true, tipo: { in: ["ENVASE", "ETIQUETA"] } },
      orderBy: { codigo: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/produccion/envasados" className="text-sm text-neutral-500 hover:underline">
        ← Volver a envasados
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo envasado
      </h1>
      <p className="text-neutral-500 mt-1">
        Consume granel aprobado más envases y etiquetas, y genera stock de la presentación elegida.
      </p>

      <div className="mt-6">
        <EnvasadoFormulario
          loteIdInicial={loteId}
          lotes={lotes.map((l) => ({
            id: l.id,
            etiqueta: `${l.codigo} — ${l.formula.producto.nombre} (${l.kgDisponibles.toNumber().toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg disp.)`,
            productoId: l.formula.productoId,
            kgDisponibles: l.kgDisponibles.toNumber(),
          }))}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.sku} — ${p.nombre} (${p.contenidoKg.toNumber()} kg c/u)`,
            productoId: p.productoId,
            contenidoKg: p.contenidoKg.toNumber(),
          }))}
          insumos={insumos.map((i) => ({
            id: i.id,
            etiqueta: `${i.codigo} — ${i.nombre}`,
            stock: i.stock.toNumber(),
            unidad: i.unidadMedida,
          }))}
        />
      </div>
    </div>
  );
}
