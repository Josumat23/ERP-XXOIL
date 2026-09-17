import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { efectoReanalisis, vencimientoSugerido } from "@/lib/reanalisis";
import { registrarReanalisis } from "../actions";
import ReanalisisFormulario from "./ReanalisisFormulario";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
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
    prisma.envasado.findFirst({
      where: { id, loteGranel: { empresaId: usuario.empresaId } },
      include: {
        loteGranel: { include: { formula: { include: { producto: true } } } },
        reanalisis: {
          include: {
            planInspeccion: { select: { nombre: true } },
            // Qué dio el re-ensayo, no solo que se hizo.
            resultadosCaracteristica: {
              orderBy: { secuencia: "asc" },
              include: { instrumento: { select: { codigo: true, nombre: true } } },
            },
          },
          orderBy: { fecha: "desc" },
        },
        presentacion: true,
        insumos: { include: { insumo: true } },
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
          orderBy: { creadoEn: "asc" },
        },
      },
    }),
    prisma.envasado.findMany({
      where: { loteGranel: { empresaId: usuario.empresaId } },
      include: { presentacion: true },
      orderBy: { fecha: "desc" },
    }),
  ]);
  if (!envasado) notFound();

  // Planes de inspección vigentes del producto: contra qué se puede ensayar.
  const [planes, instrumentos, puedeReanalizar] = await Promise.all([
    prisma.planInspeccionCalidad.findMany({
      where: {
        empresaId: usuario.empresaId,
        activo: true,
        productoId: envasado.loteGranel.formula.productoId,
      },
      include: { caracteristicas: { orderBy: { secuencia: "asc" } } },
      orderBy: { version: "desc" },
    }),
    prisma.instrumentoMedicion.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: "asc" },
    }),
    puedeRealizar(usuario, "produccion", "editar"),
  ]);

  // Sugerencia para el formulario: la vida útil del producto contada desde hoy.
  // Es una sugerencia y no una regla — la vigencia la decide el laboratorio.
  const propuesto = vencimientoSugerido(envasado.loteGranel.formula.producto.vidaUtilMeses);
  const sugerido = propuesto
    ? [
        propuesto.getFullYear(),
        String(propuesto.getMonth() + 1).padStart(2, "0"),
        String(propuesto.getDate()).padStart(2, "0"),
      ].join("-")
    : null;

  const fechaCorta = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

  // Neto vigente (ASIGNADA − LIBERADA) por línea de pedido, para saber a qué
  // clientes/facturas les llegó efectivamente unidades de este envasado hoy.
  const netoPorPedidoDetalle = new Map<
    string,
    { cantidad: number; clienteNombre: string; facturaNumero: string | null; pedidoNumero: string }
  >();
  for (const a of envasado.asignacionesLote) {
    const clave = a.facturaDetalleId ?? a.guiaDetalleId ?? a.pedidoDetalleId;
    const actual = netoPorPedidoDetalle.get(clave) ?? {
      cantidad: 0,
      clienteNombre: a.pedidoDetalle.pedido.cliente.razonSocial,
      facturaNumero:
        a.facturaDetalle?.factura.numero ??
        a.guiaDetalle?.facturaAsignaciones
          .filter((asignacion) => asignacion.facturaDetalle.factura.estado !== "ANULADA")
          .map((asignacion) => asignacion.facturaDetalle.factura.numero)
          .join(", ") ??
        null,
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
            {envasado.reanalisis.length > 0 && (
              <span className="text-neutral-500 font-normal">
                {" "}· vigencia revisada {envasado.reanalisis.length}{" "}
                {envasado.reanalisis.length === 1 ? "vez" : "veces"}
              </span>
            )}
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

        {/*
          Re-análisis de vigencia. Un lubricante no se echa a perder al llegar
          su fecha: se vuelve a ensayar y, si sigue en especificación, se le da
          vigencia nueva. El historial se muestra siempre que exista, porque
          extender un vencimiento sin dejar rastro es lo que una auditoría de
          calidad busca.
        */}
        <section className="borde-seccion mt-6">
          <h2 className="text-lg font-semibold mb-1">Vigencia y re-análisis</h2>
          <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            La vida útil del producto es una estimación conservadora. Llegado el vencimiento, el
            laboratorio vuelve a ensayar el lote y le da vigencia nueva si sigue en especificación.
          </p>

          {envasado.reanalisis.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Resultado</th>
                    <th>Vencía</th>
                    <th>Pasó a</th>
                    <th>Efecto</th>
                    <th>Plan</th>
                    <th>Quién</th>
                  </tr>
                </thead>
                <tbody>
                  {envasado.reanalisis.map((r) => {
                    const efecto = efectoReanalisis(r.vencimientoAnterior, r.vencimientoNuevo);
                    return (
                      <tr key={r.id}>
                        <td>{fechaCorta.format(r.fecha)}</td>
                        <td
                          className={
                            r.resultado === "RECHAZADO"
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : ""
                          }
                        >
                          {r.resultado}
                        </td>
                        <td>{fechaCorta.format(r.vencimientoAnterior)}</td>
                        <td>{fechaCorta.format(r.vencimientoNuevo)}</td>
                        <td>{efecto.texto}</td>
                        <td>
                          {r.planInspeccion
                            ? `${r.planInspeccion.nombre} v${r.planVersion ?? "?"}`
                            : "—"}
                          {/* Qué dio el ensayo. Una vigencia extendida sin esto
                              es una afirmación sin evidencia. */}
                          {r.resultadosCaracteristica.length > 0 ? (
                            <ul className="mt-1 text-xs flex flex-col gap-0.5">
                              {r.resultadosCaracteristica.map((m) => (
                                <li
                                  key={m.id}
                                  className={
                                    m.conforme ? "" : "text-red-600 dark:text-red-400 font-medium"
                                  }
                                >
                                  {m.nombre}: {m.valorMedido.toString()} {m.unidadMedida}
                                  <span style={{ color: "var(--epicor-texto-tenue)" }}>
                                    {" "}
                                    ({m.limiteInferior?.toString() ?? "−∞"} a{" "}
                                    {m.limiteSuperior?.toString() ?? "+∞"})
                                    {m.instrumento ? ` · ${m.instrumento.codigo}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span
                              className="block mt-1 text-xs"
                              style={{ color: "var(--epicor-texto-tenue)" }}
                            >
                              Sin mediciones registradas
                            </span>
                          )}
                        </td>
                        <td>{r.usuarioNombre}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {puedeReanalizar ? (
            <ReanalisisFormulario
              accion={registrarReanalisis.bind(null, envasado.id)}
              planes={planes.map((p) => ({
                id: p.id,
                etiqueta: `${p.nombre} v${p.version}`,
                caracteristicas: p.caracteristicas.map((c) => ({
                  id: c.id,
                  secuencia: c.secuencia,
                  nombre: c.nombre,
                  unidadMedida: c.unidadMedida,
                  limiteInferior: c.limiteInferior?.toString() ?? null,
                  limiteSuperior: c.limiteSuperior?.toString() ?? null,
                  metodoEnsayo: c.metodoEnsayo,
                  obligatoria: c.obligatoria,
                  instrumentoId: c.instrumentoId,
                })),
              }))}
              vencimientoSugerido={sugerido}
              instrumentosDisponibles={instrumentos.map((i) => ({
                id: i.id,
                etiqueta: `${i.codigo} — ${i.nombre}`,
              }))}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
              Su grupo de seguridad no permite registrar re-análisis.
            </p>
          )}
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
