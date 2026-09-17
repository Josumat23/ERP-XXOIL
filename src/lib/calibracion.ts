import type { $Enums } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Calibración de los instrumentos del laboratorio.
//
// El laboratorio de XXOIL está en implementación (confirmado por el negocio el
// 2026-09-17). Se construye ahora porque el maestro hace falta desde el primer
// día —qué instrumentos hay y cuándo toca calibrarlos— y el control queda
// apagado hasta que la empresa lo encienda.
//
// Importa más que en otros rubros por una razón concreta: desde el ciclo de la
// densidad, el densímetro produce el número que convierte kg en litros en cada
// comprobante. Una medición tomada con un instrumento descalibrado no se queda
// en el laboratorio: llega a la factura.
//
// La vigencia sale del CERTIFICADO, no de «última calibración + frecuencia».
// Calcularla es lo que hacen los sistemas que terminan afirmando una vigencia
// que discrepa en silencio con el papel que firmó quien calibró.
// ---------------------------------------------------------------------------

export type ResultadoCalibracion = $Enums.ResultadoCalibracion;

export type Calibracion = {
  fecha: Date;
  vigenteHasta: Date;
  resultado: ResultadoCalibracion;
};

export type EstadoCalibracion =
  | "SIN_CALIBRAR"
  | "VIGENTE"
  | "POR_VENCER"
  | "VENCIDA"
  | "NO_CONFORME";

/** Días de aviso antes del vencimiento. Calibrar toma semanas: avisar el día
 *  del vencimiento es avisar tarde. */
export const DIAS_DE_AVISO_CALIBRACION = 30;

export const MENSAJE_ESTADO_CALIBRACION: Record<EstadoCalibracion, string> = {
  SIN_CALIBRAR: "Sin calibrar",
  VIGENTE: "Calibrado",
  POR_VENCER: "Por vencer",
  VENCIDA: "Calibración vencida",
  NO_CONFORME: "Fuera de tolerancia",
};

/**
 * La calibración que rige hoy: la más reciente por fecha.
 *
 * No es «la última cargada»: el historial se puede cargar en cualquier orden al
 * poner el laboratorio en marcha, y la que manda es la más nueva.
 */
export function calibracionVigente<T extends Calibracion>(calibraciones: T[]): T | null {
  if (calibraciones.length === 0) return null;
  // Genérica a propósito: quien la llama suele necesitar además el certificado
  // y quién calibró, y estrechar el tipo acá lo obligaría a buscarlos de nuevo.
  return calibraciones.reduce((masNueva, c) =>
    c.fecha.getTime() > masNueva.fecha.getTime() ? c : masNueva
  );
}

/**
 * En qué estado está el instrumento hoy.
 *
 * `NO_CONFORME` gana sobre las fechas: un instrumento que volvió fuera de
 * tolerancia no mide bien aunque su certificado siga vigente. Es distinto de
 * estar vencido —ahí no se sabe— y por eso son dos estados y no uno.
 */
export function estadoCalibracion(
  calibraciones: Calibracion[],
  hoy: Date = new Date(),
  diasDeAviso: number = DIAS_DE_AVISO_CALIBRACION
): EstadoCalibracion {
  const vigente = calibracionVigente(calibraciones);
  if (!vigente) return "SIN_CALIBRAR";
  if (vigente.resultado === "NO_CONFORME") return "NO_CONFORME";
  if (vigente.vigenteHasta.getTime() < hoy.getTime()) return "VENCIDA";
  const limite = hoy.getTime() + diasDeAviso * 24 * 60 * 60 * 1000;
  return vigente.vigenteHasta.getTime() <= limite ? "POR_VENCER" : "VIGENTE";
}

/** Los estados en que el instrumento NO debería usarse para liberar un lote. */
export function requiereAtencion(estado: EstadoCalibracion): boolean {
  return estado === "VENCIDA" || estado === "NO_CONFORME" || estado === "SIN_CALIBRAR";
}

export type ErrorCalibracion =
  | "SIN_CERTIFICADO"
  | "SIN_ENTIDAD"
  | "VIGENCIA_ANTES_DE_LA_FECHA"
  | "FECHA_EN_EL_FUTURO";

export const MENSAJE_ERROR_CALIBRACION: Record<ErrorCalibracion, string> = {
  SIN_CERTIFICADO:
    "Una calibración se respalda con su certificado. Sin el número, no hay cómo rastrearla.",
  SIN_ENTIDAD: "Indique quién realizó la calibración: un certificado sin emisor no se puede verificar.",
  VIGENCIA_ANTES_DE_LA_FECHA:
    "La vigencia no puede terminar antes de la fecha de calibración. Revise las dos fechas.",
  FECHA_EN_EL_FUTURO:
    "La calibración se registra cuando ya ocurrió. Una fecha futura dejaría el instrumento como calibrado antes de estarlo.",
};

/**
 * Valida una calibración antes de asentarla. Devuelve `null` si es coherente.
 *
 * No juzga si el instrumento sirve —eso lo dice el resultado que trae el
 * certificado— solo que el registro no se contradiga.
 */
export function validarCalibracion(
  datos: {
    fecha: Date;
    vigenteHasta: Date;
    numeroCertificado: string;
    entidad: string;
  },
  hoy: Date = new Date()
): ErrorCalibracion | null {
  if (!datos.numeroCertificado.trim()) return "SIN_CERTIFICADO";
  if (!datos.entidad.trim()) return "SIN_ENTIDAD";
  if (datos.fecha.getTime() > hoy.getTime()) return "FECHA_EN_EL_FUTURO";
  if (datos.vigenteHasta.getTime() < datos.fecha.getTime()) return "VIGENCIA_ANTES_DE_LA_FECHA";
  return null;
}

/**
 * Próxima calibración sugerida a partir de la frecuencia del instrumento.
 *
 * Es una SUGERENCIA para la pantalla: el que manda es el `vigenteHasta` del
 * certificado. `null` cuando el instrumento no tiene frecuencia declarada —no
 * se inventa una.
 */
export function proximaCalibracionSugerida(
  fecha: Date,
  frecuenciaDias: number | null
): Date | null {
  if (frecuenciaDias === null || frecuenciaDias <= 0) return null;
  return new Date(fecha.getTime() + frecuenciaDias * 24 * 60 * 60 * 1000);
}

/**
 * Resumen para el semáforo del panel general: cuántos instrumentos están en
 * cada estado que pide acción.
 *
 * Existe porque una alerta que solo se ve entrando a su propia pantalla no
 * alerta a nadie — el mismo defecto que ya apareció con las homologaciones por
 * vencer y con las equivalencias degradadas.
 */
export function resumenParaSemaforo(
  estados: EstadoCalibracion[]
): { criticos: number; porVencer: number } {
  return {
    criticos: estados.filter(requiereAtencion).length,
    porVencer: estados.filter((e) => e === "POR_VENCER").length,
  };
}
