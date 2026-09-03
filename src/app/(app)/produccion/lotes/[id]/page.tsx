import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import FinalizarLoteFormulario from "./FinalizarLoteFormulario";
import DisponerLoteFormulario from "./DisponerLoteFormulario";
import OperacionFormulario from "./OperacionFormulario";
import { liberarLote } from "../actions";
import CancelarLoteFormulario from "./CancelarLoteFormulario";
import AjusteMaterialFormulario from "./AjusteMaterialFormulario";

const COLOR_ESTADO: Record<string, string> = {
  PLANIFICADO: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  CANCELADO: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  EN_PROCESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  PENDIENTE_CALIDAD: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function DetalleLotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [lote, lotes] = await Promise.all([
    prisma.loteGranel.findUnique({
      where: { id },
      include: {
        formula: { include: { producto: true, detalles: { include: { insumo: true } } } },
        controlCalidad: { include: { resultadosCaracteristica: { select: { id: true } } } },
        envasados: { include: { presentacion: true } },
        loteOrigen: { include: { formula: { include: { producto: true } } } },
        reprocesos: { include: { formula: { include: { producto: true } } } },
        operaciones: { include: { centroTrabajo: true, equipo: true }, orderBy: { secuencia: "asc" } },
        reservasInsumo: { include: { insumo: true }, orderBy: { insumo: { codigo: "asc" } } },
        movimientosMaterial: { include: { insumo: true }, orderBy: { creadoEn: "asc" } },
      },
    }),
    prisma.loteGranel.findMany({
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
    }),
  ]);
  if (!lote) notFound();
  const [equipos, insumosActivos] = await Promise.all([
    prisma.equipo.findMany({ where: { activo: true, centroTrabajoId: { in: lote.operaciones.map((operacion) => operacion.centroTrabajoId) } }, orderBy: { codigo: "asc" } }),
    prisma.insumo.findMany({ where: { activo: true, tipo: "MATERIA_PRIMA" }, orderBy: { codigo: "asc" } }),
  ]);

  const consumos = await prisma.movimientoKardex.findMany({
    where: { origen: "PRODUCCION", referencia: { contains: lote.codigo } },
    include: { insumo: true },
    orderBy: { creadoEn: "asc" },
  });

  const asignacionesLoteInsumo = await prisma.asignacionLoteInsumo.findMany({
    where: { loteGranelId: id },
    include: { recepcionCompraDetalle: { include: { insumo: true, recepcion: true } } },
    orderBy: { creadoEn: "asc" },
  });

  return (
    <div>
      <Link href="/produccion/lotes" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a órdenes de producción
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/lotes/nuevo"
        nuevoTexto="Nueva orden"
        registros={lotes.map((l) => ({
          id: l.id,
          href: `/produccion/lotes/${l.id}`,
          primario: l.codigo,
          secundario: l.formula.producto.nombre,
        }))}
      >
      <div className="max-w-3xl">
      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Orden de producción {lote.codigo}
        </h1>
        <span className={`insignia ${COLOR_ESTADO[lote.estado]}`}>
          {ETIQUETA_ESTADO_LOTE[lote.estado]}
        </span>
      </div>
      <p className="text-neutral-500 mt-1">
        {lote.formula.producto.nombre} — fórmula v{lote.formula.version} · Creado por{" "}
        {lote.usuarioNombre} el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
          lote.fechaCreacion ?? lote.fechaInicio
        )}
      </p>
      {lote.fechaLiberacion && <p className="text-xs text-neutral-500 mt-1">Liberada por {lote.usuarioLiberacionNombre} el {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(lote.fechaLiberacion)}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <Dato etiqueta="Kg objetivo" valor={formatNumero(lote.kgObjetivo, 2)} />
        <Dato
          etiqueta="Kg producidos"
          valor={["PLANIFICADO", "CANCELADO", "EN_PROCESO"].includes(lote.estado) ? "—" : formatNumero(lote.kgProducidos, 2)}
        />
        <Dato
          etiqueta="Merma (kg)"
          valor={["PLANIFICADO", "CANCELADO", "EN_PROCESO"].includes(lote.estado) ? "—" : formatNumero(lote.mermaKg, 2)}
        />
        <Dato etiqueta="Granel disponible" valor={formatNumero(lote.kgDisponibles, 2)} />
        <Dato
          etiqueta="Costo por kg"
          valor={["PLANIFICADO", "CANCELADO", "EN_PROCESO"].includes(lote.estado) ? "—" : `S/ ${formatNumero(lote.costoKg, 2)}`}
        />
      </div>

      {!(["PLANIFICADO", "CANCELADO", "EN_PROCESO"] as string[]).includes(lote.estado) && (
        <p className="text-xs text-neutral-500 mt-2">
          Costo insumos: S/ {formatNumero(lote.costoInsumos, 2)} + Reproceso: S/ {formatNumero(lote.costoReproceso, 2)} + Mano de obra:{" "}
          {formatNumero(lote.horasManoObra, 2)} h × S/{" "}
          {lote.horasManoObra.toNumber() > 0
            ? formatNumero(lote.costoManoObra.toNumber() / lote.horasManoObra.toNumber(), 2)
            : "0.00"}
          /h = S/ {formatNumero(lote.costoManoObra, 2)}
        </p>
      )}

      {lote.variacionTotal !== null && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Costo estándar vs. real
            </h2>
            <Link href="/produccion/variaciones" className="text-sm hover:underline">
              Ver análisis consolidado
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <Dato etiqueta="Estándar objetivo" valor={formatMoneda(lote.costoEstandarTotal ?? 0)} />
            <Dato etiqueta="Estándar permitido" valor={formatMoneda(lote.costoEstandarPermitido ?? 0)} />
            <Dato
              etiqueta="Costo real"
              valor={formatMoneda(
                lote.costoInsumos.toNumber() +
                  lote.costoReproceso.toNumber() +
                  lote.costoManoObra.toNumber()
              )}
            />
            <Dato etiqueta="Variación total" valor={formatMoneda(lote.variacionTotal)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
            <Variacion etiqueta="Insumos / reproceso" valor={lote.variacionInsumos?.toNumber() ?? 0} />
            <Variacion etiqueta="Mano de obra" valor={lote.variacionManoObra?.toNumber() ?? 0} />
            <Variacion etiqueta="Rendimiento" valor={lote.variacionRendimiento?.toNumber() ?? 0} />
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Positivo = desfavorable (costo real superior al permitido); negativo = favorable.
          </p>
        </section>
      )}

      {lote.observaciones && (
        <p className="text-sm text-neutral-500 mt-4">Observaciones: {lote.observaciones}</p>
      )}

      {lote.loteOrigen && (
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
          Reprocesa el lote rechazado{" "}
          <Link href={`/produccion/lotes/${lote.loteOrigen.id}`} className="hover:underline font-mono">
            {lote.loteOrigen.codigo}
          </Link>
          .
        </p>
      )}
      {lote.reprocesos.length > 0 && (
        <p className="text-sm text-neutral-500 mt-2">
          Reprocesado en:{" "}
          {lote.reprocesos.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/produccion/lotes/${r.id}`} className="hover:underline font-mono">
                {r.codigo}
              </Link>
            </span>
          ))}
        </p>
      )}

      {lote.estado === "PLANIFICADO" && <section className="mt-8 border border-blue-200 dark:border-blue-900 rounded-lg p-4"><h2 className="font-medium">Liberar orden de producción</h2><p className="text-sm text-neutral-500 mt-1">Valida stock, consume materiales por FIFO, registra trazabilidad y contabiliza el WIP en una sola transacción.</p><form action={liberarLote.bind(null, lote.id)} className="mt-3"><button className="boton-primario">Liberar y emitir materiales</button></form><CancelarLoteFormulario loteId={lote.id} /></section>}

      {lote.estado === "CANCELADO" && <p className="mt-4 text-sm text-red-700 dark:text-red-400">Cancelada por {lote.usuarioCancelacionNombre}: {lote.motivoCancelacion}</p>}

      {lote.reservasInsumo.length > 0 && <section className="mt-8"><h2 className="font-medium">Materiales reservados</h2><table className="tabla mt-2"><thead><tr><th>Insumo</th><th className="text-right">Comprometido</th><th className="text-right">Stock físico</th></tr></thead><tbody>{lote.reservasInsumo.map((reserva) => <tr key={reserva.id}><td>{reserva.insumo.codigo} — {reserva.insumo.nombre}</td><td className="text-right">{formatNumero(reserva.cantidad, 3)} {reserva.insumo.unidadMedida}</td><td className={`text-right ${reserva.insumo.stock.lt(reserva.cantidad) ? "text-red-600 font-medium" : ""}`}>{formatNumero(reserva.insumo.stock, 3)} {reserva.insumo.unidadMedida}</td></tr>)}</tbody></table></section>}

      {lote.estado === "EN_PROCESO" && <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4"><h2 className="font-medium">Ajustes de materiales</h2><p className="text-xs text-neutral-500 mt-1">Registra desviaciones contra la receta; cada movimiento actualiza kardex, trazabilidad y WIP.</p><AjusteMaterialFormulario loteId={lote.id} insumos={insumosActivos.map((insumo) => ({ id: insumo.id, codigo: insumo.codigo, nombre: insumo.nombre, unidad: insumo.unidadMedida }))} />{lote.movimientosMaterial.length > 0 && <table className="tabla mt-4"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Insumo / motivo</th><th className="text-right">Cantidad</th><th className="text-right">Costo</th></tr></thead><tbody>{lote.movimientosMaterial.map((movimiento) => <tr key={movimiento.id}><td className="text-xs">{new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(movimiento.creadoEn)}</td><td>{movimiento.tipo === "DEVOLUCION" ? "Devolución" : "Consumo adicional"}</td><td>{movimiento.insumo.codigo} — {movimiento.insumo.nombre}<span className="block text-xs text-neutral-500">{movimiento.motivo} · {movimiento.usuarioNombre}</span></td><td className="text-right">{formatNumero(movimiento.cantidad, 3)}</td><td className="text-right">{formatMoneda(movimiento.costoTotal)}</td></tr>)}</tbody></table>}</section>}

      {lote.operaciones.length > 0 && <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Ruta y confirmaciones</h2>
        <p className="text-xs text-neutral-500 mt-1">Ejecución secuencial; tiempos: preparación / máquina / mano de obra.</p>
        <div className="mt-2 flex flex-col gap-2">{lote.operaciones.map((operacion) => <article key={operacion.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <div className="flex justify-between gap-3"><div><strong>{operacion.secuencia}. {operacion.nombre}</strong><p className="text-xs text-neutral-500">{operacion.centroTrabajo.codigo} — {operacion.centroTrabajo.nombre} · Plan {formatNumero(operacion.preparacionPlanHoras, 2)} / {formatNumero(operacion.maquinaPlanHoras, 2)} / {formatNumero(operacion.manoObraPlanHoras, 2)} h{operacion.fechaPlanInicio ? ` · ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(operacion.fechaPlanInicio)}–${new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(operacion.fechaPlanFin ?? operacion.fechaPlanInicio)}` : " · Sin nivelar"}</p></div><span className="text-xs font-medium">{operacion.estado.replace("_", " ")}</span></div>
          {operacion.estado === "COMPLETADA" && <p className="text-xs mt-2">Real {formatNumero(operacion.preparacionRealHoras, 2)} / {formatNumero(operacion.maquinaRealHoras, 2)} / {formatNumero(operacion.manoObraRealHoras, 2)} h{operacion.equipo ? ` · ${operacion.equipo.codigo}` : ""}</p>}
          {lote.estado === "EN_PROCESO" && <div className="mt-2"><OperacionFormulario operacionId={operacion.id} estado={operacion.estado} equipos={equipos.filter((equipo) => equipo.centroTrabajoId === operacion.centroTrabajoId).map((equipo) => ({ id: equipo.id, codigo: equipo.codigo, nombre: equipo.nombre }))} /></div>}
        </article>)}</div>
      </section>}

      {lote.estado === "EN_PROCESO" && (
        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Finalizar cocción
          </h2>
          <FinalizarLoteFormulario loteId={lote.id} kgObjetivo={lote.kgObjetivo.toNumber()} tieneRuta={lote.operaciones.length > 0} />
        </section>
      )}

      {lote.estado === "RECHAZADO" && !lote.disposicionRechazo && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <h2 className="font-medium text-red-700 dark:text-red-400">Disposición del lote rechazado</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Reprocéselo desde una nueva orden o registre su descarte. Un lote solo puede disponerse una vez.
          </p>
          <DisponerLoteFormulario loteId={lote.id} />
        </section>
      )}

      {lote.disposicionRechazo && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Disposición: <strong>{lote.disposicionRechazo === "REPROCESADO" ? "Reprocesado" : "Desechado"}</strong>
          {lote.motivoDisposicion ? ` — ${lote.motivoDisposicion}` : ""}
        </p>
      )}

      {lote.controlCalidad && (
        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Control de calidad</h2>
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-2 text-sm">
            <p>
              Resultado:{" "}
              <span
                className={
                  lote.controlCalidad.resultado === "APROBADO"
                    ? "text-green-700 dark:text-green-400 font-medium"
                    : "text-red-600 dark:text-red-400 font-medium"
                }
              >
                {lote.controlCalidad.resultado === "APROBADO" ? "Aprobado" : "Rechazado"}
              </span>
            </p>
            {lote.controlCalidad.observaciones && (
              <p className="text-neutral-500 mt-1">{lote.controlCalidad.observaciones}</p>
            )}
            {lote.controlCalidad.causaRaiz && (
              <p className="text-neutral-500 mt-1">Causa raíz: {lote.controlCalidad.causaRaiz}</p>
            )}
            {lote.controlCalidad.accionCorrectiva && (
              <p className="text-neutral-500 mt-1">
                Acción correctiva: {lote.controlCalidad.accionCorrectiva}
              </p>
            )}
            <p className="text-xs text-neutral-400 mt-2">
              Evaluado por {lote.controlCalidad.usuarioNombre} el{" "}
              {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
                lote.controlCalidad.fecha
              )}
            </p>
            {lote.controlCalidad.resultado === "APROBADO" && lote.controlCalidad.resultadosCaracteristica.length > 0 && <Link href={`/produccion/calidad/certificados/${lote.id}`} className="boton-secundario inline-block mt-3 no-imprimir">Certificado de análisis</Link>}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Insumos consumidos</h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {consumos.map((c) => (
              <tr key={c.id}>
                <td>{c.insumo?.nombre}</td>
                <td className="text-right">
                  {formatNumero(c.cantidad, 3)} {c.insumo?.unidadMedida}
                </td>
              </tr>
            ))}
            {consumos.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-neutral-500 py-4">
                  Sin consumos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Trazabilidad de materia prima
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          Ante un problema de calidad de un insumo, esta es la lista de recepciones (y lotes del
          proveedor) que se consumieron en este lote.
        </p>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Recepción</th>
              <th>Lote del proveedor</th>
              <th className="text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {asignacionesLoteInsumo.map((a) => (
              <tr key={a.id}>
                <td>{a.recepcionCompraDetalle.insumo.nombre}</td>
                <td className="font-mono text-xs">{a.recepcionCompraDetalle.recepcion.numero}</td>
                <td className="font-mono text-xs">
                  {a.recepcionCompraDetalle.numeroLoteProveedor ?? "—"}
                </td>
                <td className="text-right">{formatNumero(a.cantidad, 3)}</td>
              </tr>
            ))}
            {asignacionesLoteInsumo.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-neutral-500 py-4">
                  Sin trazabilidad registrada (puede ser stock cargado antes de habilitar esta
                  función).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Envasados del lote</h2>
          {lote.estado === "APROBADO" && lote.kgDisponibles.toNumber() > 0 && (
            <Link
              href={`/produccion/envasados/nuevo?loteId=${lote.id}`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              + Envasar este lote
            </Link>
          )}
        </div>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Código</th>
              <th>Presentación</th>
              <th className="text-right">Unidades</th>
              <th className="text-right">Kg consumidos</th>
            </tr>
          </thead>
          <tbody>
            {lote.envasados.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{e.codigo}</td>
                <td>{e.presentacion.nombre}</td>
                <td className="text-right">{e.unidades}</td>
                <td className="text-right">{formatNumero(e.kgConsumidos, 2)}</td>
              </tr>
            ))}
            {lote.envasados.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-neutral-500 py-4">
                  Aún no se ha envasado este lote.
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
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}

function Variacion({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 flex justify-between gap-3">
      <span className="text-neutral-500">{etiqueta}</span>
      <span className={valor > 0 ? "text-red-600 dark:text-red-400 font-medium" : valor < 0 ? "text-green-700 dark:text-green-400 font-medium" : ""}>
        {formatMoneda(valor)}
      </span>
    </div>
  );
}
