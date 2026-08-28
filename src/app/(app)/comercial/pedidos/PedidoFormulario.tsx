"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearPedido, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type CondicionPago = "CONTADO" | "DIAS_15" | "DIAS_30";
type ClienteOpcion = {
  id: string;
  codigo: string;
  etiqueta: string;
  ruc: string | null;
  vendedorId: string | null;
  canal: string | null;
  direccion: string | null;
  condicionPago: CondicionPago;
};
type EscalonPrecio = { cantidadMinima: number; precio: number };
type PresentacionOpcion = {
  id: string;
  etiqueta: string;
  precio: number;
  stock: number;
  // Unidades equivalentes que Producción tiene en camino para el mismo
  // producto (granel aprobado sin envasar + lotes en proceso/calidad), más
  // allá del stock ya empacado. Solo informativo, no cambia el bloqueo.
  atpProduccion: number;
  escalones: EscalonPrecio[];
};

// El escalón más alto que la cantidad alcance (o el precio base), con el
// descuento por canal del cliente ya aplicado encima.
function precioSugerido(
  pres: PresentacionOpcion,
  cantidad: number,
  descuentoPct: number
): number {
  const aplicable = pres.escalones
    .filter((e) => cantidad >= e.cantidadMinima)
    .sort((a, b) => b.cantidadMinima - a.cantidadMinima)[0];
  const base = aplicable ? aplicable.precio : pres.precio;
  return Math.round(base * (1 - descuentoPct / 100) * 100) / 100;
}

type Linea = { presentacionId: string; cantidad: string; precioUnitario: string };

type Props = {
  clientes: ClienteOpcion[];
  vendedores: Opcion[];
  almacenes: Opcion[];
  presentaciones: PresentacionOpcion[];
  fechaMinima: string;
  descuentoPorCanal: Record<string, number>;
};

