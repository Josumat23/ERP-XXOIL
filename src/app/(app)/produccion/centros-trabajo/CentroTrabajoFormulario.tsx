"use client";

import { useActionState } from "react";
import type { TipoCentroTrabajo } from "@/generated/prisma/client";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type Valores = { codigo: string; nombre: string; tipo: TipoCentroTrabajo; almacenId: string; centroCostoId: string | null; capacidadHorasDia: number; eficienciaPct: number };

const TIPOS: Array<{ valor: TipoCentroTrabajo; etiqueta: string }> = [
  { valor: "MEZCLA", etiqueta: "Mezcla / cocción" }, { valor: "ENVASADO", etiqueta: "Envasado" },
  { valor: "CALIDAD", etiqueta: "Calidad" }, { valor: "MANTENIMIENTO", etiqueta: "Mantenimiento" },
  { valor: "OTRO", etiqueta: "Otro" },
];

export default function CentroTrabajoFormulario({ accion, almacenes, centrosCosto, valores }: {
  accion: (prev: EstadoFormulario, data: FormData) => Promise<EstadoFormulario>;
  almacenes: Opcion[]; centrosCosto: Opcion[]; valores?: Valores;
}) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  return <form action={formAction} className="flex flex-col gap-4 max-w-xl">
    {estado.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Campo etiqueta="Código"><input name="codigo" required maxLength={20} defaultValue={valores?.codigo} placeholder="MEZCLA-01" className="campo-input uppercase" /></Campo>
      <Campo etiqueta="Nombre"><input name="nombre" required defaultValue={valores?.nombre} placeholder="Línea de mezclado 1" className="campo-input" /></Campo>
      <Campo etiqueta="Tipo"><select name="tipo" required defaultValue={valores?.tipo ?? ""} className="campo-input"><option value="" disabled>Seleccione</option>{TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select></Campo>
      <Campo etiqueta="Planta / almacén"><select name="almacenId" required defaultValue={valores?.almacenId ?? ""} className="campo-input"><option value="" disabled>Seleccione</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}</select></Campo>
      <Campo etiqueta="Centro de costo"><select name="centroCostoId" defaultValue={valores?.centroCostoId ?? ""} className="campo-input"><option value="">Sin asignar</option>{centrosCosto.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}</select></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Capacidad h/día"><input name="capacidadHorasDia" type="number" min="0.01" max="24" step="0.01" required defaultValue={valores?.capacidadHorasDia ?? 8} className="campo-input" /></Campo>
        <Campo etiqueta="Eficiencia %"><input name="eficienciaPct" type="number" min="0.01" max="100" step="0.01" required defaultValue={valores?.eficienciaPct ?? 100} className="campo-input" /></Campo>
      </div>
    </div>
    <p className="text-xs text-neutral-500">Capacidad efectiva = horas nominales × eficiencia. El calendario de la planta define qué días están disponibles.</p>
    <button type="submit" disabled={enviando} className="boton-primario self-start">{enviando ? "Guardando..." : valores ? "Guardar cambios" : "Crear centro de trabajo"}</button>
  </form>;
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1 text-sm"><span className="font-medium">{etiqueta}</span>{children}</label>; }
