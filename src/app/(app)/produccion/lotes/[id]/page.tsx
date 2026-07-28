import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import FinalizarLoteFormulario from "./FinalizarLoteFormulario";

const COLOR_ESTADO: Record<string, string> = {
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
  const { id } = await params;

  const [lote, lotes] = await Promise.all([
    prisma.loteGranel.findUnique({
      where: { id },
      include: {
        formula: { include: { producto: true, detalles: { include: { insumo: true } } } },
        controlCalidad: true,
        envasados: { include: { presentacion: true } },
        loteOrigen: { include: { formula: { include: { producto: true } } } },
        reprocesos: { include: { formula: { include: { producto: true } } } },
      },
    }),
    prisma.loteGranel.findMany({
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
    }),
  ]);
  if (!lote) notFound();

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
        {lote.formula.producto.nombre} — fórmula v{lote.formula.version} · Iniciado por{" "}
        {lote.usuarioNombre} el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
          lote.fechaInicio
        )}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <Dato etiqueta="Kg objetivo" valor={formatNumero(lote.kgObjetivo, 2)} />
        <Dato
          etiqueta="Kg producidos"
          valor={lote.estado === "EN_PROCESO" ? "—" : formatNumero(lote.kgProducidos, 2)}
        />
        <Dato
          etiqueta="Merma (kg)"
          valor={lote.estado === "EN_PROCESO" ? "—" : formatNumero(lote.mermaKg, 2)}
        />
        <Dato etiqueta="Granel disponible" valor={formatNumero(lote.kgDisponibles, 2)} />
        <Dato
          etiqueta="Costo por kg"
          valor={lote.estado === "EN_PROCESO" ? "—" : `S/ ${formatNumero(lote.costoKg, 2)}`}
        />
      </div>

      {lote.estado !== "EN_PROCESO" && (
        <p className="text-xs text-neutral-500 mt-2">
          Costo insumos: S/ {formatNumero(lote.costoInsumos, 2)} + Mano de obra:{" "}
          {formatNumero(lote.horasManoObra, 2)} h × S/{" "}
          {lote.horasManoObra.toNumber() > 0
            ? formatNumero(lote.costoManoObra.toNumber() / lote.horasManoObra.toNumber(), 2)
            : "0.00"}
          /h = S/ {formatNumero(lote.costoManoObra, 2)}
        </p>
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

      {lote.estado === "EN_PROCESO" && (
        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Finalizar cocción
          </h2>
          <FinalizarLoteFormulario loteId={lote.id} kgObjetivo={lote.kgObjetivo.toNumber()} />
        </section>
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
