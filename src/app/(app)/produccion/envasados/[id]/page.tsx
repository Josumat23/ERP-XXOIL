import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

export default async function DetalleEnvasadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [envasado, envasados] = await Promise.all([
    prisma.envasado.findUnique({
      where: { id },
      include: {
        loteGranel: { include: { formula: { include: { producto: true } } } },
        presentacion: true,
        insumos: { include: { insumo: true } },
        asignacionesLote: {
          include: {
            pedidoDetalle: {
              include: { pedido: { include: { cliente: true } } },
            },
            facturaDetalle: { include: { factura: true } },
          },
          orderBy: { creadoEn: "asc" },
        },
      },
    }),
    prisma.envasado.findMany({ include: { presentacion: true }, orderBy: { fecha: "desc" } }),
  ]);
  if (!envasado) notFound();

  // Neto vigente (ASIGNADA − LIBERADA) por línea de pedido, para saber a qué
  // clientes/facturas les llegó efectivamente unidades de este envasado hoy.
  const netoPorPedidoDetalle = new Map<
    string,
    { cantidad: number; clienteNombre: string; facturaNumero: string | null; pedidoNumero: string }
  >();
  for (const a of envasado.asignacionesLote) {
    const clave = a.facturaDetalleId ?? a.pedidoDetalleId;
    const actual = netoPorPedidoDetalle.get(clave) ?? {
      cantidad: 0,
      clienteNombre: a.pedidoDetalle.pedido.cliente.razonSocial,
      facturaNumero: a.facturaDetalle?.factura.numero ?? null,
      pedidoNumero: a.pedidoDetalle.pedido.numero,
    };
    actual.cantidad += a.tipo === "ASIGNADA" ? a.cantidad : -a.cantidad;
    netoPorPedidoDetalle.set(clave, actual);
  }
  const destinos = [...netoPorPedidoDetalle.values()].filter((d) => d.cantidad > 0);

  return (
    <div>
      <Link href="/produccion/envasados" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a envasados
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/envasados/nuevo"
        nuevoTexto="Nuevo envasado"
        registros={envasados.map((e) => ({
          id: e.id,
          href: `/produccion/envasados/${e.id}`,
          primario: e.codigo,
          secundario: e.presentacion.nombre,
        }))}
      >
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mt-2" style={{ color: "var(--epicor-texto)" }}>
          Envasado {envasado.codigo}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          {envasado.loteGranel.formula.producto.nombre} — {envasado.presentacion.nombre} · Lote{" "}
          <Link href={`/produccion/lotes/${envasado.loteGranelId}`} className="hover:underline font-mono">
            {envasado.loteGranel.codigo}
          </Link>{" "}
          · Registrado por {envasado.usuarioNombre} el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
            envasado.fecha
          )}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <Dato etiqueta="Unidades" valor={String(envasado.unidades)} />
          <Dato etiqueta="Sin vender todavía" valor={String(envasado.unidadesDisponibles)} />
          <Dato etiqueta="Costo total" valor={formatMoneda(envasado.costoTotal)} />
          <Dato etiqueta="Costo unitario" valor={formatMoneda(envasado.costoUnitario)} />
        </div>
        {envasado.fechaVencimiento && (
          <p
            className={`text-sm mt-3 ${
              envasado.fechaVencimiento < new Date()
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-neutral-500"
            }`}
          >
            Vence: {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(envasado.fechaVencimiento)}
            {envasado.fechaVencimiento < new Date() && " — VENCIDO"}
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: "var(--epicor-texto-tenue)" }}>
          Kg de granel consumidos: {formatNumero(envasado.kgConsumidos, 2)}
        </p>

        <p className="text-xs mt-3" style={{ color: "var(--epicor-texto-tenue)" }}>
          Mano de obra: {formatNumero(envasado.horasManoObra, 2)} h = {formatMoneda(envasado.costoManoObra)}
        </p>

        <section className="mt-8">
          <h2 className="font-medium" style={{ color: "var(--epicor-texto)" }}>
            Envases y etiquetas consumidos
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {envasado.insumos.map((i) => (
                <tr key={i.id}>
                  <td>{i.insumo.nombre}</td>
                  <td className="text-right">
                    {formatNumero(i.cantidad, 3)} {i.insumo.unidadMedida}
                  </td>
                </tr>
              ))}
              {envasado.insumos.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-neutral-500 py-4">
                    Sin envases/etiquetas registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="font-medium" style={{ color: "var(--epicor-texto)" }}>
            Trazabilidad — clientes que recibieron este lote
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            Ante un reclamo de calidad o un recall, esta es la lista de facturas que contienen
            unidades de este envasado (y por lo tanto del lote granel {envasado.loteGranel.codigo}).
          </p>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Factura</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((d, i) => (
                <tr key={i}>
                  <td>{d.clienteNombre}</td>
                  <td className="font-mono text-xs">{d.pedidoNumero}</td>
                  <td className="font-mono text-xs">{d.facturaNumero ?? "—"}</td>
                  <td className="text-right">{d.cantidad}</td>
                </tr>
              ))}
              {destinos.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-500 py-4">
                    Todavía no se ha vendido ninguna unidad de este envasado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border rounded-lg p-3" style={{ borderColor: "var(--epicor-borde)" }}>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>{etiqueta}</p>
      <p className="text-xl font-semibold mt-0.5" style={{ color: "var(--epicor-texto)" }}>{valor}</p>
    </div>
  );
}
