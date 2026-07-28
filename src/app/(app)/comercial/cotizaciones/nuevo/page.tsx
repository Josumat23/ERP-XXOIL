import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CotizacionFormulario from "../CotizacionFormulario";

export default async function NuevaCotizacionPage() {
  const [clientes, vendedores, presentaciones, cotizaciones, descuentosCanal] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.cotizacion.findMany({ include: { cliente: true }, orderBy: { fecha: "desc" } }),
    prisma.descuentoCanal.findMany(),
  ]);
  const descuentoPorCanal = Object.fromEntries(
    descuentosCanal.map((d) => [d.canal, d.descuentoPct.toNumber()])
  );

  return (
    <div>
      <Link href="/comercial/cotizaciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a cotizaciones
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva cotización
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/cotizaciones/nuevo"
        nuevoTexto="Nueva cotización"
        registros={cotizaciones.map((c) => ({
          id: c.id,
          href: `/comercial/cotizaciones/${c.id}`,
          primario: c.numero,
          secundario: c.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <CotizacionFormulario
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: c.razonSocial,
            vendedorId: c.vendedorId,
            canal: c.canal,
          }))}
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          descuentoPorCanal={descuentoPorCanal}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.producto.nombre} — ${p.nombre}`,
            precio: p.precio.toNumber(),
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
