import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PresentacionFormulario from "../PresentacionFormulario";
import { actualizarPresentacion } from "../actions";

export default async function EditarPresentacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [presentacion, presentaciones, productos, zonasAlmacen] = await Promise.all([
    prisma.presentacion.findUnique({ where: { id } }),
    prisma.presentacion.findMany({ include: { producto: true }, orderBy: { creadoEn: "desc" } }),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    zonasAlmacenParaSelect(),
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
      </PanelMaestroDetalle>
    </div>
  );
}
