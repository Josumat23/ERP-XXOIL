// Certificación periódica de accesos.
//
// Funciones puras, sin Prisma.
//
// Certificar no es mirar una lista: es que alguien **declare por escrito** que
// cada acceso sigue siendo correcto, y que quede constancia de quién lo dijo.
// Lo que ya existía era una alerta de inactividad a 90 días, que avisa pero no
// deja esa constancia.

import { evaluarConflictosSoD, type PermisoSoD } from "@/lib/segregacionFunciones";

export type PermisoLegible = {
  modulo: string;
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeAprobar: boolean;
};

/**
 * Resumen legible de lo que puede hacer un grupo.
 *
 * Se guarda como texto en la línea certificada a propósito: el revisor tiene
 * que poder releer, dentro de un año, **lo que aprobó** — no lo que el grupo
 * permita entonces. Una lista de casillas viva no serviría de constancia.
 *
 * Solo se listan los módulos donde el grupo hace algo más que ver: enumerar
 * treinta permisos de lectura entierra los tres que importan.
 */
export function resumirPermisos(permisos: readonly PermisoLegible[]): string {
  const relevantes = permisos
    .filter((p) => p.puedeCrear || p.puedeEditar || p.puedeAprobar)
    .map((p) => {
      const acciones = [
        p.puedeCrear ? "crear" : null,
        p.puedeEditar ? "editar" : null,
        p.puedeAprobar ? "aprobar" : null,
      ].filter(Boolean);
      return `${p.modulo}: ${acciones.join("/")}`;
    })
    .sort();
  if (relevantes.length === 0) return "Solo lectura";
  return relevantes.join(" · ");
}

/**
 * Conflictos de segregación de funciones del grupo, como texto.
 *
 * La asignación ya los bloquea al guardar el grupo, así que en teoría no
 * debería haber ninguno. Se calculan igual: si aparece uno, es justamente lo
 * que una certificación tiene que poner delante de quien revisa.
 */
export function resumirConflictos(permisos: readonly PermisoSoD[]): string | null {
  const conflictos = evaluarConflictosSoD(permisos);
  if (conflictos.length === 0) return null;
  return conflictos.map((c) => c.descripcion).join(" ");
}

export type LineaCertificable = {
  usuarioId: string;
  decision: string;
};

export type AvanceCampana = {
  total: number;
  pendientes: number;
  confirmados: number;
  revocados: number;
  completa: boolean;
};

export function avanceCampana(
  lineas: readonly { decision: string }[]
): AvanceCampana {
  const pendientes = lineas.filter((l) => l.decision === "PENDIENTE").length;
  return {
    total: lineas.length,
    pendientes,
    confirmados: lineas.filter((l) => l.decision === "CONFIRMADO").length,
    revocados: lineas.filter((l) => l.decision === "REVOCADO").length,
    completa: lineas.length > 0 && pendientes === 0,
  };
}

export type ErrorCertificacion =
  | "DECISION_INVALIDA"
  | "PROPIO_ACCESO"
  | "SIN_MOTIVO"
  | "MOTIVO_LARGO"
  | "CAMPANA_CERRADA";

export const MENSAJE_ERROR_CERTIFICACION: Record<ErrorCertificacion, string> = {
  DECISION_INVALIDA: "Indique si el acceso se confirma o se revoca.",
  PROPIO_ACCESO: "Nadie certifica su propio acceso.",
  SIN_MOTIVO: "Revocar un acceso necesita el motivo: es lo que va a leer quien lo vuelva a otorgar.",
  MOTIVO_LARGO: "El motivo no puede superar 500 caracteres.",
  CAMPANA_CERRADA: "La campaña ya no está abierta.",
};

/**
 * Valida una decisión sobre una línea.
 *
 * **Nadie certifica su propio acceso.** Es la mitad no ambigua de la
 * segregación —la misma que ya rige en pedidos, pagos, compras y vacaciones— y
 * es lo mínimo que hace que la certificación signifique algo: un control que
 * el controlado puede firmarse solo no es un control.
 */
export function validarCertificacion(params: {
  estadoCampana: string;
  decision: string;
  motivo: string;
  usuarioRevisadoId: string;
  revisorId: string;
}): ErrorCertificacion | null {
  if (params.estadoCampana !== "ABIERTA") return "CAMPANA_CERRADA";
  if (params.decision !== "CONFIRMADO" && params.decision !== "REVOCADO") {
    return "DECISION_INVALIDA";
  }
  if (params.usuarioRevisadoId === params.revisorId) return "PROPIO_ACCESO";
  // Confirmar no necesita explicación; revocar sí, porque le quita el acceso a
  // alguien y esa decisión tiene que poder releerse.
  if (params.decision === "REVOCADO" && !params.motivo.trim()) return "SIN_MOTIVO";
  if (params.motivo.trim().length > 500) return "MOTIVO_LARGO";
  return null;
}

export const ETIQUETA_DECISION: Record<string, string> = {
  PENDIENTE: "Sin revisar",
  CONFIRMADO: "Confirmado",
  REVOCADO: "Revocado",
};
