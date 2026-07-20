import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PedidoFormulario from "../PedidoFormulario";

export default async function NuevoPedidoPage() {
  const [clientes, vendedores, presentaciones] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/comercial/pedidos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a pedidos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo pedido
      </h1>

      <div className="mt-6">
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
    </div>
  );
}
