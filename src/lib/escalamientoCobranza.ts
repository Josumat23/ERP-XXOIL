// Escalamiento de cobranza: qué acción toca hoy sobre una factura vencida,
// según la política que definió el negocio.
//
// Funciones puras, sin Prisma. La acción **se deriva en cada render**: no se
// guarda ni la calcula un trabajo por temporizador, porque cambia sola con el
// calendario y con el próximo cobro.
//
// Lo que este motor NO hace: emitir el aviso por su cuenta. En este sistema
// "registrar aviso" no envía nada —no hay correo ni mensajería en ninguna
// parte—, sino que **deja constancia de que alguien contactó al cliente**. Un
// trabajo automático que creara esas filas estaría fabricando un registro de
// contacto que nunca ocurrió. Así que calcula lo que la política dice que
// corresponde, y la persona lo ejecuta y lo registra.

import type { EstadoRegistrado } from "@/lib/gestionCobranza";

export type NivelAviso = 1 | 2 | 3;

export type PoliticaEscalamiento = {
  diasNivel2: number;
  diasNivel3: number;
  /** `null` = la regla no corre. */
  diasSinRespuesta: number | null;
  /** `null` = la regla no corre. */
  diasGraciaCompromiso: number | null;
  pausarEnDisputa: boolean;
};

export type AvisoParaEscalar = {
  nivel: number;
  fecha: Date;
  estado: EstadoRegistrado;
  compromisoPagoEn: Date | null;
};

export type AccionCobranza =
  /** Nada que hacer hoy: el procedimiento está al día. */
  | { tipo: "AL_DIA"; motivo: string }
  /** Deliberadamente no se persigue: hay un compromiso vigente o una disputa. */
  | { tipo: "PAUSADA"; motivo: string }
  | { tipo: "AVISO_DEBIDO"; nivel: NivelAviso; motivo: string }
  /** El aviso final ya se agotó: lo que siga es una decisión de una persona. */
  | { tipo: "AGOTADO"; motivo: string };

/** Umbrales por defecto, los que el código traía fijos antes de la política. */
export const DIAS_NIVEL_2_POR_DEFECTO = 15;
export const DIAS_NIVEL_3_POR_DEFECTO = 30;

export function nivelPorAntiguedad(
  diasVencidos: number,
  diasNivel2: number = DIAS_NIVEL_2_POR_DEFECTO,
  diasNivel3: number = DIAS_NIVEL_3_POR_DEFECTO
): NivelAviso {
  if (diasVencidos > diasNivel3) return 3;
  if (diasVencidos > diasNivel2) return 2;
  return 1;
}

function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Días completos transcurridos entre dos fechas, contando por día calendario. */
function diasEntre(desde: Date, hasta: Date): number {
  const ms = inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-PE");
}

/** Un candidato a escalar: el nivel que pide y por qué lo pide. */
type Candidato = { nivel: number; motivo: string };

/**
 * Qué corresponde hacer hoy con una factura vencida.
 *
 * Las reglas, en orden:
 *
 * 1. **Un compromiso vigente pausa todo.** Perseguir a alguien el día después
 *    de que quedó en pagar el viernes es la forma más rápida de perder el
 *    compromiso. La palanca es la fecha: quien la registra decide hasta cuándo
 *    se espera. Un compromiso SIN fecha no pausa nada — si no, bastaría con
 *    guardar uno vacío para congelar la cobranza de una factura.
 * 2. **Una disputa pausa, si la política lo dice.**
 * 3. Si no hay pausa, se juntan los candidatos a escalar —antigüedad, aviso sin
 *    respuesta, compromiso incumplido— y **gana el nivel más alto**; a igual
 *    nivel, gana el motivo más específico, porque es el que le sirve a quien
 *    va a llamar al cliente.
 * 4. Si el candidato pide más que el aviso final, no se inventa un nivel 4: se
 *    devuelve `AGOTADO`, que es una decisión de una persona (cobranza judicial,
 *    castigo, bloqueo) y no algo que el sistema resuelva solo.
 */
