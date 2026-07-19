import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import InsumoFormulario from "../InsumoFormulario";
import { actualizarInsumo } from "../actions";

export default async function EditarInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [insumo, proveedores] = await Promise.all([
    prisma.insumo.findUnique({ where: { id } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ]);

  if (!insumo) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/insumos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a insumos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar insumo
      </h1>

      <div className="mt-6">
        <InsumoFormulario
          accion={actualizarInsumo.bind(null, id)}
          proveedores={proveedores}
          valoresIniciales={{
            codigo: insumo.codigo,
            nombre: insumo.nombre,
            tipo: insumo.tipo,
            unidadMedida: insumo.unidadMedida,
            proveedorId: insumo.proveedorId,
            stock: insumo.stock.toNumber(),
            stockMinimo: insumo.stockMinimo.toNumber(),
            costoUnitario: insumo.costoUnitario.toNumber(),
          }}
          textoBoton="Guardar cambios"
        />
      </div>
    </div>
  );
}
