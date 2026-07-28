import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import { formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PresentacionFormulario from "../PresentacionFormulario";
import EscalonPrecioFormulario from "../EscalonPrecioFormulario";
import { actualizarPresentacion, eliminarEscalonPrecio } from "../actions";

export default async function EditarPresentacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [presentacion, presentaciones, productos, zonasAlmacen, escalones] = await Promise.all([
    prisma.presentacion.findUnique({ where: { id } }),
    prisma.presentacion.findMany({ include: { producto: true }, orderBy: { creadoEn: "desc" } }),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    zonasAlmacenParaSelect(),
    prisma.escalonPrecio.findMany({ where: { presentacionId: id }, orderBy: { cantidadMinima: "asc" } }),
  ]);

  if (!presentacion) notFound();

  return (
    <div>
      <Link href="/catalogo/presentaciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a presentaciones
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar presentación
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/catalogo/presentaciones/nuevo"
        nuevoTexto="Nueva presentación"
        registros={presentaciones.map((p) => ({
          id: p.id,
          href: `/catalogo/presentaciones/${p.id}`,
          primario: p.nombre,
          secundario: `${p.sku} · ${p.producto.nombre}`,
        }))}
      >
      <div className="max-w-lg">
        <PresentacionFormulario
          accion={actualizarPresentacion.bind(null, id)}
          productos={productos}
          zonasAlmacen={zonasAlmacen}
          valoresIniciales={{
            productoId: presentacion.productoId,
            sku: presentacion.sku,
            nombre: presentacion.nombre,
            contenidoKg: presentacion.contenidoKg.toNumber(),
            contenidoLitros: presentacion.contenidoLitros ? presentacion.contenidoLitros.toNumber() : null,
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

        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Precio por volumen (escalones)
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            A partir de la cantidad indicada, este precio se sugiere en el pedido en vez del precio
            base (S/ {presentacion.precio.toNumber().toFixed(2)}).
          </p>
          <table className="tabla mt-3">
            <thead>
              <tr>
                <th>A partir de</th>
                <th className="text-right">Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {escalones.map((e) => (
                <tr key={e.id}>
                  <td>{e.cantidadMinima} un.</td>
                  <td className="text-right">{formatMoneda(e.precio)}</td>
                  <td className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await eliminarEscalonPrecio(e.id, id);
                      }}
                    >
                      <button type="submit" className="text-neutral-500 hover:underline">
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {escalones.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-500 py-3">
                    Sin escalones — siempre se usa el precio base.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-3">
            <EscalonPrecioFormulario presentacionId={id} />
          </div>
        </section>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
