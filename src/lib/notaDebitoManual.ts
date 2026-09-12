// Nota de débito emitida a mano: aumento de valor (tipo 02) y penalidad
// (tipo 03) del Catálogo 10 de SUNAT.
//
// Funciones puras, sin Prisma.
//
// El sistema **no calcula** estos dos. El de mora sí lo hace —tiene la tasa
// configurada, la fecha de vencimiento y los días transcurridos—, pero cuándo
// corresponde un ajuste de precio o una penalidad, y sobre qué base, es
// criterio del negocio. Aquí el sistema aporta el mecanismo y la persona
// aporta el concepto y el importe, igual que en el checklist de cierre.

import type { TipoNotaDebito } from "@/generated/prisma/client";

/** Los dos tipos que se emiten a mano. El 01 nace de un recargo aplicado. */
export type TipoNotaDebitoManual = Extract<TipoNotaDebito, "AUMENTO_VALOR" | "PENALIDAD_OTROS">;

export const TIPOS_MANUALES: TipoNotaDebitoManual[] = ["AUMENTO_VALOR", "PENALIDAD_OTROS"];

export function esTipoManual(valor: string): valor is TipoNotaDebitoManual {
  return (TIPOS_MANUALES as string[]).includes(valor);
}

export type ImporteNotaDebito = {
  baseImponible: number;
  igv: number;
  total: number;
};

/**
 * Desglosa el importe de la nota.
 *
 * `afectoIgv` **no tiene un valor que el sistema pueda asumir**: si un concepto
 * está afecto es criterio tributario, y no es el mismo para un ajuste de precio
 * sobre una venta gravada que para una penalidad indemnizatoria. Por eso llega
 * como una decisión explícita de quien emite, y no como un valor por defecto
 * conveniente.
 *
 * La tasa es la de la compañía, la misma que usa la facturación.
 */
export function calcularImporte(
  baseImponible: number,
  afectoIgv: boolean,
  tasaIgv: number
): ImporteNotaDebito {
  const base = redondear(baseImponible);
  const igv = afectoIgv ? redondear(base * (tasaIgv / 100)) : 0;
  return { baseImponible: base, igv, total: redondear(base + igv) };
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Valida lo que llega del formulario. Devuelve el error o `null`.
 *
 * No opina sobre cuándo corresponde emitir una nota —eso es del negocio— sino
 * sobre lo que la haría inválida como documento.
 */
export function validarNotaDebitoManual(datos: {
  tipoNota: string;
  baseImponible: number;
  motivo: string;
  afectoIgvDeclarado: string | null;
}): string | null {
  if (!esTipoManual(datos.tipoNota)) {
    return "Seleccione el tipo de nota de débito (aumento de valor o penalidad).";
  }
  if (!Number.isFinite(datos.baseImponible) || datos.baseImponible <= 0) {
    return "El importe debe ser mayor a 0.";
  }
  // Un documento que le llega al cliente sin decir por qué se le cobra no se
  // puede sustentar después, ni ante él ni ante SUNAT.
  if (!datos.motivo.trim()) {
    return "Indique el motivo: es lo que sustenta el cobro ante el cliente y ante SUNAT.";
  }
  if (datos.motivo.trim().length > 500) {
    return "El motivo no puede superar 500 caracteres.";
  }
  // Sin valor por defecto a propósito: la afectación al IGV es criterio
  // tributario y tiene que declararse, no heredarse de una casilla premarcada.
  if (datos.afectoIgvDeclarado !== "SI" && datos.afectoIgvDeclarado !== "NO") {
    return "Indique si el concepto está afecto al IGV.";
  }
  return null;
}

export const ETIQUETA_TIPO_MANUAL: Record<TipoNotaDebitoManual, string> = {
  AUMENTO_VALOR: "Aumento de valor",
  PENALIDAD_OTROS: "Penalidad u otros",
};
