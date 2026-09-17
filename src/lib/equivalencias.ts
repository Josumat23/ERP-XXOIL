import { declaracionesParaDocumento, type TipoCumplimiento } from "@/lib/especificaciones";

// ---------------------------------------------------------------------------
// «¿Cuál es tu equivalente al Delvac 1340?»
//
// Es la pregunta que más se repite en una venta de lubricantes, y hasta ahora el
// sistema no podía contestarla. La respuesta fácil es una tabla de sinónimos
// —lo que hacen los ERP genéricos con sus cross-references— y esa tabla no dice
// nada: si alguien pregunta por qué son equivalentes, la respuesta es «porque
// alguien lo tecleó».
//
// Acá la equivalencia carga su evidencia. Se compara contra las
// especificaciones que las dos fichas declaran, y el sistema muestra qué cubre
// y qué no. Lo que el sistema NO hace es decidir: dos lubricantes se reemplazan
// por criterio técnico y comercial, no por aritmética de siglas. La declara una
// persona y queda con su nombre.
//
// Lo que sí hace, y una tabla de sinónimos no puede, es **degradarse sola**: si
// una homologación nuestra vence, la cobertura de hoy baja sin que nadie toque
// la equivalencia, y el contraste queda a la vista.
// ---------------------------------------------------------------------------

export type DeclaracionPropia = {
  especificacionId: string;
  tipo: TipoCumplimiento;
  vigenteHasta: Date | null;
};

export type Cobertura = {
  /** Ids de especificaciones del competidor que nuestro producto sí declara hoy. */
  cubiertas: string[];
  /** Las que no. Son las que obligan a justificar la equivalencia. */
  faltantes: string[];
  total: number;
  /** `true` solo si el competidor declara al menos una y las cubrimos todas. */
  esTotal: boolean;
};

/**
 * Qué especificaciones del competidor cubre nuestro producto **hoy**.
 *
 * Una homologación nuestra vencida NO cuenta, por la misma razón por la que no
 * se imprime en el certificado: hoy no se puede afirmar. Eso hace que la
 * cobertura baje sola cuando una aprobación caduca, que es justo lo que una
 * tabla de sinónimos no avisa nunca.
 */
export function coberturaEspecificaciones(
  propias: DeclaracionPropia[],
  delCompetidor: { especificacionId: string }[],
  hoy: Date = new Date()
): Cobertura {
  const vigentes = new Set(
    declaracionesParaDocumento(propias, hoy).map((d) => d.especificacionId)
  );
  const cubiertas: string[] = [];
  const faltantes: string[] = [];
  for (const { especificacionId } of delCompetidor) {
    (vigentes.has(especificacionId) ? cubiertas : faltantes).push(especificacionId);
  }
  return {
    cubiertas,
    faltantes,
    total: delCompetidor.length,
    esTotal: delCompetidor.length > 0 && faltantes.length === 0,
  };
}

export type ErrorEquivalencia = "COMPETIDOR_SIN_ESPECIFICACIONES" | "FALTA_JUSTIFICACION";

export const MENSAJE_ERROR_EQUIVALENCIA: Record<ErrorEquivalencia, string> = {
  COMPETIDOR_SIN_ESPECIFICACIONES:
    "El producto de la competencia todavía no declara ninguna especificación, así que no hay contra qué comparar. Cargue primero lo que dice su ficha técnica.",
  FALTA_JUSTIFICACION:
    "Nuestro producto no cubre todas las especificaciones que declara el de la competencia. Se puede declarar igual —una norma nueva reemplaza a la anterior, por ejemplo— pero la razón tiene que quedar escrita.",
};

/**
 * Valida la declaración de equivalencia. Devuelve `null` si se puede asentar.
 *
 * No prohíbe declarar una equivalencia con huecos: hay motivos legítimos —una
 * especificación que reemplaza a otra, un uso donde la faltante no aplica— y
 * bloquearlo sería inventar un criterio técnico que no es del sistema. Lo que
 * exige es que ese motivo quede escrito.
 */
export function validarEquivalencia(
  cobertura: Cobertura,
  justificacion: string | null
): ErrorEquivalencia | null {
  if (cobertura.total === 0) return "COMPETIDOR_SIN_ESPECIFICACIONES";
  if (!cobertura.esTotal && !justificacion?.trim()) return "FALTA_JUSTIFICACION";
  return null;
}

export type CambioCobertura = {
  sentido: "IGUAL" | "MEJORO" | "EMPEORO";
  texto: string;
};

/**
 * Qué pasó con la evidencia desde que se declaró la equivalencia.
 *
 * Una lista de números obliga a restar mentalmente en cada fila; y lo que
 * importa no es el número de hoy sino que haya cambiado — sobre todo hacia
 * abajo, que es la homologación que venció sin que nadie mirara.
 */
export function cambioDeCobertura(
  alDeclarar: { cubiertas: number; total: number },
  hoy: { cubiertas: number; total: number }
): CambioCobertura {
  if (hoy.cubiertas === alDeclarar.cubiertas && hoy.total === alDeclarar.total) {
    return { sentido: "IGUAL", texto: `${hoy.cubiertas} de ${hoy.total}` };
  }
  const sentido = hoy.cubiertas < alDeclarar.cubiertas ? "EMPEORO" : "MEJORO";
  const verbo = sentido === "EMPEORO" ? "bajó" : "subió";
  return {
    sentido,
    texto: `${hoy.cubiertas} de ${hoy.total} — ${verbo} desde ${alDeclarar.cubiertas} de ${alDeclarar.total} al declararla`,
  };
}
