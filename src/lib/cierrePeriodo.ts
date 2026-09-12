// Checklist de cierre de un período fiscal.
//
// Dos clases de punto, con orígenes distintos a propósito:
//
//  1. **Verificaciones automáticas**: hechos verificables sobre los datos del
//     propio período. El sistema puede afirmarlos con certeza porque los
//     calcula de su propia base.
//
//  2. **Tareas propias**: las que la empresa define. El sistema NO trae una
//     lista de tareas contables predefinida — qué incluye un cierre es
//     criterio del contador, y este código no lo inventa.
//
// Funciones puras: reciben los datos ya contados y no tocan la base.

export type VerificacionCierre = {
  clave: string;
  titulo: string;
  /** Cuántos casos hay pendientes. 0 = verificación superada. */
  pendientes: number;
  /** Qué hacer, y dónde. */
  detalle: string;
  href: string;
};

export type DatosVerificacion = {
  incidenciasContablesAbiertas: number;
  comprobantesSinAceptar: number;
  asientosDelPeriodo: number;
};

/**
 * Verificaciones derivadas de los datos del período.
 *
 * Se devuelven **todas**, superadas incluidas: un checklist que solo muestra lo
 * que falta no sirve para dar un cierre por revisado — quien lo firma necesita
 * ver qué se comprobó, no solo qué quedó pendiente.
 */
export function verificacionesDeCierre(datos: DatosVerificacion): VerificacionCierre[] {
  return [
    {
      clave: "INCIDENCIAS_CONTABLES",
      titulo: "Operaciones sin asiento contable",
      pendientes: datos.incidenciasContablesAbiertas,
      detalle:
        "Operaciones del período que se registraron pero no llegaron a generar su asiento. Cerrar con estas abiertas deja los libros sin ellas.",
      href: "/finanzas/incidencias-contables",
    },
    {
      clave: "COMPROBANTES_SUNAT",
      titulo: "Comprobantes electrónicos sin aceptar",
      pendientes: datos.comprobantesSinAceptar,
      detalle:
        "Documentos emitidos en el período que SUNAT todavía no aceptó, o cuyo envío falló. Cada uno necesita reintentarse o corregirse.",
      href: "/comercial/facturas",
    },
    {
      clave: "SIN_ASIENTOS",
      titulo: "El período tiene asientos registrados",
      // Un período sin ningún asiento no es un error, pero cerrarlo así casi
      // siempre significa que algo no se contabilizó. Se marca como punto a
      // revisar, no como falla.
      pendientes: datos.asientosDelPeriodo === 0 ? 1 : 0,
      detalle:
        "El período no tiene ningún asiento. Puede ser correcto si no hubo actividad, pero conviene confirmarlo antes de cerrar.",
      href: "/finanzas/asientos",
    },
  ];
}

export type TareaCierre = {
  id: string;
  orden: number;
  completadaEn: Date | null;
};

export type MotivoRechazoTarea = "ANTERIOR_PENDIENTE" | "YA_COMPLETADA" | "PERIODO_CERRADO";

export const MENSAJE_RECHAZO_TAREA: Record<MotivoRechazoTarea, string> = {
  ANTERIOR_PENDIENTE:
    "Hay una tarea anterior sin completar. El cierre es una secuencia: complete las anteriores primero.",
  YA_COMPLETADA: "Esa tarea ya estaba completada.",
  PERIODO_CERRADO: "El período ya está cerrado. Reábralo para seguir trabajando en su checklist.",
};

/**
 * Si una tarea se puede completar. `null` = se puede.
 *
 * La dependencia es el orden: una tarea no se completa si queda alguna anterior
 * pendiente. Es lo que hace falta para un cierre —que es una secuencia— sin la
 * complejidad de un grafo arbitrario de dependencias que nadie pidió.
 */
export function puedeCompletarTarea(
  tareas: readonly TareaCierre[],
  tareaId: string,
  periodoCerrado: boolean
): MotivoRechazoTarea | null {
  if (periodoCerrado) return "PERIODO_CERRADO";

  const tarea = tareas.find((t) => t.id === tareaId);
  if (!tarea) return "YA_COMPLETADA";
  if (tarea.completadaEn !== null) return "YA_COMPLETADA";

  const anteriorPendiente = tareas.some(
    (t) => t.orden < tarea.orden && t.completadaEn === null
  );
  return anteriorPendiente ? "ANTERIOR_PENDIENTE" : null;
}

/** El siguiente número de orden libre. Las tareas se agregan al final. */
export function siguienteOrdenTarea(tareas: readonly { orden: number }[]): number {
  return tareas.reduce((max, t) => Math.max(max, t.orden), 0) + 1;
}

/**
 * Cuántos puntos quedan sin resolver: verificaciones con pendientes más tareas
 * sin completar. Es el número que se guarda al cerrar, para que la decisión de
 * cerrar con cosas abiertas quede registrada.
 */
export function pendientesDeCierre(
  verificaciones: readonly VerificacionCierre[],
  tareas: readonly TareaCierre[]
): number {
  const deVerificaciones = verificaciones.filter((v) => v.pendientes > 0).length;
  const deTareas = tareas.filter((t) => t.completadaEn === null).length;
  return deVerificaciones + deTareas;
}
