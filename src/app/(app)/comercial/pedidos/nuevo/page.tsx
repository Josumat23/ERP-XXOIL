import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PedidoFormulario from "../PedidoFormulario";

export default async function NuevoPedidoPage() {
  const [clientes, vendedores, presentaciones, pedidos] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.pedido.findMany({ include: { cliente: true }, orderBy: { fecha: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/comercial/pedidos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a pedidos
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo pedido
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/pedidos/nuevo"
        nuevoTexto="Nuevo pedido"
        registros={pedidos.map((p) => ({
          id: p.id,
          href: `/comercial/pedidos/${p.id}`,
          primario: p.numero,
          secundario: p.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <PedidoFormulario
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: c.razonSocial,
            vendedorId: c.vendedorId,
          }))}
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.producto.nombre} — ${p.nombre}`,
            precio: p.precio.toNumber(),
            stock: p.stock.toNumber(),
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
