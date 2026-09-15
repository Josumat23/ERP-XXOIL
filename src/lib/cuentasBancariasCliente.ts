// Cuentas bancarias del cliente.
//
// Funciones puras, sin Prisma.
//
// Es el dato más delicado del maestro: un número de cuenta cambiado por quien
// no debía tocarlo es una transferencia que se va a otro lado.

export type TipoCuentaBancaria = "CORRIENTE" | "AHORROS";

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuentaBancaria, string> = {
  CORRIENTE: "Cuenta corriente",
  AHORROS: "Cuenta de ahorros",
};

export const MONEDAS_CUENTA = ["PEN", "USD"] as const;

export type ErrorCuenta =
  | "SIN_BANCO"
  | "SIN_NUMERO"
  | "NUMERO_INVALIDO"
  | "CCI_INVALIDO"
  | "MONEDA_INVALIDA"
  | "TIPO_INVALIDO"
  | "PRINCIPAL_INACTIVA";

export const MENSAJE_ERROR_CUENTA: Record<ErrorCuenta, string> = {
  SIN_BANCO: "Indique el banco.",
  SIN_NUMERO: "Ingrese el número de cuenta.",
  NUMERO_INVALIDO:
    "El número de cuenta solo lleva dígitos y guiones: cada banco usa su propio largo, así que no se valida más que eso.",
  CCI_INVALIDO: "El CCI tiene exactamente 20 dígitos.",
  MONEDA_INVALIDA: "La moneda de la cuenta debe ser PEN o USD.",
  TIPO_INVALIDO: "Indique si es cuenta corriente o de ahorros.",
  PRINCIPAL_INACTIVA:
    "Una cuenta inactiva no puede ser la principal. Marque otra como principal primero.",
};

/** Solo dígitos, sin separadores. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * El CCI peruano tiene 20 dígitos. Es un formato publicado, no una invención.
 *
 * No se valida el dígito de control ni se deduce el banco de los primeros
 * dígitos: eso exige la tabla oficial de códigos, y adivinarla haría rechazar
 * cuentas buenas.
 */
export function cciValido(cci: string): boolean {
  return soloDigitos(cci).length === 20;
}

export function validarCuenta(params: {
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  cci: string | null;
  moneda: string;
  principal: boolean;
  activa: boolean;
}): ErrorCuenta | null {
  if (!params.banco.trim()) return "SIN_BANCO";

  if (!(["CORRIENTE", "AHORROS"] as string[]).includes(params.tipoCuenta)) return "TIPO_INVALIDO";

  const numero = params.numeroCuenta.trim();
  if (!numero) return "SIN_NUMERO";
  // Cada banco usa su propio largo y su propio formato; lo único común es que
  // no lleva letras. Inventar un largo haría rechazar cuentas buenas.
  if (!/^[\d-]+$/.test(numero) || soloDigitos(numero).length < 6) return "NUMERO_INVALIDO";

  if (params.cci !== null && params.cci.trim() !== "" && !cciValido(params.cci)) {
    return "CCI_INVALIDO";
  }

  if (!(MONEDAS_CUENTA as readonly string[]).includes(params.moneda)) return "MONEDA_INVALIDA";

  if (params.principal && !params.activa) return "PRINCIPAL_INACTIVA";

  return null;
}

/**
 * Cómo se muestra una cuenta a quien puede verla pero no necesita el número
 * entero en pantalla — una lista, un desplegable, un comprobante.
 */
export function numeroParcial(numeroCuenta: string): string {
  const limpio = numeroCuenta.trim();
  if (limpio.length <= 4) return "••••";
  return `••••${limpio.slice(-4)}`;
}

export type CuentaResumible = {
  id: string;
  activa: boolean;
  esPrincipal: boolean | null;
  moneda: string;
};

/**
 * A qué cuenta abonarle en una moneda dada.
 *
 * Solo devuelve una cuenta cuando **no hay ambigüedad**: la principal de esa
 * moneda, o la única activa en esa moneda. Con varias y ninguna principal
 * devuelve `null`, porque elegir a cuál de tres cuentas se transfiere plata no
 * es una decisión que corresponda automatizar.
 */
export function cuentaParaAbonar(
  cuentas: readonly CuentaResumible[],
  moneda: string
): string | null {
  const candidatas = cuentas.filter((c) => c.activa && c.moneda === moneda);
  const principal = candidatas.find((c) => c.esPrincipal);
  if (principal) return principal.id;
  return candidatas.length === 1 ? candidatas[0].id : null;
}
