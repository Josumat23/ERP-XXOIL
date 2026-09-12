// Maestro de transportistas contratados.
//
// Funciones puras, sin Prisma ni `server-only`, para que el formulario de la
// guía tome los tipos de aquí y la suite pruebe la lógica sin levantar el
// cliente de base.

/** Lo mínimo que el selector de la guía necesita de cada transportista. */
export type TransportistaSeleccionable = {
  id: string;
  codigo: string;
  razonSocial: string;
  ruc: string | null;
  vehiculos: { id: string; placa: string }[];
  conductores: { id: string; nombres: string; dni: string }[];
};

/**
 * Los datos que el transportista elegido aporta a la guía.
 *
 * Devuelve un objeto **vacío** cuando no se eligió ninguno, no tres `null`: al
 * esparcirlo en un `update`, las claves ausentes dejan intactas las columnas.
 * Con `null` se borraría el transportista que alguien escribió a mano, que es
 * justamente el respaldo de las guías que el maestro todavía no cubre. Es el
 * mismo criterio que `nombresDeUbigeo`.
 */
export function datosDeTransportista(
  transportista: { razonSocial: string; ruc: string | null } | null
): { transportista?: string; transportistaRuc?: string | null } {
  if (!transportista) return {};
  return {
    transportista: transportista.razonSocial,
    transportistaRuc: transportista.ruc,
  };
}

/** RUC peruano: 11 dígitos. Vacío se acepta — el RUC es opcional. */
export function rucValido(ruc: string): boolean {
  return ruc === "" || /^\d{11}$/.test(ruc);
}

export function normalizarPlaca(placa: string): string {
  return placa.trim().toUpperCase();
}

export function validarTransportista(datos: {
  razonSocial: string;
  ruc: string;
  registroMtc: string;
}): string | null {
  if (!datos.razonSocial.trim()) return "La razón social es obligatoria.";
  if (datos.razonSocial.trim().length > 200) {
    return "La razón social no puede superar 200 caracteres.";
  }
  if (!rucValido(datos.ruc.trim())) return "El RUC debe tener 11 dígitos.";
  if (datos.registroMtc.trim().length > 50) {
    return "El registro del MTC no puede superar 50 caracteres.";
  }
  return null;
}

export function validarVehiculo(placa: string): string | null {
  const limpia = normalizarPlaca(placa);
  if (!limpia) return "La placa es obligatoria.";
  // Sin formato fijo a propósito: las placas peruanas cambiaron de formato
  // varias veces y un vehículo extranjero en tránsito tiene el suyo. Se exige
  // que diga algo, no que se parezca a un patrón.
  if (limpia.length > 20) return "La placa no puede superar 20 caracteres.";
  return null;
}

export function validarConductor(datos: { nombres: string; dni: string }): string | null {
  if (!datos.nombres.trim()) return "El nombre del conductor es obligatorio.";
  // El DNI del conductor viaja en el XML de la guía: 8 dígitos.
  if (!/^\d{8}$/.test(datos.dni.trim())) return "El DNI debe tener 8 dígitos.";
  return null;
}
