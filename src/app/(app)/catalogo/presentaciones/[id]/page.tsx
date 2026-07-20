import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import PresentacionFormulario from "../PresentacionFormulario";
import { actualizarPresentacion } from "../actions";

export default async function EditarPresentacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [presentacion, productos, zonasAlmacen] = await Promise.all([
    prisma.presentacion.findUnique({ where: { id } }),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    zonasAlmacenParaSelect(),
  ]);

  if (!presentacion) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/presentaciones" className="text-sm text-neutral-500 hover:underline">
        ← Volver a presentaciones
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar presentación
      </h1>

      <div className="mt-6">
        <PresentacionFormulario
          accion={actualizarPresentacion.bind(null, id)}
          productos={productos}
          zonasAlmacen={zonasAlmacen}
          valoresIniciales={{
            productoId: presentacion.productoId,
            sku: presentacion.sku,
            nombre: presentacion.nombre,
            contenidoKg: presentacion.contenidoKg.toNumber(),
            precio: presentacion.precio.toNumber(),
            stock: presentacion.stock.toNumber(),
            stockMinimo: presentacion.stockMinimo.toNumber(),
            codigoBarras: presentacion.codigoBarras,
            pesoBrutoKg: presentacion.pesoBrutoKg?.toNumber() ?? null,
            unidadesPorCaja: presentacion.unidadesPorCaja,
            zonaAlmacenId: presentacion.zonaAlmacenId,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
    </div>
  );
}
