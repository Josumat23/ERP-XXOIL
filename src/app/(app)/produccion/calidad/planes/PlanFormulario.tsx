"use client";

import { useActionState, useState } from "react";
import { crearVersionPlan, type EstadoPlan } from "./actions";

type Fila = { nombre: string; unidadMedida: string; limiteInferior: string; limiteSuperior: string; metodoEnsayo: string; obligatoria: boolean };
const nuevaFila = (): Fila => ({ nombre: "", unidadMedida: "", limiteInferior: "", limiteSuperior: "", metodoEnsayo: "", obligatoria: true });

export default function PlanFormulario({ productos }: { productos: { id: string; codigo: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoPlan, FormData>(crearVersionPlan, {});
  const [filas, setFilas] = useState<Fila[]>([nuevaFila()]);
  const cambiar = (indice: number, campo: keyof Fila, valor: string | boolean) => setFilas(actual => actual.map((f, i) => i === indice ? { ...f, [campo]: valor } : f));
  return <form action={accion} className="space-y-4">
    {estado.error && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm"><span className="block font-medium mb-1">Producto</span><select required name="productoId" className="campo-input w-full"><option value="">Seleccione</option>{productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}</select></label>
      <label className="text-sm"><span className="block font-medium mb-1">Nombre del plan</span><input required minLength={3} name="nombre" className="campo-input w-full" placeholder="Liberación de producto terminado" /></label>
    </div>
    <input type="hidden" name="caracteristicas" value={JSON.stringify(filas)} />
    <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>#</th><th>Característica</th><th>Unidad</th><th>Mínimo</th><th>Máximo</th><th>Método / norma</th><th>Obligatoria</th><th></th></tr></thead>
      <tbody>{filas.map((f, i) => <tr key={i}><td>{i + 1}</td><td><input required value={f.nombre} onChange={e => cambiar(i, "nombre", e.target.value)} className="campo-input min-w-44" placeholder="Viscosidad cinemática" /></td><td><input required value={f.unidadMedida} onChange={e => cambiar(i, "unidadMedida", e.target.value)} className="campo-input w-24" placeholder="cSt" /></td><td><input type="number" step="any" value={f.limiteInferior} onChange={e => cambiar(i, "limiteInferior", e.target.value)} className="campo-input w-28" /></td><td><input type="number" step="any" value={f.limiteSuperior} onChange={e => cambiar(i, "limiteSuperior", e.target.value)} className="campo-input w-28" /></td><td><input value={f.metodoEnsayo} onChange={e => cambiar(i, "metodoEnsayo", e.target.value)} className="campo-input min-w-36" placeholder="ASTM D445" /></td><td className="text-center"><input type="checkbox" checked={f.obligatoria} onChange={e => cambiar(i, "obligatoria", e.target.checked)} /></td><td><button type="button" disabled={filas.length === 1} onClick={() => setFilas(v => v.filter((_, n) => n !== i))} className="text-red-600 text-sm">Quitar</button></td></tr>)}</tbody>
    </table></div>
    <div className="flex gap-3"><button type="button" onClick={() => setFilas(v => [...v, nuevaFila()])} className="boton-secundario">Agregar característica</button><button disabled={pendiente} className="boton-primario">{pendiente ? "Publicando..." : "Publicar nueva versión"}</button></div>
    <p className="text-xs text-neutral-500">Publicar una versión cierra la vigencia anterior. Los controles ya emitidos conservan su versión y especificaciones.</p>
  </form>;
}
