import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProductoFormulario from "../ProductoFormulario";
import { actualizarProducto } from "../actions";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [producto, productos, categorias, unidadesMedida] = await Promise.all([
    prisma.producto.findUnique({
      where: { id },
      include: { presentaciones: { orderBy: { creadoEn: "asc" } } },
    }),
    prisma.producto.findMany({ orderBy: { creadoEn: "desc" } }),
    prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    unidadesMedidaParaSelect(),
  ]);

  if (!producto) notFound();

  return (
    <div>
      <Link href="/catalogo/productos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar producto
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/catalogo/productos/nuevo"
        nuevoTexto="Nuevo producto"
        registros={productos.map((p) => ({
          id: p.id,
          href: `/catalogo/productos/${p.id}`,
          primario: p.nombre,
          secundario: p.codigo,
        }))}
      >
      <div className="max-w-2xl">
        <ProductoFormulario
          accion={actualizarProducto.bind(null, id)}
          categorias={categorias}
          unidadesMedida={unidadesMedida}
          valoresIniciales={{
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            categoriaId: producto.categoriaId,
            unidadMedidaBase: producto.unidadMedidaBase,
            marca: producto.marca,
            gradoNlgi: producto.gradoNlgi,
            viscosidad: producto.viscosidad,
            notasTecnicas: producto.notasTecnicas,
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
      </PanelMaestroDetalle>
    </div>
  );
}
