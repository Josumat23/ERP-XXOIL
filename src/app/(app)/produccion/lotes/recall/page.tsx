import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import { destinosDeLote, resumenDespacho } from "@/lib/despachoLote";
import { lotesQueConsumieron, resumenTrazabilidadInsumo } from "@/lib/trazabilidadInsumo";

// Vista de recall: dado un lote granel, agrega TODOS sus envasados y TODOS
// los clientes/facturas que recibieron unidades — de un vistazo, sin tener
// que entrar envasado por envasado (que es como se ve la trazabilidad en el
// detalle de cada Envasado).
export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{ loteId?: string; recepcionId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { loteId, recepcionId } = await searchParams;
  const empresaId = usuario.empresaId;

  const [lotes, recepciones] = await Promise.all([
    prisma.loteGranel.findMany({
      where: { empresaId },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
    }),
    // Las recepciones que de verdad entraron en producción. Ofrecer las que
    // nunca se consumieron llenaría el selector de opciones que no contestan
    // nada.
    prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        asignacionesLote: { some: {} },
      },
      select: {
        id: true,
        insumo: { select: { codigo: true, nombre: true } },
        numeroLoteProveedor: true,
        recepcion: { select: { numero: true, fecha: true } },
      },
      orderBy: { recepcion: { fecha: "desc" } },
      take: 200,
    }),
  ]);

  const lote = loteId
    ? await prisma.loteGranel.findFirst({
        where: { id: loteId, empresaId: usuario.empresaId },
        include: {
          formula: { include: { producto: true } },
          envasados: {
            include: {
              presentacion: true,
              asignacionesLote: {
                include: {
                  pedidoDetalle: {
                    include: { pedido: { include: { cliente: true } } },
                  },
                  facturaDetalle: { include: { factura: true } },
                  guiaDetalle: {
                    include: {
                      facturaAsignaciones: {
                        include: { facturaDetalle: { include: { factura: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // La dirección de ida: de un material recibido a los clientes que lo tienen.
  // La ficha del lote ya contesta la de vuelta —de qué recepciones salió— y
  // faltaba esta, que es la del día que un proveedor avisa de un problema.
  const recepcion = recepcionId
    ? await prisma.recepcionCompraDetalle.findFirst({
        where: { id: recepcionId, recepcion: { ordenCompra: { empresaId } } },
        select: {
          id: true,
          cantidad: true,
          cantidadDisponible: true,
          numeroLoteProveedor: true,
          insumo: { select: { codigo: true, nombre: true, unidadMedida: true } },
          recepcion: {
            select: {
              numero: true,
              fecha: true,
              ordenCompra: {
                select: { numero: true, proveedor: { select: { razonSocial: true } } },
              },
            },
          },
          asignacionesLote: {
            select: {
              cantidad: true,
              devolucionAsignacionLoteInsumos: { select: { cantidad: true } },
              loteGranel: {
                select: {
                  id: true,
                  codigo: true,
                  estado: true,
                  formula: { select: { producto: { select: { nombre: true } } } },
                  envasados: {
                    select: {
                      id: true,
                      codigo: true,
                      presentacion: { select: { nombre: true } },
                      asignacionesLote: {
                        select: {
                          tipo: true,
                          cantidad: true,
                          pedidoDetalleId: true,
                          facturaDetalleId: true,
                          guiaDetalleId: true,
                          pedidoDetalle: {
                            select: {
                              pedido: {
                                select: {
                                  numero: true,
                                  cliente: { select: { razonSocial: true } },
                                },
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
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const consumos = recepcion
    ? lotesQueConsumieron(
        recepcion.asignacionesLote.map((a) => ({
          loteGranelId: a.loteGranel.id,
          loteCodigo: a.loteGranel.codigo,
          productoNombre: a.loteGranel.formula.producto.nombre,
          estadoLote: a.loteGranel.estado,
          asignacion: {
            cantidad: a.cantidad.toNumber(),
            devoluciones: a.devolucionAsignacionLoteInsumos.map((d) => ({
              cantidad: d.cantidad.toNumber(),
            })),
          },
          destinos: destinosDeLote(a.loteGranel.envasados),
        }))
      )
    : [];
  const resumenInsumo = resumenTrazabilidadInsumo(consumos);

  // El neto vigente por línea de venta (ASIGNADA − LIBERADA) vive en su propio
  // módulo desde que una tercera pantalla lo necesitó: la de qué reensayar.
  const destinos = lote ? destinosDeLote(lote.envasados) : [];
  const { unidades: totalUnidadesVendidas, clientes: clientesUnicos } = resumenDespacho(destinos);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Trazabilidad / recall
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        La cadena en las dos direcciones. Desde un <strong>lote granel</strong>: todos sus envasados
        y todos los clientes que recibieron unidades. Desde un <strong>material recibido</strong>:
        qué lotes se fabricaron con él y hasta dónde llegaron.
      </p>

      <form method="get" className="mt-5 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Lote granel</span>
          <select name="loteId" defaultValue={loteId ?? ""} className="campo-input min-w-72">
            <option value="" disabled>
              Seleccione
            </option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} — {l.formula.producto.nombre} ({ETIQUETA_ESTADO_LOTE[l.estado]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton-secundario">
          Buscar
        </button>
      </form>

      {lote && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Dato etiqueta="Envasados de este lote" valor={String(lote.envasados.length)} />
            <Dato etiqueta="Unidades vendidas vigentes" valor={formatNumero(totalUnidadesVendidas, 0)} />
            <Dato etiqueta="Clientes distintos afectados" valor={String(clientesUnicos)} />
            <Dato etiqueta="Estado del lote" valor={ETIQUETA_ESTADO_LOTE[lote.estado]} />
          </div>

          <table className="tabla mt-6">
            <thead>
              <tr>
                <th>Envasado</th>
                <th>Presentación</th>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Factura</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((d, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs">
                    <Link href={`/produccion/envasados/${d.envasadoId}`} className="hover:underline">
                      {d.envasadoCodigo}
                    </Link>
                  </td>
                  <td className="text-sm text-neutral-500">{d.presentacionNombre}</td>
                  <td>{d.clienteNombre}</td>
                  <td className="font-mono text-xs">{d.pedidoNumero}</td>
                  <td className="font-mono text-xs">{d.facturaNumero ?? "—"}</td>
                  <td className="text-right">{d.cantidad}</td>
                </tr>
              ))}
              {destinos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-500 py-6">
                    Este lote todavía no tiene unidades vendidas vigentes en ningún cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/*
        La dirección de ida. Va en esta misma pantalla y no en una nueva porque
        es la misma pregunta —«¿a quién le llegó esto?»— entrando por el otro
        extremo de la cadena.
      */}
      <section className="mt-10 border-t border-black/10 dark:border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Desde un material recibido
        </h2>
        <p className="text-neutral-500 text-sm mt-1">
          Qué lotes se fabricaron con una recepción de compra y hasta dónde llegó cada uno. Es la
          consulta del día que un proveedor avisa de un problema con su material.
        </p>

        <form method="get" className="mt-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Material recibido
            </span>
            <select name="recepcionId" defaultValue={recepcionId ?? ""} className="campo-input min-w-96">
              <option value="" disabled>
                Seleccione
              </option>
              {recepciones.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.recepcion.numero} · {r.insumo.codigo} — {r.insumo.nombre}
                  {r.numeroLoteProveedor ? ` · lote ${r.numeroLoteProveedor}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton-secundario">
            Buscar
          </button>
        </form>

        {recepciones.length === 0 && (
          <p className="text-sm text-neutral-500 mt-3">
            Todavía no hay recepciones consumidas en producción. Solo se listan las que ya entraron
            en algún lote: las demás no tienen nada que rastrear.
          </p>
        )}

        {recepcion && (
          <>
            <p className="text-sm text-neutral-500 mt-5">
              {recepcion.insumo.codigo} — {recepcion.insumo.nombre} · recepción{" "}
              {recepcion.recepcion.numero} ({recepcion.recepcion.ordenCompra.numero}) de{" "}
              {recepcion.recepcion.ordenCompra.proveedor.razonSocial}
              {recepcion.numeroLoteProveedor
                ? ` · lote del proveedor ${recepcion.numeroLoteProveedor}`
                : ""}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <Dato
                etiqueta="Recibido"
                valor={`${formatNumero(recepcion.cantidad, 3)} ${recepcion.insumo.unidadMedida}`}
              />
              <Dato
                etiqueta="Sin consumir"
                valor={`${formatNumero(recepcion.cantidadDisponible, 3)} ${recepcion.insumo.unidadMedida}`}
              />
              <Dato etiqueta="Lotes fabricados" valor={String(resumenInsumo.lotes)} />
              <Dato
                etiqueta="Clientes alcanzados"
                valor={String(resumenInsumo.clientesAfectados)}
              />
            </div>

            {consumos.length === 0 ? (
              <p className="text-sm text-neutral-500 mt-4">
                Este material no entró en ningún lote todavía. Si se recibió y está en almacén, no
                hay nada fabricado que rastrear.
              </p>
            ) : (
              <table className="tabla mt-5">
                <thead>
                  <tr>
                    <th>Lote fabricado</th>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th className="text-right">Material usado</th>
                    <th>Hasta dónde llegó</th>
                  </tr>
                </thead>
                <tbody>
                  {consumos.map((c) => {
                    const salida = resumenDespacho(c.destinos);
                    return (
                      <tr key={c.loteGranelId}>
                        <td className="font-medium align-top">
                          <Link
                            href={`/produccion/lotes/${c.loteGranelId}`}
                            className="hover:underline"
                          >
                            {c.loteCodigo}
                          </Link>
                        </td>
                        <td className="align-top">{c.productoNombre}</td>
                        <td className="align-top text-sm">
                          {ETIQUETA_ESTADO_LOTE[c.estadoLote as keyof typeof ETIQUETA_ESTADO_LOTE] ??
                            c.estadoLote}
                        </td>
                        <td className="align-top text-right">
                          {formatNumero(c.cantidadConsumida, 3)} {recepcion.insumo.unidadMedida}
                        </td>
                        <td className="align-top">
                          {salida.unidades > 0 ? (
                            <>
                              <span className="text-red-700 dark:text-red-400 font-medium">
                                {formatNumero(salida.unidades, 0)} unidades en{" "}
                                {salida.clientes === 1 ? "1 cliente" : `${salida.clientes} clientes`}
                              </span>
                              {" · "}
                              <Link
                                href={`/produccion/lotes/recall?loteId=${c.loteGranelId}`}
                                className="hover:underline text-blue-700 dark:text-blue-400"
                              >
                                ver a quiénes
                              </Link>
                            </>
                          ) : (
                            <span className="text-neutral-500">No salió a ningún cliente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
