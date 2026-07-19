import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import ProductoFormulario from "../ProductoFormulario";
import { actualizarProducto } from "../actions";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [producto, categorias] = await Promise.all([
    prisma.producto.findUnique({
      where: { id },
      include: { presentaciones: { orderBy: { creadoEn: "asc" } } },
    }),
    prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!producto) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/catalogo/productos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar producto
      </h1>

      <div className="mt-6">
        <ProductoFormulario
          accion={actualizarProducto.bind(null, id)}
          categorias={categorias}
          valoresIniciales={{
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            categoriaId: producto.categoriaId,
          }}
          textoBoton="Guardar cambios"
        />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Presentaciones</h2>
          <Link
            href={`/catalogo/presentaciones/nuevo?productoId=${producto.id}`}
            className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
          >
            + Agregar presentación
          </Link>
        </div>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Contenido</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {producto.presentaciones.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.sku}</td>
                <td>{p.nombre}</td>
                <td>{formatNumero(p.contenidoKg, 3)} kg</td>
                <td>{formatMoneda(p.precio, p.moneda)}</td>
                <td>{formatNumero(p.stock, 0)}</td>
              </tr>
            ))}
            {producto.presentaciones.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-500 py-4">
                  Este producto aún no tiene presentaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
