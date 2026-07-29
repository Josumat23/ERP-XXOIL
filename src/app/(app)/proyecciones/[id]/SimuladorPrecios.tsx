"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { guardarSimulacionPrecios, type EstadoFormulario } from "../actions";
import {
  margenPct,
  brechaCompetidorPct,
  calcularResumenSimulacion,
  factorPrecioParaMeta,
} from "@/lib/simuladorPrecios";
import { formatMoneda, formatNumero } from "@/lib/format";

type LineaInicial = {
  detalleId: string;
  presentacionId: string;
  nombre: string;
  costoPromedio: number;
  demandaProyectada: number;
  precioActual: number;
  precioSimuladoGuardado: number | null;
  precioCompetidorRefGuardado: number | null;
};

type Props = {
  proyeccionId: string;
  lineas: LineaInicial[];
  tasaComisionPromedio: number;
  costoVentasProyectado: number;
  gastosOperativosProyectados: number;
  ventasBase: number;
  comisionesBase: number;
  metaUtilidadOperativaGuardada: number | null;
  horasHombreProyectadas: number;
  horasHombreDisponibles: number;
  insumosFaltantes: number;
};

type EstadoLinea = { precioSimulado: string; precioCompetidorRef: string };

export default function SimuladorPrecios({
  proyeccionId,
  lineas,
  tasaComisionPromedio,
  costoVentasProyectado,
  gastosOperativosProyectados,
  ventasBase,
  comisionesBase,
  metaUtilidadOperativaGuardada,
  horasHombreProyectadas,
  horasHombreDisponibles,
  insumosFaltantes,
}: Props) {
  const accion = guardarSimulacionPrecios.bind(null, proyeccionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  const [estados, setEstados] = useState<Record<string, EstadoLinea>>(() =>
    Object.fromEntries(
      lineas.map((l) => [
        l.detalleId,
        {
          precioSimulado: String(l.precioSimuladoGuardado ?? l.precioActual),
          precioCompetidorRef:
            l.precioCompetidorRefGuardado != null ? String(l.precioCompetidorRefGuardado) : "",
        },
      ])
    )
  );
  const [meta, setMeta] = useState(
    metaUtilidadOperativaGuardada != null ? String(metaUtilidadOperativaGuardada) : ""
  );

  function actualizarLinea(detalleId: string, cambios: Partial<EstadoLinea>) {
    setEstados((prev) => ({ ...prev, [detalleId]: { ...prev[detalleId], ...cambios } }));
  }

  const lineasSimuladas = useMemo(
    () =>
      lineas.map((l) => {
        const e = estados[l.detalleId];
        const precioSimulado = Number(e?.precioSimulado) || l.precioActual;
        const precioCompetidorRef = e?.precioCompetidorRef ? Number(e.precioCompetidorRef) : null;
        return {
          presentacionId: l.presentacionId,
          nombre: l.nombre,
          costoPromedio: l.costoPromedio,
          demandaProyectada: l.demandaProyectada,
          precioActual: l.precioActual,
          precioSimulado,
          precioCompetidorRef,
        };
      }),
    [lineas, estados]
  );

  const metaNum = meta ? Number(meta) : null;
  const resumen = calcularResumenSimulacion(
    lineasSimuladas,
    costoVentasProyectado,
    tasaComisionPromedio,
    gastosOperativosProyectados,
    Number.isFinite(metaNum) ? metaNum : null
  );

  const factorSugerido =
    metaNum != null && Number.isFinite(metaNum)
      ? factorPrecioParaMeta(ventasBase, comisionesBase, costoVentasProyectado, gastosOperativosProyectados, metaNum)
      : null;

  function aplicarSugerencia() {
    if (factorSugerido == null) return;
    setEstados((prev) => {
      const siguiente = { ...prev };
      for (const l of lineas) {
        siguiente[l.detalleId] = {
          ...siguiente[l.detalleId],
          precioSimulado: (Math.round(l.precioActual * factorSugerido * 100) / 100).toString(),
        };
      }
      return siguiente;
    });
  }

  const excedeCapacidad = horasHombreDisponibles > 0 && horasHombreProyectadas > horasHombreDisponibles;
  const lineasJson = JSON.stringify(
    lineas.map((l) => {
      const e = estados[l.detalleId];
      return {
        detalleId: l.detalleId,
        precioSimulado: e?.precioSimulado ? Number(e.precioSimulado) : null,
        precioCompetidorRef: e?.precioCompetidorRef ? Number(e.precioCompetidorRef) : null,
      };
    })
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <p className="text-sm text-neutral-500">
        Simulá a qué precio necesitás vender cada presentación este trimestre para llegar a tu meta
        de utilidad, comparando contra el precio del competidor y sin perder de vista tu capacidad
        de planta y de materia prima. No modifica el precio real de venta hasta que lo cambies desde
        Productos.
      </p>

      {(excedeCapacidad || insumosFaltantes > 0) && (
        <div className="flex flex-col gap-1 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {excedeCapacidad && (
            <p>
              ⚠ La demanda proyectada ({formatNumero(horasHombreProyectadas, 0)} h-h) supera tu
              capacidad disponible ({formatNumero(horasHombreDisponibles, 0)} h-h) — riesgo de ventas
              perdidas si no ajustás producción antes de bajar precio para vender más.
            </p>
          )}
          {insumosFaltantes > 0 && (
            <p>
              ⚠ {insumosFaltantes} insumo(s) no alcanzan para esta demanda — revisá compras en la
              pestaña Operaciones antes de comprometerte con este escenario.
            </p>
          )}
        </div>
      )}

      <table className="tabla">
        <thead>
          <tr>
            <th>Presentación</th>
            <th className="text-right">Costo</th>
            <th className="text-right">Precio actual</th>
            <th className="text-right">Precio simulado</th>
            <th className="text-right">Margen simulado</th>
            <th className="text-right">Precio competidor</th>
            <th className="text-right">Brecha vs. competidor</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => {
            const e = estados[l.detalleId];
            const precioSimulado = Number(e?.precioSimulado) || l.precioActual;
            const precioCompetidorRef = e?.precioCompetidorRef ? Number(e.precioCompetidorRef) : null;
            const margen = margenPct(precioSimulado, l.costoPromedio);
            const brecha = brechaCompetidorPct(precioSimulado, precioCompetidorRef);
            return (
              <tr key={l.detalleId}>
                <td>{l.nombre}</td>
                <td className="text-right text-neutral-500">{formatMoneda(l.costoPromedio)}</td>
                <td className="text-right text-neutral-500">{formatMoneda(l.precioActual)}</td>
                <td className="text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={e?.precioSimulado ?? ""}
                    onChange={(ev) => actualizarLinea(l.detalleId, { precioSimulado: ev.target.value })}
                    className="campo-input w-24 py-1 text-xs text-right"
                  />
                </td>
                <td
                  className={`text-right ${margen < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {margen.toFixed(1)}%
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="—"
                    value={e?.precioCompetidorRef ?? ""}
                    onChange={(ev) =>
                      actualizarLinea(l.detalleId, { precioCompetidorRef: ev.target.value })
                    }
                    className="campo-input w-24 py-1 text-xs text-right"
                  />
                </td>
                <td
                  className={`text-right ${
                    brecha != null && brecha > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-500"
                  }`}
                >
                  {brecha != null ? `${brecha > 0 ? "+" : ""}${brecha.toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Meta de utilidad operativa del trimestre
          </h3>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Meta (S/)</span>
              <input
                name="metaUtilidadOperativa"
                type="number"
                step="0.01"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="campo-input w-40"
              />
            </label>
            <button
              type="button"
              onClick={aplicarSugerencia}
              disabled={factorSugerido == null}
              className="boton-secundario text-xs disabled:opacity-40"
            >
              Aplicar % sugerido a todos los precios
            </button>
          </div>
          {factorSugerido != null && (
            <p className="text-xs text-neutral-500 mt-2">
              Sugerencia: {factorSugerido >= 1 ? "subir" : "bajar"} los precios actuales un{" "}
              {Math.abs((factorSugerido - 1) * 100).toFixed(1)}% en promedio (asume el mismo volumen
              proyectado — no reemplaza tu criterio comercial).
            </p>
          )}
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Resultado del escenario
          </h3>
          <dl className="flex flex-col gap-1.5 text-sm">
            <Fila etiqueta="Ventas simuladas" valor={formatMoneda(resumen.ventasSimuladas)} />
            <Fila etiqueta="Comisiones simuladas" valor={formatMoneda(resumen.comisionesSimuladas)} />
            <Fila
              etiqueta="Utilidad bruta simulada"
              valor={formatMoneda(resumen.utilidadBrutaSimulada)}
            />
            <Fila
              etiqueta="Utilidad operativa simulada"
              valor={formatMoneda(resumen.utilidadOperativaSimulada)}
              destacada
            />
            {resumen.diferenciaVsMeta != null && (
              <Fila
                etiqueta="Diferencia vs. meta"
                valor={formatMoneda(resumen.diferenciaVsMeta)}
                alerta={resumen.diferenciaVsMeta < 0}
              />
            )}
          </dl>
        </section>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Guardar escenario"}
      </button>
    </form>
  );
}

function Fila({
  etiqueta,
  valor,
  destacada = false,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  destacada?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={destacada ? "font-semibold" : "text-neutral-500"}>{etiqueta}</dt>
      <dd
        className={`${destacada ? "font-semibold" : ""} ${
          alerta ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
