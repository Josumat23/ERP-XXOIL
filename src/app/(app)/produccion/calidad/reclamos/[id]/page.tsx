import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BotonImprimir from "@/components/BotonImprimir";
import ReclamoEstadoFormulario from "./ReclamoEstadoFormulario";
import { lotesDeUnaVenta } from "@/lib/despachoLote";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  CERRADO: "Cerrado",
};

export default async function DetalleReclamoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [reclamo, reclamos] = await Promise.all([
    prisma.reclamoCliente.findFirst({
      where: { id, empresaId: usuario.empresaId },
      include: { cliente: true, factura: true, causa: true },
    }),
    prisma.reclamoCliente.findMany({
      where: { empresaId: usuario.empresaId },
      include: { cliente: true },
      orderBy: { creadoEn: "desc" },
    }),
  ]);
  if (!reclamo) notFound();

  // -------------------------------------------------------------------------
  // De qué lote salió lo que reclaman.
  //
  // El reclamo registra cliente, factura, causa y descripción — y nada sobre el
  // LOTE. Quien investiga no sabía qué revisar ni si el problema alcanza a
  // alguien más, aunque el dato estuviera guardado: el ledger de asignaciones
  // de venta existe, según su propio comentario, «para responder ante un
  // reclamo de calidad o un recall». Nadie lo había conectado.
  //
  // Se deriva de la factura, sin declarar nada nuevo en el reclamo. Si la
  // factura llevó tres lotes, los tres son candidatos y se muestran los tres:
  // elegir uno sería inventar una precisión que el documento no tiene.
  //
  // Los dos caminos cuentan. Una unidad puede estar atada al renglón de la
  // factura o al de la guía que esa factura ampara; mirar solo el primero
  // devolvería media respuesta con cara de completa.
  const deLaFactura = reclamo.facturaId
    ? {
        OR: [
          { facturaDetalle: { facturaId: reclamo.facturaId } },
          {
            guiaDetalle: {
              facturaAsignaciones: { some: { facturaDetalle: { facturaId: reclamo.facturaId } } },
            },
          },
        ],
      }
    : null;
  const envasadosDeLaFactura = deLaFactura
    ? await prisma.envasado.findMany({
        where: { empresaId: usuario.empresaId, asignacionesLote: { some: deLaFactura } },
        select: {
          id: true,
          codigo: true,
          presentacion: { select: { nombre: true } },
          loteGranel: {
            select: {
              id: true,
              codigo: true,
              estado: true,
              formula: { select: { producto: { select: { nombre: true } } } },
            },
          },
          // Solo los renglones de ESTA factura: la resta de lo liberado es por
          // renglón, y mezclar otras ventas daría un neto que no es de acá.
          asignacionesLote: {
            where: deLaFactura,
            select: {
              tipo: true,
              cantidad: true,
              pedidoDetalleId: true,
              facturaDetalleId: true,
              guiaDetalleId: true,
              pedidoDetalle: {
                select: {
                  pedido: {
                    select: { numero: true, cliente: { select: { id: true, razonSocial: true } } },
                  },
                },
              },
              facturaDetalle: { select: { factura: { select: { numero: true } } } },
              guiaDetalle: {
                select: {
                  facturaAsignaciones: {
                    select: {
                      facturaDetalle: {
                        select: { factura: { select: { numero: true, estado: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const lotesReclamados = lotesDeUnaVenta(envasadosDeLaFactura);

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/produccion/calidad/reclamos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a reclamos de cliente
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={reclamos.map((r) => ({
          id: r.id,
          href: `/produccion/calidad/reclamos/${r.id}`,
          primario: r.numero,
          secundario: r.cliente.razonSocial,
        }))}
      >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            {reclamo.numero}
          </h1>
          <span
            className={`insignia ${
              reclamo.estado === "CERRADO"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : reclamo.estado === "EN_PROCESO"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
            }`}
          >
            {ETIQUETA_ESTADO[reclamo.estado]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
          <Dato etiqueta="Cliente" valor={reclamo.cliente.razonSocial} href={`/comercial/clientes/${reclamo.cliente.id}`} />
          {reclamo.factura && (
            <Dato etiqueta="Factura relacionada" valor={reclamo.factura.numero} href={`/comercial/facturas/${reclamo.factura.id}`} />
          )}
          <Dato etiqueta="Causa" valor={reclamo.causa?.nombre ?? "Sin determinar"} />
          <Dato
            etiqueta="Fecha"
            valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(reclamo.fecha)}
          />
          {reclamo.fechaCierre && (
            <Dato
              etiqueta="Fecha de cierre"
              valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(reclamo.fechaCierre)}
            />
          )}
          <Dato etiqueta="Registrado por" valor={reclamo.usuarioNombre} />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Descripción
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
            {reclamo.descripcion}
          </p>
        </div>

        {/*
          De qué lote salió.
          =================
          Va después de la descripción y antes de la acción correctiva, que es
          el orden en que se investiga: qué pasó, con qué producto, qué se hizo.
        */}
        <div className="mt-5 border-t border-black/10 dark:border-white/10 pt-4">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            De qué lote salió
          </p>
          {!reclamo.facturaId ? (
            <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
              Este reclamo no tiene factura relacionada, así que no hay por dónde llegar al lote.
              Si se conoce el documento de la venta, indíquelo al registrarlo.
            </p>
          ) : lotesReclamados.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
              La factura {reclamo.factura?.numero} no tiene unidades vigentes asignadas a ningún
              lote. Puede ser una venta anterior a la trazabilidad por lote, o una factura anulada
              o devuelta por completo.
            </p>
          ) : (
            <>
              <p className="text-sm mb-2" style={{ color: "var(--epicor-texto-tenue)" }}>
                {lotesReclamados.length === 1
                  ? "La factura llevó un solo lote."
                  : `La factura llevó ${lotesReclamados.length} lotes: el reclamo corresponde a alguno de ellos.`}{" "}
                Derivado de la venta; el reclamo no declara el lote.
              </p>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th className="text-right">Unidades</th>
                    <th>Envases</th>
                    <th className="no-imprimir">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesReclamados.map((l) => (
                    <tr key={l.loteGranelId}>
                      <td className="font-medium align-top">
                        <Link href={`/produccion/lotes/${l.loteGranelId}`} className="hover:underline">
                          {l.loteCodigo}
                        </Link>
                      </td>
                      <td className="align-top">{l.productoNombre}</td>
                      <td className="align-top text-sm">
                        {ETIQUETA_ESTADO_LOTE[l.estadoLote as keyof typeof ETIQUETA_ESTADO_LOTE] ??
                          l.estadoLote}
                      </td>
                      <td className="align-top text-right">{l.unidades}</td>
                      <td className="align-top text-sm">
                        {l.envasados.map((e) => (
                          <span key={e.codigo} className="block">
                            <span className="font-mono text-xs">{e.codigo}</span> · {e.presentacion}{" "}
                            × {e.cantidad}
                          </span>
                        ))}
                      </td>
                      <td className="align-top text-sm no-imprimir">
                        <Link
                          href={`/produccion/lotes/recall?loteId=${l.loteGranelId}`}
                          className="hover:underline text-blue-700 dark:text-blue-400"
                        >
                          quién más lo tiene
                        </Link>
                        <Link
                          href={`/produccion/calidad/certificados/${l.loteGranelId}`}
                          className="block hover:underline text-blue-700 dark:text-blue-400"
                        >
                          certificado
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {reclamo.accionCorrectiva && (
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Acción correctiva
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
              {reclamo.accionCorrectiva}
            </p>
          </div>
        )}

        <div className="mt-6 no-imprimir">
          <ReclamoEstadoFormulario
            reclamoId={reclamo.id}
            estado={reclamo.estado}
            accionCorrectivaActual={reclamo.accionCorrectiva}
          />
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
