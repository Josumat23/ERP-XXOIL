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

// ---------------------------------------------------------------------------
// Trazabilidad: ¿con qué respaldo se tomó una medición?
//
// La pregunta que importa el día que una calibración vuelve fuera de
// tolerancia: «¿qué lotes se liberaron con este instrumento, y cuáles quedan en
// duda?».
//
// El estado NO se congela en el resultado del ensayo, se deriva del historial.
// Guardarlo fijaría una respuesta que mejora sola a medida que se carga el
// historial —justo lo que va a pasar mientras el laboratorio se pone en
// marcha— y que además podría discrepar del ledger sin que nada lo avise.
// ---------------------------------------------------------------------------

export type RespaldoMedicion = "CALIBRADO" | "EN_DUDA" | "SIN_RESPALDO";

export const MENSAJE_RESPALDO: Record<RespaldoMedicion, string> = {
  CALIBRADO: "Con calibración vigente",
  EN_DUDA: "En duda: la siguiente verificación salió fuera de tolerancia",
  SIN_RESPALDO: "Sin calibración vigente a esa fecha",
};

/**
 * Con qué respaldo se tomó una medición en `fecha`.
 *
 * - `CALIBRADO`: una calibración conforme cubría esa fecha.
 * - `EN_DUDA`: la cubría, pero la verificación siguiente salió `NO_CONFORME`.
 *   Es el caso clásico: si el instrumento se encontró fuera de tolerancia,
 *   todo lo medido desde su última calibración buena queda en cuestión.
 * - `SIN_RESPALDO`: ninguna calibración cubría esa fecha.
 *
 * Lo que el sistema hace es **informar**, no dictaminar. Si una medición en
 * duda invalida el lote, obliga a reensayar o no cambia nada es criterio de
 * calidad, y no se decide desde acá.
 */
export function respaldoDeMedicion(
  calibraciones: Calibracion[],
  fecha: Date
): RespaldoMedicion {
  const cuando = fecha.getTime();

  // La calibración conforme MÁS RECIENTE que cubre esa fecha. Tomar «la
  // primera que encaje» dependería del orden en que vino el arreglo.
  const cubre = calibraciones
    .filter(
      (c) =>
        c.resultado !== "NO_CONFORME" &&
        c.fecha.getTime() <= cuando &&
        cuando <= c.vigenteHasta.getTime()
    )
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
  if (!cubre) return "SIN_RESPALDO";

  // La verificación siguiente a esa calibración.
  const siguiente = calibraciones
    .filter((c) => c.fecha.getTime() > cubre.fecha.getTime())
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0];
  if (siguiente?.resultado !== "NO_CONFORME") return "CALIBRADO";

  // Se encontró fuera de tolerancia. Si eso pasó ANTES de la medición, ya se
  // sabía que el instrumento estaba mal y la vigencia anterior no lo respalda.
  // Si pasó DESPUÉS, lo medido en el medio queda en cuestión: nadie podía
  // saberlo entonces.
  return siguiente.fecha.getTime() <= cuando ? "SIN_RESPALDO" : "EN_DUDA";
}

/** Las mediciones que no se pueden dar por respaldadas. */
export function medicionesSinRespaldo<
  T extends { fecha: Date; calibraciones: Calibracion[] },
>(mediciones: T[]): T[] {
  return mediciones.filter((m) => respaldoDeMedicion(m.calibraciones, m.fecha) !== "CALIBRADO");
}

// ---------------------------------------------------------------------------
// Cuánto pesa el control al liberar un lote.
//
// Decisión del negocio (2026-09-17), después de tres ciclos preguntándola: no
// son dos opciones sino TRES. El laboratorio informa siempre; frenar la
// liberación es algo que la empresa elige, y «no aplica» existe para que el
// proceso siga su curso mientras el laboratorio se implementa.
//
// Es la regla que faltaba para cerrar el laboratorio, y se resolvió al revés
// de lo que suelen hacer los ERP: por omisión NO frena. Un control de calidad
// que detiene la producción el día que alguien olvidó cargar un certificado no
// se usa — se apaga, y con él se apaga todo lo demás.
// ---------------------------------------------------------------------------

export type NivelControlCalibracion = $Enums.NivelControlCalibracion;

export const MENSAJE_NIVEL_CONTROL: Record<NivelControlCalibracion, string> = {
  NO_APLICA: "No aplica",
  ADVIERTE: "Advierte",
  BLOQUEA: "Bloquea",
};

export const EXPLICACION_NIVEL_CONTROL: Record<NivelControlCalibracion, string> = {
  NO_APLICA:
    "El laboratorio todavía no aplica. Se pueden cargar instrumentos y calibraciones igual; el semáforo y los avisos quedan apagados.",
  ADVIERTE:
    "Los instrumentos sin calibración vigente aparecen en el semáforo, y liberar un lote medido con uno de ellos avisa pero deja pasar. El lote queda listado en «Qué hay que reensayar».",
  BLOQUEA:
    "Además de avisar, no deja liberar un lote medido con un instrumento sin calibración vigente. Úselo cuando el laboratorio ya esté en régimen: antes, frena producción por un certificado que falta cargar.",
};

/** ¿El nivel hace que el semáforo y los avisos se vean? */
export function avisaAlgo(nivel: NivelControlCalibracion): boolean {
  return nivel !== "NO_APLICA";
}

export type ControlAlLiberar = {
  /** Si `true`, la liberación no se asienta. */
  bloquea: boolean;
  /** Qué decirle a quien libera. `null` cuando no hay nada que decir. */
  aviso: string | null;
};

/**
 * Qué hace el sistema al liberar un lote medido con instrumentos sin respaldo.
 *
 * `instrumentosSinRespaldo` son los códigos de los instrumentos cuya medición
 * en este ensayo no se sostiene. Si está vacío no pasa nada, cualquiera sea el
 * nivel: el control no inventa problemas donde no los hay.
 */
export function controlAlLiberar(
  nivel: NivelControlCalibracion,
  instrumentosSinRespaldo: string[]
): ControlAlLiberar {
  if (nivel === "NO_APLICA" || instrumentosSinRespaldo.length === 0) {
    return { bloquea: false, aviso: null };
  }
  const lista = instrumentosSinRespaldo.join(", ");
  const uno = instrumentosSinRespaldo.length === 1;
  const sujeto = uno
    ? `El instrumento ${lista} no tiene`
    : `Los instrumentos ${lista} no tienen`;

  if (nivel === "BLOQUEA") {
    return {
      bloquea: true,
      // El mensaje dice qué hacer, no solo que no se puede: quien libera un
      // lote a las 11 de la noche necesita saber si esto se resuelve cargando
      // un certificado o si hay que llamar a alguien.
      aviso: `${sujeto} calibración vigente, y el control está en BLOQUEA. Cargue la calibración que falta en Instrumentos de medición, o baje el control a ADVIERTE si el negocio acepta liberar con esta medición.`,
    };
  }
  return {
    bloquea: false,
    aviso: `${sujeto} calibración vigente. El lote se libera igual y queda listado en «Qué hay que reensayar» para que calidad decida.`,
  };
}

/** Los niveles que existen, en orden de menos a más exigente. */
export const NIVELES_CONTROL_CALIBRACION: NivelControlCalibracion[] = [
  "NO_APLICA",
  "ADVIERTE",
  "BLOQUEA",
];
