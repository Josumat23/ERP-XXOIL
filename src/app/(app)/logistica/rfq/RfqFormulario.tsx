"use client";
import { useActionState, useState } from "react";
import { crearRfq, type EstadoRfqFormulario } from "./actions";

type Insumo = { id: string; etiqueta: string };
export default function RfqFormulario({ insumos }: { insumos: Insumo[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoRfqFormulario, FormData>(crearRfq, {});
  const [lineas, setLineas] = useState([{ insumoId: "", cantidad: "" }]);
  return <form action={accion} className="space-y-4 max-w-4xl">
    {estado.error && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="text-sm">Título<input name="titulo" required minLength={4} className="campo-input block w-full mt-1" placeholder="Compra mensual de aditivos" /></label>
      <label className="text-sm">Fecha límite de respuesta<input name="fechaLimite" type="date" className="campo-input block w-full mt-1" /></label>
    </div>
    <input type="hidden" name="lineas" value={JSON.stringify(lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad) })))} />
    <div className="space-y-2"><p className="font-medium text-sm">Materiales solicitados</p>{lineas.map((linea, indice) => <div className="flex gap-2" key={indice}>
      <select required value={linea.insumoId} onChange={(e) => setLineas((actual) => actual.map((l, i) => i === indice ? { ...l, insumoId: e.target.value } : l))} className="campo-input flex-1"><option value="">Seleccione insumo</option>{insumos.map((i) => <option key={i.id} value={i.id}>{i.etiqueta}</option>)}</select>
      <input required type="number" min="0.001" step="0.001" value={linea.cantidad} onChange={(e) => setLineas((actual) => actual.map((l, i) => i === indice ? { ...l, cantidad: e.target.value } : l))} className="campo-input w-32" placeholder="Cantidad" />
      <button type="button" disabled={lineas.length === 1} onClick={() => setLineas((actual) => actual.filter((_, i) => i !== indice))} className="boton-secundario">Quitar</button>
    </div>)}</div>
    <div className="flex gap-2"><button type="button" className="boton-secundario" onClick={() => setLineas((l) => [...l, { insumoId: "", cantidad: "" }])}>+ Línea</button><button disabled={pendiente} className="boton-primario">{pendiente ? "Creando…" : "Crear RFQ"}</button></div>
  </form>;
}
