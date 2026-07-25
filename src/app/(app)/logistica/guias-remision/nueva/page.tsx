import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { seriesActivas } from "@/lib/series";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import GuiaFormulario from "../GuiaFormulario";

export default async function NuevaGuiaPage() {
  const [facturas, clientes, presentaciones, series, guias] = await Promise.all([
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
    seriesActivas("GUIA_REMISION"),
    prisma.guiaRemision.findMany({ include: { cliente: true }, orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/logistica/guias-remision" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a guías de remisión
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Nueva guía de remisión
      </h1>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        La guía se emite en el portal SUNAT; aquí se registra y se imprime para el transporte.
      </p>

      <PanelMaestroDetalle
        nuevoHref="/logistica/guias-remision/nueva"
        nuevoTexto="Nueva guía"
        registros={guias.map((g) => ({
          id: g.id,
          href: `/logistica/guias-remision/${g.id}`,
          primario: g.numero,
          secundario: g.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
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
          series={series.map((s) => ({
            id: s.id,
            serie: s.serie,
            correlativoActual: s.correlativoActual,
          }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