export function accionDeCobranza(
  diasVencidos: number,
  ultimoAviso: AvisoParaEscalar | null,
  politica: PoliticaEscalamiento,
  hoy: Date = new Date()
): AccionCobranza {
  if (ultimoAviso?.estado === "COMPROMISO_PAGO" && ultimoAviso.compromisoPagoEn) {
    const vencido = inicioDelDia(ultimoAviso.compromisoPagoEn) < inicioDelDia(hoy);
    if (!vencido) {
      return {
        tipo: "PAUSADA",
        motivo: `El cliente se comprometió a pagar el ${formatearFecha(ultimoAviso.compromisoPagoEn)}.`,
      };
    }
  }

  if (ultimoAviso?.estado === "EN_DISPUTA" && politica.pausarEnDisputa) {
    return {
      tipo: "PAUSADA",
      motivo: "La factura está en disputa; la política no escala mientras se resuelve.",
    };
  }

  const porAntiguedad = nivelPorAntiguedad(diasVencidos, politica.diasNivel2, politica.diasNivel3);

  if (!ultimoAviso) {
    return {
      tipo: "AVISO_DEBIDO",
      nivel: porAntiguedad,
      motivo: `${diasVencidos} ${diasVencidos === 1 ? "día vencida" : "días vencida"} y sin ningún aviso registrado.`,
    };
  }

  // De más específico a menos: el desempate a igual nivel se resuelve por este
  // orden, para que el motivo que se muestre sea el más accionable.
  const candidatos: Candidato[] = [];

  // Se exige el estado además de la fecha. Hoy la acción que registra la
  // respuesta limpia la fecha al cambiar de estado, así que no puede quedar una
  // huérfana; depender de esa invariante desde otro archivo sería frágil.
  // Si se llega hasta aquí, el compromiso ya está vencido: la regla 1 devolvió
  // antes para los vigentes.
  if (
    politica.diasGraciaCompromiso !== null &&
    ultimoAviso.estado === "COMPROMISO_PAGO" &&
    ultimoAviso.compromisoPagoEn
  ) {
    const diasDesdeCompromiso = diasEntre(ultimoAviso.compromisoPagoEn, hoy);
    if (diasDesdeCompromiso >= politica.diasGraciaCompromiso) {
      candidatos.push({
        nivel: ultimoAviso.nivel + 1,
        motivo: `El compromiso del ${formatearFecha(ultimoAviso.compromisoPagoEn)} se incumplió hace ${diasDesdeCompromiso} ${diasDesdeCompromiso === 1 ? "día" : "días"}.`,
      });
    }
  }

  const sinRespuesta = ultimoAviso.estado === "PENDIENTE" || ultimoAviso.estado === "SIN_RESPUESTA";
  if (politica.diasSinRespuesta !== null && sinRespuesta) {
    const diasDesdeAviso = diasEntre(ultimoAviso.fecha, hoy);
    if (diasDesdeAviso >= politica.diasSinRespuesta) {
      candidatos.push({
        nivel: ultimoAviso.nivel + 1,
        motivo: `El aviso lleva ${diasDesdeAviso} ${diasDesdeAviso === 1 ? "día" : "días"} sin respuesta.`,
      });
    }
  }

  if (porAntiguedad > ultimoAviso.nivel) {
    candidatos.push({
      nivel: porAntiguedad,
      motivo: `La factura ya lleva ${diasVencidos} días vencida.`,
    });
  }

  const ganador = candidatos.reduce<Candidato | null>(
    (mejor, actual) => (mejor === null || actual.nivel > mejor.nivel ? actual : mejor),
    null
  );

  if (ganador === null) {
    return {
      tipo: "AL_DIA",
      motivo: `El aviso de nivel ${ultimoAviso.nivel} es el que corresponde por ahora.`,
    };
  }

  if (ganador.nivel > 3) {
    return {
      tipo: "AGOTADO",
      motivo: `${ganador.motivo} El aviso final ya se emitió: lo que siga es una decisión de Gerencia.`,
    };
  }

  return { tipo: "AVISO_DEBIDO", nivel: ganador.nivel as NivelAviso, motivo: ganador.motivo };
}

/**
 * Valida la política antes de guardarla. Devuelve el error o `null`.
 *
 * No opina sobre cuántos días son los correctos —eso es del negocio— sino
 * sobre lo que haría al motor incoherente.
 */
export function validarPolitica(politica: {
  diasNivel2: number;
  diasNivel3: number;
  diasSinRespuesta: number | null;
  diasGraciaCompromiso: number | null;
}): string | null {
  const { diasNivel2, diasNivel3, diasSinRespuesta, diasGraciaCompromiso } = politica;
  if (!Number.isInteger(diasNivel2) || !Number.isInteger(diasNivel3)) {
    return "Los días de cada nivel deben ser números enteros.";
  }
  if (diasNivel2 < 0 || diasNivel3 < 0) return "Los días no pueden ser negativos.";
  // Con el nivel 3 por debajo del 2, el nivel 2 sería inalcanzable: toda
  // factura que pasara el umbral menor caería directo en el aviso final.
  if (diasNivel3 <= diasNivel2) {
    return "El aviso final tiene que pedir más días vencidos que el aviso formal.";
  }
  for (const [valor, nombre] of [
    [diasSinRespuesta, "días sin respuesta"],
    [diasGraciaCompromiso, "días de gracia"],
  ] as const) {
    if (valor === null) continue;
    if (!Number.isInteger(valor) || valor < 1) {
      return `Los ${nombre} deben ser un número entero de 1 o más, o quedar vacíos para no aplicar la regla.`;
    }
  }
  return null;
}
