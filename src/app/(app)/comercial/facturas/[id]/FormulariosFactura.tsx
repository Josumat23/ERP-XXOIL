"use client";

import { useState } from "react";
import { useActionState } from "react";
import SelectorSerieNumero from "@/components/SelectorSerieNumero";
import {
  registrarCobro,
  crearNotaCredito,
  anularFactura,
  aplicarRecargoMora,
  registrarDevolucion,
  inspeccionarDevolucionDetalle,
  type EstadoFormulario,
} from "../actions";
import { ETIQUETA_TIPO_NOTA_CREDITO } from "@/lib/catalogosSunat";

type Serie = { id: string; serie: string; correlativoActual: number };
type LineaDevolvible = { facturaDetalleId: string; etiqueta: string; maxDevolvible: number };
type AlmacenOpcion = { id: string; etiqueta: string };
type LineaAcreditable = {
  clave: string;
  pedidoDetalleId: string;
  devolucionDetalleId?: string;
  etiqueta: string;
  precioUnitario: number;
  maxAcreditable: number;
};

export function RecargoMoraFormulario({ facturaId, tasa }: { facturaId: string; tasa: number }) {
  const accion = aplicarRecargoMora.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="mt-3">
      <button type="submit" disabled={enviando} className="boton-secundario text-xs disabled:opacity-50">
        {enviando ? "Calculando…" : `Aplicar recargo por mora (${tasa}%/mes)`}
      </button>
      {estado.error && <p className="mt-2 text-sm text-red-600" role="alert">{estado.error}</p>}
    </form>
  );
}
export function CobroFormulario({

  facturaId,
  saldo,
  moneda,
  tipoCambioFactura,
}: {
  facturaId: string;
  saldo: number;
  moneda: string;
  tipoCambioFactura: number;
}) {
  const accion = registrarCobro.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Monto (saldo: {moneda} {saldo.toFixed(2)})
          </span>
          <input
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            max={saldo}
            required
            className="campo-input w-40"
          />
        </label>
        {moneda !== "PEN" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo de cambio de cobranza</span>
            <input
              name="tipoCambio"
              type="number"
              min="0.0001"
              step="0.0001"
              defaultValue={tipoCambioFactura}
              required
              className="campo-input w-40"
            />
          </label>
        )}
        {moneda === "PEN" && <input type="hidden" name="tipoCambio" value="1" />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio de pago</span>
          <select name="medioPago" required defaultValue="" className="campo-input w-44">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Referencia (operación, voucher)
          </span>
          <input name="referencia" className="campo-input" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar cobro"}
        </button>
      </div>
    </form>
  );
}

