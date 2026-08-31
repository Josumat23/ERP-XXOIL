import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { formatFecha } from "@/lib/format";
import { calcularResumenConciliacion } from "@/lib/conciliacionBancaria";
import { ETIQUETA_MEDIO_PAGO } from "@/lib/etiquetas";
import {
  AnularConciliacionFormulario,
  CerrarConciliacionFormulario,
  ConciliarMovimientoFormulario,
  ImportarExtractoFormulario,
} from "../FormulariosConciliacion";
import { quitarAplicacion } from "../actions";

export default async function DetalleConciliacionPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const { id } = await params;
  const conciliacion = await prisma.conciliacionBancaria.findFirst({
    where: { id, empresaId },
    include: {
      cuentaBancaria: true,
      movimientos: { include: { aplicaciones: { include: { movimientoCaja: true } } }, orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] },
    },
  });
  if (!conciliacion) notFound();
  const fechaHastaExclusiva = new Date(conciliacion.fechaHasta);
  fechaHastaExclusiva.setDate(fechaHastaExclusiva.getDate() + 1);
  const movimientosCaja = await prisma.movimientoCaja.findMany({
    where: {
      empresaId,
      fecha: { gte: conciliacion.fechaDesde, lt: fechaHastaExclusiva },
      OR: [{ cuentaBancariaId: null }, { cuentaBancariaId: conciliacion.cuentaBancariaId }],
    },
    include: { conciliaciones: true },
    orderBy: { fecha: "asc" },
    take: 500,
  });
  const resumen = calcularResumenConciliacion({
    saldoInicial: conciliacion.saldoInicialExtracto.toNumber(),
    saldoFinal: conciliacion.saldoFinalExtracto.toNumber(),
    movimientos: conciliacion.movimientos.map((m) => ({ tipo: m.tipo, monto: m.monto.toNumber(), aplicado: m.aplicaciones.reduce((s, a) => s + a.monto.toNumber(), 0) })),
  });
  const puedeEditar = conciliacion.estado === "BORRADOR" && await puedeRealizar(usuario, "finanzas", "editar");
  const puedeCerrar = conciliacion.estado === "BORRADOR" && conciliacion.usuarioId !== usuario.id && await puedeRealizar(usuario, "finanzas", "aprobar");
  return <div className="max-w-6xl"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><Link href="/finanzas/conciliacion-bancaria" className="text-sm text-neutral-500 hover:underline">← Conciliaciones</Link><h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>{conciliacion.cuentaBancaria.banco + " · " + conciliacion.cuentaBancaria.numeroCuenta}</h1><p className="text-sm text-neutral-500">{formatFecha(conciliacion.fechaDesde) + " — " + formatFecha(conciliacion.fechaHasta) + " · " + conciliacion.cuentaBancaria.moneda}</p></div><span className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{conciliacion.estado === "CERRADA" ? "Cerrada" : conciliacion.estado === "ANULADA" ? "Anulada" : "Borrador"}</span></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi etiqueta="Saldo inicial" valor={formatImporte(conciliacion.saldoInicialExtracto.toNumber(), conciliacion.cuentaBancaria.moneda)} /><Kpi etiqueta="Ingresos extracto" valor={formatImporte(resumen.ingresos, conciliacion.cuentaBancaria.moneda)} /><Kpi etiqueta="Egresos extracto" valor={formatImporte(resumen.egresos, conciliacion.cuentaBancaria.moneda)} /><Kpi etiqueta="Saldo calculado" valor={formatImporte(resumen.saldoCalculado, conciliacion.cuentaBancaria.moneda)} alerta={Math.abs(resumen.diferenciaExtracto) > 0.009} /><Kpi etiqueta="Pendiente conciliar" valor={formatImporte(resumen.pendienteConciliar, conciliacion.cuentaBancaria.moneda)} alerta={resumen.pendienteConciliar > 0.009} /></div>
    {Math.abs(resumen.diferenciaExtracto) > 0.009 && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">El saldo declarado difiere en {formatImporte(resumen.diferenciaExtracto, conciliacion.cuentaBancaria.moneda)} del saldo calculado.</p>}
    {puedeEditar && <ImportarExtractoFormulario conciliacionId={conciliacion.id} />}
    <div className="mt-6 space-y-4">{conciliacion.movimientos.map((movimiento) => {
      const aplicado = movimiento.aplicaciones.reduce((s, a) => s + a.monto.toNumber(), 0);
      const pendiente = Math.max(0, movimiento.monto.toNumber() - aplicado);
      const candidatos = movimientosCaja.filter((caja) => caja.tipo === movimiento.tipo).map((caja) => {
        const montoCuenta = conciliacion.cuentaBancaria.moneda === "PEN"
          ? caja.monto.toNumber()
          : caja.moneda === conciliacion.cuentaBancaria.moneda && caja.montoOriginal
            ? caja.montoOriginal.toNumber()
            : null;
        return montoCuenta === null ? null : {
          id: caja.id,
          etiqueta: `${formatFecha(caja.fecha)} · ${caja.concepto}`,
          pendiente: Math.max(0, montoCuenta - caja.conciliaciones.reduce((s, a) => s + a.monto.toNumber(), 0)),
        };
      }).filter((caja): caja is { id: string; etiqueta: string; pendiente: number } => caja !== null && caja.pendiente > 0.009);
      return <article key={movimiento.id} className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{movimiento.descripcion}</p><p className="text-xs text-neutral-500">{formatFecha(movimiento.fecha) + " · ref. " + (movimiento.referencia ?? "—")}</p></div><div className="text-right"><p className={movimiento.tipo === "INGRESO" ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{movimiento.tipo === "INGRESO" ? "+" : "−"}{formatImporte(movimiento.monto.toNumber(), conciliacion.cuentaBancaria.moneda)}</p><p className="text-xs text-neutral-500">Pendiente {formatImporte(pendiente, conciliacion.cuentaBancaria.moneda)}</p></div></div>
        {movimiento.aplicaciones.length > 0 && <div className="mt-3 space-y-2">{movimiento.aplicaciones.map((aplicacion) => <div key={aplicacion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800"><span>{aplicacion.movimientoCaja.concepto + " · " + ETIQUETA_MEDIO_PAGO[aplicacion.movimientoCaja.medioPago] + " · " + formatImporte(aplicacion.monto.toNumber(), conciliacion.cuentaBancaria.moneda)}</span>{puedeEditar && <form action={quitarAplicacion.bind(null, conciliacion.id, aplicacion.id)}><button type="submit" className="text-xs text-red-600 hover:underline">Quitar</button></form>}</div>)}</div>}
        {puedeEditar && pendiente > 0.009 && <ConciliarMovimientoFormulario conciliacionId={conciliacion.id} movimientoExtractoId={movimiento.id} maximo={pendiente} moneda={conciliacion.cuentaBancaria.moneda} candidatos={candidatos} />}
      </article>;
    })}{conciliacion.movimientos.length === 0 && <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500">Importe el extracto bancario para comenzar.</div>}</div>
    {conciliacion.estado === "BORRADOR" && (puedeEditar || puedeCerrar) && <div className="mt-6 grid gap-4 lg:grid-cols-2">{puedeEditar && <AnularConciliacionFormulario conciliacionId={conciliacion.id} />}{puedeCerrar && <CerrarConciliacionFormulario conciliacionId={conciliacion.id} />}</div>}
    {conciliacion.estado === "BORRADOR" && conciliacion.usuarioId === usuario.id && <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">La conciliación debe cerrarla otra persona autorizada.</p>}
    {conciliacion.estado === "ANULADA" && <p className="mt-6 rounded-md bg-neutral-100 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Anuló {conciliacion.anuladaPorNombre ?? "—"}: {conciliacion.motivoAnulacion ?? "—"}</p>}
    {conciliacion.estado === "CERRADA" && <p className="mt-6 text-sm text-neutral-500">Cerró {conciliacion.cerradaPorNombre ?? "—"} el {conciliacion.cerradaEn ? formatFecha(conciliacion.cerradaEn) : "—"}.</p>}
  </div>;
}

function Kpi({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return <div className={`rounded-lg border p-3 ${alerta ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "border-black/10 dark:border-white/10"}`}><p className="text-xs text-neutral-500">{etiqueta}</p><p className="mt-1 text-lg font-semibold">{valor}</p></div>;
}
function formatImporte(valor: number, moneda: string): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);
}