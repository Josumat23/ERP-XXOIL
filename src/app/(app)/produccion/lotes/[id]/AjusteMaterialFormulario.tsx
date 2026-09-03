"use client";

import { useActionState } from "react";
import { ajustarMaterialLote, type EstadoFormulario } from "../actions";

export default function AjusteMaterialFormulario({ loteId, insumos }: { loteId: string; insumos: { id: string; codigo: string; nombre: string; unidad: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(ajustarMaterialLote.bind(null, loteId), {});
  return <form action={accion} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_2fr_auto] gap-2 items-end mt-3">
    <label className="text-sm"><span className="block font-medium mb-1">Movimiento</span><select name="tipo" className="campo-input"><option value="CONSUMO_ADICIONAL">Consumo adicional</option><option value="DEVOLUCION">Devolución a almacén</option></select></label>
    <label className="text-sm"><span className="block font-medium mb-1">Insumo</span><select name="insumoId" required defaultValue="" className="campo-input"><option value="" disabled>Seleccione</option>{insumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.codigo} — {insumo.nombre} ({insumo.unidad})</option>)}</select></label>
    <label className="text-sm"><span className="block font-medium mb-1">Cantidad</span><input name="cantidad" type="number" min="0.001" step="0.001" required className="campo-input" /></label>
    <label className="text-sm"><span className="block font-medium mb-1">Motivo</span><input name="motivo" minLength={5} maxLength={500} required className="campo-input" /></label>
    <button disabled={enviando} className="boton-primario">{enviando ? "Registrando…" : "Registrar"}</button>
    {estado.error && <p role="alert" className="sm:col-span-5 text-sm text-red-600">{estado.error}</p>}
  </form>;
}
