import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

export default async function DetalleGuiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [guia, guias] = await Promise.all([
    prisma.guiaRemision.findUnique({
      where: { id },
      include: {
        cliente: true,
        factura: true,
        detalles: { include: { presentacion: { include: { producto: true } } } },
      },
    }),
    prisma.guiaRemision.findMany({ include: { cliente: true }, orderBy: { creadoEn: "desc" } }),
  ]);
  if (!guia) notFound();

  const totalKg = guia.detalles.reduce(
    (acc, d) => acc + d.cantidad * d.presentacion.contenidoKg.toNumber(),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/logistica/guias-remision" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a guías de remisión
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
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
      <div className="documento border border-black/10 dark:border-white/10 rounded-lg p-6 mt-4">
        <MembreteEmpresa tituloDocumento="GUÍA DE REMISIÓN" numero={guia.numero} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
          <Dato etiqueta="Destinatario" valor={guia.cliente.razonSocial} />
          <Dato etiqueta="RUC / DNI" valor={guia.cliente.ruc ?? "—"} />
          <Dato
            etiqueta="Fecha de traslado"
            valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(guia.fechaTraslado)}
          />
          <Dato etiqueta="Motivo" valor={guia.motivoTraslado} />
          <Dato etiqueta="Punto de partida" valor={guia.puntoPartida} />
          <Dato etiqueta="Punto de llegada" valor={guia.puntoLlegada} />
          <Dato etiqueta="Transportista" valor={guia.transportista ?? "—"} />
          <Dato
            etiqueta="Vehículo / Conductor"
            valor={`${guia.placaVehiculo ?? "—"} / DNI ${guia.dniConductor ?? "—"}`}
          />
          {guia.factura && (
            <Dato
              etiqueta="Factura relacionada"
              valor={guia.factura.numero}
              href={`/comercial/facturas/${guia.factura.id}`}
            />
          )}
        </div>

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>SKU</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Peso (kg)</th>
            </tr>
          </thead>
          <tbody>
            {guia.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.presentacion.producto.nombre} — {d.presentacion.nombre}
                </td>
                <td className="font-mono text-xs">{d.presentacion.sku}</td>
                <td className="text-right">{d.cantidad}</td>
                <td className="text-right">
                  {formatNumero(d.cantidad * d.presentacion.contenidoKg.toNumber(), 2)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="text-right font-semibold">
                Peso total
              </td>
              <td className="text-right font-semibold">{formatNumero(totalKg, 2)} kg</td>
            </tr>
          </tbody>
        </table>

        {guia.observaciones && (
          <p className="text-sm text-neutral-500 mt-4">Observaciones: {guia.observaciones}</p>
        )}

        <p className="text-xs text-neutral-400 mt-6">
          Registrada por {guia.usuarioNombre} el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
            guia.creadoEn
          )}
        </p>
      </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor, href }: { etiqueta: string; valor: string; href?: string }) {
  return (
    <p>
      <span className="text-neutral-500">{etiqueta}: </span>
      {href ? (
        <Link href={href} className="font-medium hover:underline">
          {valor}
        </Link>
      ) : (
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{valor}</span>
      )}
    </p>
  );
}
