import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GuiaFormulario from "../GuiaFormulario";

export default async function NuevaGuiaPage() {
  const [facturas, clientes, presentaciones] = await Promise.all([
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" } },
      include: {
        cliente: true,
        pedido: { include: { detalles: true } },
      },
      orderBy: { fechaEmision: "desc" },
      take: 50,
    }),
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/logistica/guias-remision" className="text-sm text-neutral-500 hover:underline">
        ← Volver a guías de remisión
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva guía de remisión
      </h1>
      <p className="text-neutral-500 mt-1">
        La guía se emite en el portal SUNAT; aquí se registra y se imprime para el transporte.
      </p>

      <div className="mt-6">
        <GuiaFormulario
          puntoPartidaDefecto="Planta de producción"
          facturas={facturas.map((f) => ({
            id: f.id,
            etiqueta: `${f.numero} — ${f.cliente.razonSocial}`,
            clienteId: f.clienteId,
            lineas: f.pedido.detalles.map((d) => ({
              presentacionId: d.presentacionId,
              cantidad: d.cantidad,
            })),
          }))}
          clientes={clientes.map((c) => ({ id: c.id, etiqueta: c.razonSocial }))}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.producto.nombre} — ${p.nombre}`,
          }))}
        />
      </div>
    </div>
  );
}