export default function PedidoFormulario({
  clientes,
  vendedores,
  almacenes,
  presentaciones,
  fechaMinima,
  descuentoPorCanal,
}: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearPedido,
    {}
  );
  const [vendedorId, setVendedorId] = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [condicionPago, setCondicionPago] = useState<CondicionPago>("CONTADO");
  const [moneda, setMoneda] = useState("PEN");
  const [descuentoPct, setDescuentoPct] = useState(0);
  const [lineas, setLineas] = useState<Linea[]>([
    { presentacionId: "", cantidad: "", precioUnitario: "" },
  ]);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({
      presentacionId: l.presentacionId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
    }))
  );

  const total = lineas.reduce((acc, l) => {
    const c = Number(l.cantidad);
    const p = Number(l.precioUnitario);
    return acc + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0);
  }, 0);

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <section className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Cabecera del documento</p>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Socio de negocio y cumplimiento</h2>
          </div>
          <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">Borrador</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Cliente / socio de negocio</span>
            <select
              name="clienteId"
              required
              defaultValue=""
              onChange={(e) => {
                const cliente = clientes.find((c) => c.id === e.target.value);
                setVendedorId(cliente?.vendedorId ?? "");
                setDireccionEntrega(cliente?.direccion ?? "");
                setCondicionPago(cliente?.condicionPago ?? "CONTADO");
                setDescuentoPct(cliente?.canal ? descuentoPorCanal[cliente.canal] ?? 0 : 0);
              }}
              className="campo-input"
            >
              <option value="" disabled>Seleccione cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.etiqueta}{c.ruc ? ` · RUC ${c.ruc}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Ejecutivo de ventas</span>
            <select name="vendedorId" required value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="campo-input">
              <option value="" disabled>Seleccione</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.etiqueta}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Centro de despacho</span>
            <select name="almacenId" required defaultValue="" className="campo-input">
              <option value="" disabled>Seleccione almacén/planta</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha solicitada de entrega</span>
            <input name="fechaEntregaSolicitada" type="date" min={fechaMinima} defaultValue={fechaMinima} required className="campo-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Condición de pago</span>
            <select name="condicionPago" value={condicionPago} onChange={(e) => setCondicionPago(e.target.value as CondicionPago)} className="campo-input">
              <option value="CONTADO">Contado</option>
              <option value="DIAS_15">Crédito 15 días</option>
              <option value="DIAS_30">Crédito 30 días</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Términos comerciales y referencia</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Moneda</span>
            <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} className="campo-input">
              <option value="PEN">PEN — Sol peruano</option>
              <option value="USD">USD — Dólar estadounidense</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo de cambio</span>
            <input name="tipoCambio" type="number" min="0.0001" step="0.0001" defaultValue="1" disabled={moneda === "PEN"} required={moneda === "USD"} className="campo-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">OC del cliente</span>
            <input name="ordenCompraCliente" maxLength={100} placeholder="Ej. OC-45000125" className="campo-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Referencia del cliente</span>
            <input name="referenciaCliente" maxLength={100} placeholder="Contrato, proyecto o atención" className="campo-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-4">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Dirección de entrega</span>
            <textarea name="direccionEntrega" value={direccionEntrega} onChange={(e) => setDireccionEntrega(e.target.value)} maxLength={500} rows={2} required className="campo-input" placeholder="Dirección, distrito, provincia y referencia logística" />
          </label>
        </div>
      </section>
      {descuentoPct > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Descuento por canal aplicado a los precios sugeridos: {descuentoPct}%
        </p>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Líneas del pedido
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => {
            const presSeleccionada = presentaciones.find((p) => p.id === linea.presentacionId);
            const cantidadNum = Number(linea.cantidad) || 0;
            const excedeStock = presSeleccionada != null && cantidadNum > presSeleccionada.stock;
            const cubiertoPorProduccion =
              excedeStock &&
              presSeleccionada != null &&
              cantidadNum <= presSeleccionada.stock + presSeleccionada.atpProduccion;
            return (
            <div key={idx} className="flex flex-col gap-1">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_2.75rem] sm:items-center">
              <select
                aria-label={`Presentación de la línea ${idx + 1}`}
                value={linea.presentacionId}
                onChange={(e) => {
                  const pres = presentaciones.find((p) => p.id === e.target.value);
                  const cantidad = Number(linea.cantidad) || 1;
                  actualizarLinea(idx, {
                    presentacionId: e.target.value,
                    precioUnitario: pres
                      ? String(precioSugerido(pres, cantidad, descuentoPct))
                      : linea.precioUnitario,
                  });
                }}
                className="campo-input w-full min-w-0"
              >
                <option value="" disabled>
                  Seleccione presentación
                </option>
                {presentaciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.etiqueta} (disponible: {p.stock}
                    {p.atpProduccion > 0 ? `, +${p.atpProduccion} en producción` : ""})
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cantidad de la línea ${idx + 1}`}
                type="number"
                step="1"
                min="1"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => {
                  const cantidad = Number(e.target.value) || 0;
                  const pres = presentaciones.find((p) => p.id === linea.presentacionId);
                  actualizarLinea(idx, {
                    cantidad: e.target.value,
                    precioUnitario: pres
                      ? String(precioSugerido(pres, cantidad, descuentoPct))
                      : linea.precioUnitario,
                  });
                }}
                className="campo-input w-full sm:w-24"
              />
              <input
                aria-label={`Precio unitario de la línea ${idx + 1}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio S/"
                value={linea.precioUnitario}
                onChange={(e) => actualizarLinea(idx, { precioUnitario: e.target.value })}
                className="campo-input w-full sm:w-28"
              />
              <span className="w-full sm:w-28 text-right text-sm text-neutral-500">
                {(Number(linea.cantidad) * Number(linea.precioUnitario) || 0).toLocaleString(
                  "es-PE",
                  { style: "currency", currency: "PEN" }
                )}
              </span>
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lineas.length === 1}
                className="inline-flex min-h-11 min-w-11 items-center justify-center justify-self-end sm:justify-self-auto text-neutral-400 hover:text-red-500 disabled:opacity-30"
                aria-label="Quitar línea"
              >
                ✕
              </button>
            </div>
            {excedeStock && (
              <p
                className={`text-xs ${
                  cubiertoPorProduccion
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {cubiertoPorProduccion
                  ? `La cantidad excede el stock ya empacado, pero hay ${presSeleccionada!.atpProduccion} unidades en camino desde Producción (granel aprobado sin envasar o lotes en proceso) — confirme el plazo antes de prometer fecha al cliente.`
                  : "La cantidad excede el stock disponible y lo que Producción tiene en camino; el pedido no se podrá crear así."}
              </p>
            )}
            </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setLineas((prev) => [...prev, { presentacionId: "", cantidad: "", precioUnitario: "" }])
          }
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar línea
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Total: {total.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}{" "}
          <span className="text-xs font-normal text-neutral-500">
            (valor de venta; el IGV se agrega al facturar)
          </span>
        </p>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Crear pedido"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
