import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { seriesActivas } from "@/lib/series";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import GuiaFormulario from "../GuiaFormulario";

export default async function NuevaGuiaPage({
  searchParams,
}: {
  searchParams: Promise<{ pedidoId?: string }>;
}) {
  const { pedidoId: pedidoInicialId } = await searchParams;
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const [pedidosRaw, facturas, clientes, presentaciones, equipos, series, guias, ubigeos] = await Promise.all([
    prisma.pedido.findMany({
      where: { requiereEntrega: true, estado: { not: "ANULADO" } },
      include: {
        cliente: true,
        detalles: {
          include: {
            presentacion: { include: { producto: true } },
            guiaDetalles: { include: { guia: { select: { estadoDespacho: true } } } },
          },
        },
      },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" } },
      include: {
        cliente: true,
        detalles: true,
        pedido: true,
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
    prisma.equipo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    seriesActivas("GUIA_REMISION"),
    prisma.guiaRemision.findMany({ include: { cliente: true }, orderBy: { creadoEn: "desc" } }),
    prisma.ubigeo.findMany({ orderBy: [{ departamento: "asc" }, { provincia: "asc" }, { distrito: "asc" }] }),
  ]);

const pedidos = pedidosRaw
    .map((pedido) => ({
      id: pedido.id,
      etiqueta: `${pedido.numero} — ${pedido.cliente.razonSocial}`,
      clienteId: pedido.clienteId,
      lineas: pedido.detalles
        .map((detalle) => {
          const planificado = detalle.guiaDetalles
            .filter((guia) => guia.guia.estadoDespacho !== "ANULADO")
            .reduce((total, guia) => total + guia.cantidad, 0);
          return {
            pedidoDetalleId: detalle.id,
            presentacionId: detalle.presentacionId,
            etiqueta: `${detalle.presentacion.producto.nombre} — ${detalle.presentacion.nombre}`,
            sku: detalle.presentacion.sku,
            cantidadPedida: detalle.cantidad,
            cantidadPlanificada: planificado,
            saldo: detalle.cantidad - planificado,
          };
        })
        .filter((linea) => linea.saldo > 0),
    }))
    .filter((pedido) => pedido.lineas.length > 0);

  return (    <div>
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
          pedidos={pedidos}
          pedidoInicialId={pedidos.some((pedido) => pedido.id === pedidoInicialId) ? pedidoInicialId : undefined}
          puntoPartidaDefecto="Planta de producción"
          facturas={facturas.map((f) => ({
            id: f.id,
            etiqueta: `${f.numero} — ${f.cliente.razonSocial}`,
            clienteId: f.clienteId,
            pedidoId: f.pedidoId,
            lineas: f.detalles.map((d) => ({
              presentacionId: d.presentacionId,
              cantidad: d.cantidad,
            })),
          }))}
          clientes={clientes.map((c) => ({ id: c.id, etiqueta: c.razonSocial }))}
          presentaciones={presentaciones.map((p) => ({
            id: p.id,
            etiqueta: `${p.producto.nombre} — ${p.nombre}`,
          }))}
          equipos={equipos.map((e) => ({ id: e.id, etiqueta: `${e.codigo} — ${e.nombre}` }))}
          ubigeos={ubigeos.map((u) => ({
            id: u.id,
            codigo: u.codigo,
            departamento: u.departamento,
            etiqueta: `${u.provincia} - ${u.distrito} (${u.codigo})`,
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
