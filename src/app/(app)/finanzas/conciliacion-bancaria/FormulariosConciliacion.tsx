"use client";

import { useActionState } from "react";
import {
  anularConciliacion,
  cerrarConciliacion,
  conciliarMovimiento,
  crearConciliacion,
  importarExtracto,
  type EstadoConciliacion,
} from "./actions";

function Mensaje({ estado }: { estado: EstadoConciliacion }) {
  if (estado.error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>;
  if (estado.exito) return <p role="status" className="text-sm text-green-700 dark:text-green-400">{estado.exito}</p>;
  return null;
}

export function NuevaConciliacionFormulario({ cuentas }: { cuentas: { id: string; etiqueta: string }[] }) {
  const [estado, accion, enviando] = useActionState(crearConciliacion, {});
  return <form action={accion} className="borde-seccion grid gap-3 md:grid-cols-3">
    <h2 className="titulo-seccion md:col-span-3">Abrir conciliación</h2>
    <label className="flex flex-col gap-1 text-sm"><span>Cuenta bancaria</span><select name="cuentaBancariaId" required defaultValue="" className="campo-input"><option value="" disabled>Seleccione</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm"><span>Desde</span><input name="fechaDesde" type="date" required className="campo-input" /></label>
    <label className="flex flex-col gap-1 text-sm"><span>Hasta</span><input name="fechaHasta" type="date" required className="campo-input" /></label>
    <label className="flex flex-col gap-1 text-sm"><span>Saldo inicial del extracto</span><input name="saldoInicialExtracto" type="number" step="0.01" required className="campo-input" /></label>
    <label className="flex flex-col gap-1 text-sm"><span>Saldo final del extracto</span><input name="saldoFinalExtracto" type="number" step="0.01" required className="campo-input" /></label>
    <div className="flex items-end"><button type="submit" disabled={enviando || cuentas.length === 0} className="boton-primario">{enviando ? "Abriendo..." : "Abrir período"}</button></div>
    <div className="md:col-span-3"><Mensaje estado={estado} /></div>
  </form>;
}

export function ImportarExtractoFormulario({ conciliacionId }: { conciliacionId: string }) {
  const [estado, accion, enviando] = useActionState(importarExtracto.bind(null, conciliacionId), {});
  return <form action={accion} className="borde-seccion">
    <h2 className="titulo-seccion">Importar extracto CSV</h2>
    <p className="mb-3 text-xs text-neutral-500">Formato UTF-8: fecha;descripcion;referencia;debito;credito. La reimportación omite duplicados.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="flex min-w-64 flex-1 flex-col gap-1 text-sm"><span>Archivo .csv (máx. 1 MB)</span><input name="archivo" type="file" accept=".csv,text/csv" required className="campo-input" /></label><button type="submit" disabled={enviando} className="boton-secundario">{enviando ? "Importando..." : "Importar"}</button></div>
    <div className="mt-2"><Mensaje estado={estado} /></div>
  </form>;
}

type Candidato = { id: string; etiqueta: string; pendiente: number };
export function ConciliarMovimientoFormulario({ conciliacionId, movimientoExtractoId, maximo, moneda, candidatos }: { conciliacionId: string; movimientoExtractoId: string; maximo: number; moneda: string; candidatos: Candidato[] }) {
  const [estado, accion, enviando] = useActionState(conciliarMovimiento.bind(null, conciliacionId, movimientoExtractoId), {});
  return <form action={accion} className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
    <select name="movimientoCajaId" required defaultValue="" className="campo-input text-sm"><option value="" disabled>Movimiento del libro</option>{candidatos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta + " · pendiente " + moneda + " " + c.pendiente.toFixed(2)}</option>)}</select>
    <input name="monto" type="number" min="0.01" max={maximo} step="0.01" required defaultValue={maximo.toFixed(2)} className="campo-input text-sm" />
    <button type="submit" disabled={enviando || candidatos.length === 0} className="boton-primario text-sm">{enviando ? "Aplicando..." : "Conciliar"}</button>
    <div className="sm:col-span-3"><Mensaje estado={estado} /></div>
  </form>;
}

export function CerrarConciliacionFormulario({ conciliacionId }: { conciliacionId: string }) {
  const [estado, accion, enviando] = useActionState(cerrarConciliacion.bind(null, conciliacionId), {});
  return <form action={accion} className="flex flex-wrap items-center justify-end gap-3"><Mensaje estado={estado} /><button type="submit" disabled={enviando} className="boton-primario">{enviando ? "Cerrando..." : "Cerrar conciliación"}</button></form>;
}
export function AnularConciliacionFormulario({ conciliacionId }: { conciliacionId: string }) {
  const [estado, accion, enviando] = useActionState(anularConciliacion.bind(null, conciliacionId), {});
  return <form action={accion} className="rounded-md border border-red-200 p-3 dark:border-red-900">
    <h3 className="text-sm font-semibold">Anular borrador</h3>
    <div className="mt-2 flex flex-wrap items-end gap-2"><label className="flex min-w-64 flex-1 flex-col gap-1 text-sm"><span>Motivo</span><input name="motivo" minLength={5} required className="campo-input" /></label><button type="submit" disabled={enviando} className="boton-secundario text-sm">{enviando ? "Anulando..." : "Anular"}</button></div>
    <div className="mt-2"><Mensaje estado={estado} /></div>
  </form>;
}