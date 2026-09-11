"use client";

import { useActionState, useState } from "react";
import { moverEntreZonas, type EstadoFormulario } from "./actions";

export type ItemConDistribucion = {
  valor: string;
  etiqueta: string;
  almacenId: string;
  /** Cantidad por zona y el remanente sin asignar, ya calculados en el servidor. */
  porZona: { zonaAlmacenId: string; etiqueta: string; cantidad: number }[];
  sinZona: number;
  total: number;
};

const formato = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

export default function MoverZonaFormulario({
  items,
  zonas,
}: {
  items: ItemConDistribucion[];
  zonas: { id: string; almacenId: string; etiqueta: string }[];
}) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(
    moverEntreZonas,
    {}
  );
  const [valorItem, setValorItem] = useState(items[0]?.valor ?? "");
  const item = items.find((i) => i.valor === valorItem);
  const zonasDelAlmacen = zonas.filter((z) => z.almacenId === item?.almacenId);

  return (
    <form action={accion} className="flex flex-col gap-3">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Stock repartido. El saldo del almacén no cambió.
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Ítem con stock
          <select
            name="item"
            required
            value={valorItem}
            onChange={(e) => setValorItem(e.target.value)}
            className="campo-input block w-full min-w-72"
          >
            {items.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="almacenId" value={item?.almacenId ?? ""} />
      </div>

      {item && (
        <div className="text-xs rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
          <span className="text-neutral-500">Reparto actual:</span>{" "}
          {item.porZona.length === 0 && item.sinZona === item.total ? (
            <span>todo sin zona asignada ({formato.format(item.total)})</span>
          ) : (
            <>
              {item.porZona.map((z) => (
                <span key={z.zonaAlmacenId} className="mr-3">
                  {z.etiqueta}: <strong>{formato.format(z.cantidad)}</strong>
                </span>
              ))}
              <span className="mr-3">
                Sin zona: <strong>{formato.format(item.sinZona)}</strong>
              </span>
            </>
          )}
          <span className="text-neutral-500">· Total en almacén: {formato.format(item.total)}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Desde
          <select name="zonaOrigenId" defaultValue="" className="campo-input block w-full min-w-56">
            <option value="">Stock sin zona asignada</option>
            {zonasDelAlmacen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Hacia
          <select
            name="zonaDestinoId"
            required
            defaultValue=""
            className="campo-input block w-full min-w-56"
          >
            <option value="" disabled>
              Zona destino
            </option>
            {zonasDelAlmacen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Cantidad
          <input
            name="cantidad"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="campo-input block w-32"
          />
        </label>
        <button type="submit" disabled={enviando || !item} className="boton-primario">
          {enviando ? "Moviendo..." : "Mover entre zonas"}
        </button>
      </div>
    </form>
  );
}
