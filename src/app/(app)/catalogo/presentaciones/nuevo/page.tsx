import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { zonasAlmacenParaSelect } from "@/lib/almacenes";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PresentacionFormulario from "../PresentacionFormulario";
import { crearPresentacion } from "../actions";

export default async function NuevaPresentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ productoId?: string }>;
}) {
  const { productoId } = await searchParams;

  const [productos, zonasAlmacen, presentaciones] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    zonasAlmacenParaSelect(),
    prisma.presentacion.findMany({ include: { producto: true }, orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/catalogo/presentaciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a presentaciones
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva presentación
      </h1>

      <PanelMaestroDetalle
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
          accion={crearPresentacion}
          productos={productos}
          zonasAlmacen={zonasAlmacen}
          productoIdInicial={productoId}
          textoBoton="Crear presentación"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
