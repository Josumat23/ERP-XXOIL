import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OrdenCompraFormulario from "../OrdenCompraFormulario";

export default async function NuevaOrdenCompraPage() {
  const [proveedores, insumos] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/logistica/ordenes-compra" className="text-sm text-neutral-500 hover:underline">
        ← Volver a órdenes de compra
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva orden de compra
      </h1>

      <div className="mt-6">
        <OrdenCompraFormulario
          proveedores={proveedores.map((p) => ({ id: p.id, etiqueta: p.razonSocial }))}
          insumos={insumos.map((i) => ({
            id: i.id,
            etiqueta: `${i.codigo} — ${i.nombre} (${i.unidadMedida})`,
            costo: i.costoUnitario.toNumber(),
            unidad: i.unidadMedida,
          }))}
        />
      </div>
    </div>
  );
}