export function NotaCreditoFormulario({
  facturaId,
  lineas,
  series = [],
  lineasDevolucion = [],
}: {
  facturaId: string;
  lineas: LineaAcreditable[];
  series?: Serie[];
  lineasDevolucion?: LineaAcreditable[];
}) {
  const accion = crearNotaCredito.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [tipoNota, setTipoNota] = useState("");
  const esDevolucion = tipoNota === "DEVOLUCION_TOTAL" || tipoNota === "DEVOLUCION_ITEM";
  const disponibles = (esDevolucion ? lineasDevolucion : lineas).filter((linea) => linea.maxAcreditable > 0);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  const lineasSeleccionadas = disponibles
    .map((linea) => ({ pedidoDetalleId: linea.pedidoDetalleId, devolucionDetalleId: linea.devolucionDetalleId, cantidad: Number(cantidades[linea.clave] ?? 0) }))
    .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0);
  const montoEstimado = lineasSeleccionadas.reduce((acc, l) => {
    const linea = disponibles.find((disponible) => disponible.clave === (l.devolucionDetalleId ?? l.pedidoDetalleId));
    return acc + (linea ? linea.precioUnitario * l.cantidad : 0);
  }, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}

      {esDevolucion && lineasDevolucion.length === 0 && (
        <p className="text-sm text-amber-700">No hay cantidades compensables aprobadas por Calidad.</p>
      )}
      <table className="tabla">
        <thead>
          <tr>
            <th>Línea</th>
            <th className="text-right">Disponible</th>
            <th className="text-right">Cantidad a acreditar</th>
          </tr>
        </thead>
        <tbody>
          {disponibles.map((l) => (
            <tr key={l.clave}>
              <td className="text-sm">{l.etiqueta}</td>
              <td className="text-right">{l.maxAcreditable}</td>
              <td className="text-right">
                <input
                  aria-label={`Cantidad a acreditar de ${l.etiqueta}`}
                  type="number"
                  step="1"
                  min="0"
                  max={l.maxAcreditable}
                  value={cantidades[l.clave] ?? ""}
                  onChange={(e) =>
                    setCantidades((prev) => ({ ...prev, [l.clave]: e.target.value }))
                  }
                  className="campo-input w-24 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-end gap-3">
        <SelectorSerieNumero series={series} etiquetaNumero="N° NC SUNAT" />
        <label className="flex flex-col gap-1 text-sm min-w-56">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Tipo de nota (Catálogo 9 SUNAT)
          </span>
          <select name="tipoNota" required value={tipoNota} onChange={(evento) => { setTipoNota(evento.target.value); setCantidades({}); }} className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {Object.entries(ETIQUETA_TIPO_NOTA_CREDITO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
          <input
            name="motivo"
            required
            placeholder="Error de digitación, producto defectuoso..."
            className="campo-input"
          />
        </label>
        <button type="submit" disabled={enviando || lineasSeleccionadas.length === 0} className="boton-primario">
          {enviando ? "Registrando..." : `Registrar NC (S/ ${montoEstimado.toFixed(2)} + IGV)`}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        El monto (con IGV) se calcula a partir de las líneas y cantidades seleccionadas — no se
        ingresa suelto. Reduce el saldo por cobrar y revierte la comisión del vendedor en forma
        proporcional.
      </p>

      <input type="hidden" name="lineas" value={JSON.stringify(lineasSeleccionadas)} />
    </form>
  );
}

export function AnularFacturaFormulario({ facturaId }: { facturaId: string }) {
  const accion = anularFactura.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Motivo de anulación (obligatorio)
          </span>
          <input name="motivo" required className="campo-input" />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {enviando ? "Anulando..." : "Anular factura"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Reingresa el stock vendido al inventario y revierte la comisión completa. Solo es posible si
        la factura no tiene cobros ni notas de crédito.
      </p>
    </form>
  );
}

export function DevolucionFormulario({
  facturaId,
  lineas,
  almacenes,
}: {
  facturaId: string;
  lineas: LineaDevolvible[];
  almacenes: AlmacenOpcion[];
}) {
  const accion = registrarDevolucion.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const disponibles = lineas.filter((linea) => linea.maxDevolvible > 0);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const seleccionadas = disponibles
    .map((linea) => ({
      facturaDetalleId: linea.facturaDetalleId,
      cantidad: Number(cantidades[linea.facturaDetalleId] ?? 0),
    }))
    .filter((linea) => Number.isInteger(linea.cantidad) && linea.cantidad > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">N° interno de devolución</span>
          <input name="numeroDevolucion" required placeholder="DEV-000001" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Almacén receptor</span>
          <select name="almacenId" required defaultValue="" className="campo-input">
            <option value="" disabled>Seleccione</option>
            {almacenes.map((almacen) => <option key={almacen.id} value={almacen.id}>{almacen.etiqueta}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Motivo de recepción</span>
          <input name="motivo" minLength={10} required placeholder="Defecto reportado por cliente" className="campo-input" />
        </label>
      </div>
      <table className="tabla">
        <thead><tr><th>Producto facturado</th><th className="text-right">Pendiente</th><th className="text-right">Recibido</th></tr></thead>
        <tbody>
          {disponibles.map((linea) => (
            <tr key={linea.facturaDetalleId}>
              <td>{linea.etiqueta}</td>
              <td className="text-right">{linea.maxDevolvible}</td>
              <td className="text-right">
                <input
                  type="number" min="0" max={linea.maxDevolvible} step="1"
                  value={cantidades[linea.facturaDetalleId] ?? ""}
                  onChange={(evento) => setCantidades((actual) => ({ ...actual, [linea.facturaDetalleId]: evento.target.value }))}
                  className="campo-input w-24 text-right"
                  aria-label={`Cantidad recibida de ${linea.etiqueta}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <input type="hidden" name="lineasDevolucion" value={JSON.stringify(seleccionadas)} />
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-500">
          La recepción queda en stock bloqueado no valuado. No aumenta ATP ni libera lotes hasta la inspección.
        </p>
        <button type="submit" disabled={enviando || seleccionadas.length === 0 || almacenes.length === 0} className="boton-primario">
          {enviando ? "Recibiendo..." : "Recibir devolución bloqueada"}
        </button>
      </div>
    </form>
  );
}

export function InspeccionDevolucionFormulario({
  detalleId,
  cantidad,
}: {
  detalleId: string;
  cantidad: number;
}) {
  const accion = inspeccionarDevolucionDetalle.bind(null, detalleId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [reingreso, setReingreso] = useState(cantidad);
  const [desecho, setDesecho] = useState(0);
  const [devolver, setDevolver] = useState(0);
  const [acreditable, setAcreditable] = useState(cantidad);
  const disposicionValida = reingreso + desecho + devolver === cantidad;
  const creditoValido = acreditable <= reingreso + desecho;

  return (
    <form action={formAction} className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CampoCantidad nombre="cantidadReingreso" etiqueta="Reingreso disponible" valor={reingreso} max={cantidad} cambiar={setReingreso} />
        <CampoCantidad nombre="cantidadDesecho" etiqueta="Desecho" valor={desecho} max={cantidad} cambiar={setDesecho} />
        <CampoCantidad nombre="cantidadDevolverCliente" etiqueta="Retornar al cliente" valor={devolver} max={cantidad} cambiar={setDevolver} />
        <CampoCantidad nombre="cantidadAcreditable" etiqueta="Compensable por NC" valor={acreditable} max={cantidad} cambiar={setAcreditable} />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Resultado / observación de calidad</span>
          <input name="observacionCalidad" minLength={5} required className="campo-input" placeholder="Envase íntegro, sello conforme..." />
        </label>
        <button type="submit" disabled={enviando || !disposicionValida || !creditoValido} className="boton-primario">
          {enviando ? "Aplicando..." : "Confirmar decisión de uso"}
        </button>
      </div>
      {!disposicionValida && <p className="mt-2 text-xs text-red-600">La disposición debe sumar {cantidad} unidades.</p>}
      {!creditoValido && <p className="mt-2 text-xs text-red-600">No puede compensarse lo que vuelve al cliente.</p>}
    </form>
  );
}

function CampoCantidad({
  nombre,
  etiqueta,
  valor,
  max,
  cambiar,
}: {
  nombre: string;
  etiqueta: string;
  valor: number;
  max: number;
  cambiar: (valor: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{etiqueta}</span>
      <input
        name={nombre} type="number" min="0" max={max} step="1" required value={valor}
        onChange={(evento) => cambiar(Number(evento.target.value))}
        className="campo-input text-right"
      />
    </label>
  );
}
function MensajeError({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
      {texto}
    </p>
  );
}
