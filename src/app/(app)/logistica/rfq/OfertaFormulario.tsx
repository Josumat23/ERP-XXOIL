"use client";
import { useActionState, useState } from "react";
import { registrarOferta, type EstadoRfqFormulario } from "./actions";
type Opcion = { id: string; etiqueta: string };
type Linea = { id: string; etiqueta: string; cantidad: number };
export default function OfertaFormulario({ rfqId, proveedores, lineas }: { rfqId: string; proveedores: Opcion[]; lineas: Linea[] }) {
  const accionLigada = registrarOferta.bind(null, rfqId);
  const [estado, accion, pendiente] = useActionState<EstadoRfqFormulario, FormData>(accionLigada, {});
  const [moneda, setMoneda] = useState("PEN");
  const [precios, setPrecios] = useState<Record<string, string>>({});
  return <form action={accion} className="space-y-3 border rounded-lg p-4">
    <h2 className="font-semibold">Registrar oferta</h2>{estado.error && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}
    <div className="grid md:grid-cols-4 gap-3">
      <label className="text-sm">Proveedor<select name="proveedorId" required className="campo-input block w-full"><option value="">Seleccione</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}</select></label>
      <label className="text-sm">Moneda<select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} className="campo-input block w-full"><option>PEN</option><option>USD</option></select></label>
      <label className="text-sm">Tipo de cambio<input name="tipoCambio" type="number" min="0.001" step="0.001" required={moneda === "USD"} disabled={moneda === "PEN"} defaultValue={moneda === "PEN" ? "1" : ""} className="campo-input block w-full" /></label>
      <label className="text-sm">Pago (días)<input name="condicionPagoDias" type="number" min="0" step="1" required defaultValue="0" className="campo-input block w-full" /></label>
      <label className="text-sm">Entrega (días)<input name="plazoEntregaDias" type="number" min="0" step="1" required className="campo-input block w-full" /></label>
      <label className="text-sm md:col-span-3">Notas<input name="notas" className="campo-input block w-full" /></label>
    </div>
    <input type="hidden" name="lineas" value={JSON.stringify(lineas.map((l) => ({ rfqLineaId: l.id, costoUnitario: Number(precios[l.id]) })))} />
    <table className="tabla"><thead><tr><th>Material</th><th>Cantidad</th><th>Costo unitario</th></tr></thead><tbody>{lineas.map((l) => <tr key={l.id}><td>{l.etiqueta}</td><td>{l.cantidad}</td><td><input aria-label={`Costo de ${l.etiqueta}`} required type="number" min="0" step="0.01" value={precios[l.id] ?? ""} onChange={(e) => setPrecios((p) => ({ ...p, [l.id]: e.target.value }))} className="campo-input w-32" /></td></tr>)}</tbody></table>
    <button disabled={pendiente} className="boton-primario">{pendiente ? "Guardando…" : "Guardar oferta"}</button>
  </form>;
}
