import Link from "next/link";
import { prisma } from "@/lib/prisma";
import InsumoFormulario from "../InsumoFormulario";
import { crearInsumo } from "../actions";

export default async function NuevoInsumoPage() {
  const proveedores = await prisma.proveedor.findMany({
    where: { activo: true },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/insumos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a insumos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo insumo
      </h1>

      <div className="mt-6">
        <InsumoFormulario accion={crearInsumo} proveedores={proveedores} textoBoton="Crear insumo" />
      </div>
    </div>
  );
}
