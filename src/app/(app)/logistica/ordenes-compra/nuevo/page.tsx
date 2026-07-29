import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import OrdenCompraFormulario from "../OrdenCompraFormulario";

export default async function NuevaOrdenCompraPage() {
  const [proveedores, insumos, almacenes, ordenes] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.ordenCompra.findMany({ include: { proveedor: true }, orderBy: { fecha: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/logistica/ordenes-compra" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a órdenes de compra
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva orden de compra
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/logistica/ordenes-compra/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/logistica/ordenes-compra/${o.id}`,
          primario: o.numero,
          secundario: o.proveedor.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <OrdenCompraFormulario
          proveedores={proveedores.map((p) => ({ id: p.id, etiqueta: p.razonSocial }))}
          insumos={insumos.map((i) => ({
            id: i.id,
            etiqueta: `${i.codigo} — ${i.nombre} (${i.unidadMedida})`,
            costo: i.costoUnitario.toNumber(),
            unidad: i.unidadMedida,
          }))}
          almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
