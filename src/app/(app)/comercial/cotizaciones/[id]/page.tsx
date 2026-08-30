import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { marcarCotizacion, convertirCotizacionAPedido } from "../actions";
import ProbabilidadFormulario from "../ProbabilidadFormulario";

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  VENCIDA: "Vencida",
  CONVERTIDA: "Convertida a pedido",
};

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  ACEPTADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  VENCIDA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  CONVERTIDA: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
};

export default async function DetalleCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const { id } = await params;

  const [cotizacion, cotizaciones] = await Promise.all([
    prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        detalles: { include: { presentacion: { include: { producto: true } } } },
        pedido: { include: { facturas: { orderBy: { fechaEmision: "desc" } } } },
      },
    }),
    prisma.cotizacion.findMany({ include: { cliente: true }, orderBy: { fecha: "desc" } }),
  ]);
  if (!cotizacion) notFound();

  const vencida = cotizacion.estado === "PENDIENTE" && cotizacion.validaHasta < new Date();
  const puedeGestionar = cotizacion.estado === "PENDIENTE" && !vencida;
  const puedeConvertir =
    (cotizacion.estado === "PENDIENTE" || cotizacion.estado === "ACEPTADA") && !vencida;

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/comercial/cotizaciones" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a cotizaciones
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={cotizaciones.map((c) => ({
          id: c.id,
          href: `/comercial/cotizaciones/${c.id}`,
          primario: c.numero,
          secundario: c.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <MembreteEmpresa soloImprimir tituloDocumento="COTIZACIÓN" numero={cotizacion.numero} />

        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
            {cotizacion.numero}
          </h1>
          <span className={`insignia ${COLOR_ESTADO[vencida ? "VENCIDA" : cotizacion.estado]}`}>
            {ETIQUETA_ESTADO[vencida ? "VENCIDA" : cotizacion.estado]}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          {cotizacion.cliente.razonSocial} · Vendedor: {cotizacion.vendedor.nombre} · Válida hasta{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(cotizacion.validaHasta)}
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          Probabilidad de cierre: {cotizacion.probabilidad}% · Valor ponderado:{" "}
          {formatMoneda(cotizacion.total.toNumber() * (cotizacion.probabilidad / 100))}
        </p>

        {cotizacion.pedido && (
          <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
            Convertida en el pedido{" "}
            <Link href={`/comercial/pedidos/${cotizacion.pedido.id}`} className="hover:underline font-mono">
              {cotizacion.pedido.numero}
            </Link>
            {cotizacion.pedido.facturas[0] && (
              <>
                {" "}
                — facturado como{" "}
                <Link
                  href={`/comercial/facturas/${cotizacion.pedido.facturas[0].id}`}
                  className="hover:underline font-mono"
                >
                  {cotizacion.pedido.facturas[0].numero}
                </Link>
              </>
            )}
          </p>
        )}

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Presentación</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Precio unit.</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cotizacion.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.presentacion.producto.nombre} — {d.presentacion.nombre}
                </td>
                <td className="text-right">{d.cantidad}</td>
                <td className="text-right">{formatMoneda(d.precioUnitario)}</td>
                <td className="text-right">{formatMoneda(d.subtotal)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="text-right font-semibold">
                Total
              </td>
              <td className="text-right font-semibold">{formatMoneda(cotizacion.total)}</td>
            </tr>
          </tbody>
        </table>

        {cotizacion.notas && <p className="text-sm text-neutral-500 mt-4">Notas: {cotizacion.notas}</p>}

        {puedeGestionar && (
          <div className="mt-6">
            <ProbabilidadFormulario cotizacionId={id} probabilidadActual={cotizacion.probabilidad} />
          </div>
        )}

        {(puedeGestionar || puedeConvertir) && (
          <div className="flex flex-wrap gap-3 mt-6 no-imprimir">
            {puedeGestionar && (
              <>
                <form
                  action={async () => {
                    "use server";
                    await marcarCotizacion(id, "ACEPTADA");
                  }}
                >
                  <button type="submit" className="boton-secundario">
                    Marcar como aceptada
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await marcarCotizacion(id, "RECHAZADA");
                  }}
                >
                  <button type="submit" className="text-sm text-red-600 dark:text-red-400 hover:underline">
                    Marcar como rechazada
                  </button>
                </form>
              </>
            )}
            {puedeConvertir && (
              <form
                action={async () => {
                  "use server";
                  await convertirCotizacionAPedido(id);
                }}
              >
                <button type="submit" className="boton-primario">
                  Convertir a pedido
                </button>
              </form>
            )}
          </div>
        )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
