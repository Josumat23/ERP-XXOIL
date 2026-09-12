// Condiciones comerciales pactadas con un proveedor, con vigencias.
//
// Funciones puras: reciben el historial ya leído y no tocan la base.
//
// Los rangos son **semiabiertos**: `[vigenteDesde, vigenteHasta)`. Abrir una
// versión nueva cierra la anterior en la misma fecha, sin restar un día ni
// dejar huecos. Cerrar en "desde menos un día" obliga a razonar sobre
// medianoches y zonas horarias para nada.

export type CondicionComercial = {
  id: string;
  condicionPagoDias: number;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
};

/**
 * La condición que regía en una fecha dada, o `null` si en esa fecha no había
 * ninguna pactada — el caso de una factura anterior al primer registro.
 *
 * Devolver `null` y no "contado" es deliberado: cero días es una condición
 * pactada, no la ausencia de una. Quien lo muestre debe decir "sin condición
 * registrada", que es la verdad.
 */
export function condicionVigenteEn(
  condiciones: readonly CondicionComercial[],
  fecha: Date
): CondicionComercial | null {
  const t = fecha.getTime();
  const aplicables = condiciones.filter(
    (c) => c.vigenteDesde.getTime() <= t && (c.vigenteHasta === null || t < c.vigenteHasta.getTime())
  );
  if (aplicables.length === 0) return null;
  // Si los datos traen solapamiento (no debería: la acción cierra la anterior
  // al abrir la nueva), gana la de inicio más reciente. Nunca se devuelve una
  // lista ambigua a quien solo puede mostrar un número.
  return aplicables.reduce((a, b) =>
    b.vigenteDesde.getTime() >= a.vigenteDesde.getTime() ? b : a
  );
}

/** La versión abierta, que es la que rige hoy. `null` si no hay ninguna. */
export function condicionAbierta(
  condiciones: readonly CondicionComercial[]
): CondicionComercial | null {
  const abiertas = condiciones.filter((c) => c.vigenteHasta === null);
  if (abiertas.length === 0) return null;
  return abiertas.reduce((a, b) =>
    b.vigenteDesde.getTime() >= a.vigenteDesde.getTime() ? b : a
  );
}

export type MotivoRechazoVigencia =
  | "ANTERIOR_A_LA_VIGENTE"
  | "PLAZO_INVALIDO"
  | "SIN_MOTIVO";

export const MENSAJE_RECHAZO_VIGENCIA: Record<MotivoRechazoVigencia, string> = {
  ANTERIOR_A_LA_VIGENTE:
    "La nueva condición no puede empezar antes que la que está vigente. Para corregir un error, registre la condición correcta desde hoy.",
  PLAZO_INVALIDO: "El plazo de pago debe ser un número entero de días, cero o mayor.",
  SIN_MOTIVO: "Indique por qué cambió la condición: es lo que permite rastrearla después.",
};

/**
 * Verifica que se pueda abrir una versión nueva. `null` = se puede.
 *
 * No se admite insertar una versión con fecha anterior a la vigente. Permitirlo
 * abriría la puerta a reescribir el pasado —y con él, el plazo bajo el que ya
 * se recibieron facturas— que es justo lo que este historial viene a impedir.
 * Un error se corrige registrando la condición correcta desde hoy, y el motivo
 * deja constancia de que fue una corrección.
 */
export function validarNuevaCondicion(
  condiciones: readonly CondicionComercial[],
  nueva: { condicionPagoDias: number; vigenteDesde: Date; motivo: string }
): MotivoRechazoVigencia | null {
  if (!Number.isInteger(nueva.condicionPagoDias) || nueva.condicionPagoDias < 0) {
    return "PLAZO_INVALIDO";
  }
  if (nueva.motivo.trim().length === 0) return "SIN_MOTIVO";

  const abierta = condicionAbierta(condiciones);
  if (abierta && nueva.vigenteDesde.getTime() < abierta.vigenteDesde.getTime()) {
    return "ANTERIOR_A_LA_VIGENTE";
  }
  return null;
}
