"use client";

import { useActionState, useState } from "react";
import {
  cancelarOleada,
  completarOleada,
  crearOleada,
  registrarPick,
  type EstadoFormulario,
} from "./actions";

type GuiaElegible = {
  id: string;
  numero: string;
  cliente: string;
  almacen: string;
  lineas: number;
};

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
      {estado.error}
    </p>
  );
}

export function NuevaOleadaFormulario({ guias }: { guias: GuiaElegible[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearOleada,
    {}
  );
  const [elegidas, setElegidas] = useState<string[]>([]);

  // Una recorrida ocurre en un solo almacén: elegida la primera guía, el resto
  // se limita a las de su mismo almacén. El servidor lo vuelve a exigir.
  const almacenFijado = guias.find((g) => g.id === elegidas[0])?.almacen ?? null;

  function alternar(id: string) {
    setElegidas((previas) =>
      previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id]
    );
  }

  if (guias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--epicor-borde)] p-8 text-center text-sm text-[var(--epicor-texto-tenue)]">
        No hay guías planificadas con almacén de origen para preparar.
      </p>
    );
  }

  return (
    <form action={formAction} className="borde-seccion flex flex-col gap-3">
      <h2 className="titulo-seccion">Armar oleada</h2>
      <Error estado={estado} />
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        Elija las guías que se van a preparar juntas. La lista se consolida por presentación, así
        que el mismo pasillo se camina una vez aunque el ítem esté en tres guías.
      </p>

      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th />
              <th>Guía</th>
              <th>Cliente</th>
              <th>Almacén</th>
              <th className="text-right">Líneas</th>
            </tr>
          </thead>
          <tbody>
            {guias.map((g) => {
              const bloqueada = almacenFijado !== null && g.almacen !== almacenFijado;
              return (
                <tr key={g.id} className={bloqueada ? "opacity-40" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      name="guiaIds"
                      value={g.id}
                      checked={elegidas.includes(g.id)}
                      disabled={bloqueada}
                      onChange={() => alternar(g.id)}
                    />
                  </td>
                  <td className="font-mono text-xs">{g.numero}</td>
                  <td>{g.cliente}</td>
                  <td className="text-xs">{g.almacen}</td>
                  <td className="text-right">{g.lineas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-md">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas</span>
        <input name="notas" className="campo-input" placeholder="Turno mañana, muelle 2" />
      </label>

      <div>
        <button
          type="submit"
          disabled={enviando || elegidas.length === 0}
          className="boton-primario text-sm"
        >
          {enviando ? "Armando…" : `Armar oleada con ${elegidas.length} guía(s)`}
        </button>
      </div>
    </form>
  );
}

export function PickFormulario({
  lineaId,
  zonas,
  pendiente,
}: {
  lineaId: string;
  zonas: { zonaAlmacenId: string | null; codigo: string; disponible: number }[];
  pendiente: number;
}) {
  const accion = registrarPick.bind(null, lineaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  if (zonas.length === 0) {
    return (
      <span className="text-xs text-amber-700 dark:text-amber-400">
        Sin stock en el almacén para preparar este ítem.
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Tomar de</span>
        <select name="zonaOrigenId" defaultValue={zonas[0].zonaAlmacenId ?? ""} className="campo-input text-xs w-40">
          {zonas.map((z) => (
            <option key={z.zonaAlmacenId ?? "sin"} value={z.zonaAlmacenId ?? ""}>
              {z.codigo} ({z.disponible})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Cantidad</span>
        <input
          name="cantidad"
          type="number"
          step="1"
          min="1"
          max={pendiente}
          defaultValue={pendiente}
          required
          className="campo-input text-xs w-24"
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Registrar"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function CerrarOleadaFormularios({
  oleadaId,
  faltante,
}: {
  oleadaId: string;
  faltante: number;
}) {
  const completar = completarOleada.bind(null, oleadaId);
  const cancelar = cancelarOleada.bind(null, oleadaId);
  const [estadoC, accionC, enviandoC] = useActionState<EstadoFormulario, FormData>(completar, {});
  const [estadoX, accionX, enviandoX] = useActionState<EstadoFormulario, FormData>(cancelar, {});

  return (
    <div className="mt-4 flex flex-col gap-3">
      <form action={accionC} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Notas de cierre (opcional)</span>
          <input name="notas" className="campo-input text-xs w-72" />
        </label>
        <button type="submit" disabled={enviandoC} className="boton-primario text-xs">
          {enviandoC ? "…" : "Completar oleada"}
        </button>
        {faltante > 0 && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Quedan {faltante} unidades sin preparar; se cierra igual y el faltante queda registrado.
          </span>
        )}
        <Error estado={estadoC} />
      </form>

      <form action={accionX} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Motivo de cancelación</span>
          <input name="motivo" required maxLength={500} className="campo-input text-xs w-72" />
        </label>
        <button
          type="submit"
          disabled={enviandoX}
          className="boton-secundario text-xs text-red-700 dark:text-red-400"
        >
          {enviandoX ? "…" : "Cancelar oleada"}
        </button>
        <Error estado={estadoX} />
      </form>
    </div>
  );
}
