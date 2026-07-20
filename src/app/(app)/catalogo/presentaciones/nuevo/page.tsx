import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import PresentacionFormulario from "../PresentacionFormulario";
import { crearPresentacion } from "../actions";

export default async function NuevaPresentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ productoId?: string }>;
}) {
  const { productoId } = await searchParams;

  const [productos, zonasAlmacen] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    zonasAlmacenParaSelect(),
  ]);

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/presentaciones" className="text-sm text-neutral-500 hover:underline">
        ← Volver a presentaciones
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva presentación
      </h1>

      <div className="mt-6">
        <PresentacionFormulario
          accion={crearPresentacion}
          productos={productos}
          zonasAlmacen={zonasAlmacen}
          productoIdInicial={productoId}
          textoBoton="Crear presentación"
        />
      </div>
    </div>
  );
}
