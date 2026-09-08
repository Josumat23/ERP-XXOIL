"use client";
import { useActionState } from "react";
import { liberarFacturaProveedor, type EstadoFormulario } from "../actions";
export default function LiberarFacturaFormulario({ cuentaId }: { cuentaId: string }) { const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(liberarFacturaProveedor.bind(null, cuentaId), {}); return <form action={accion} className="mt-3 space-y-2"><textarea name="motivo" required minLength={12} className="campo-input w-full" placeholder="Justificación documentada para aceptar la diferencia" />{estado.error && <p className="text-sm text-red-600">{estado.error}</p>}<button disabled={pendiente} className="boton-primario">Liberar por excepción</button></form>; }
