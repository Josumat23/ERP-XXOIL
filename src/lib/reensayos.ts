import { respaldoDeMedicion, type Calibracion, type RespaldoMedicion } from "./calibracion";

// ---------------------------------------------------------------------------
// Qué hay que reensayar.
//
// El sistema ya sabía, instrumento por instrumento, qué había medido cada uno y
// con qué respaldo. Faltaba la pregunta al revés, que es la que se hace el día
// que una calibración vuelve fuera de tolerancia: «¿qué tengo que reensayar, de
// todo el laboratorio, y por dónde empiezo?».
//
// Ir instrumento por instrumento no sirve ese día: hay que revisarlos todos
// para descubrir cuáles tienen trabajo pendiente, y el que se olvida es el que
// importaba.
//
// La decisión de fondo del ciclo es el ORDEN. Una lista sin orden obliga a
// leerla entera para saber qué urge, y con volumen real nadie la lee entera. Lo
// que manda no es la gravedad del problema de medición sino dónde está el
// producto: lo que el cliente ya tiene no se arregla reensayándolo —hay que
// decidir qué se le dice—, mientras que lo que sigue en almacén se reensaya y
// se acabó.
// ---------------------------------------------------------------------------

/**
 * Los dos momentos en que el laboratorio mide.
 *
 * `LIBERACION` es el ensayo del lote granel antes de dejarlo salir.
 * `REANALISIS` es el re-ensayo que le da vigencia nueva a un envasado ya
 * fabricado. Comparten tabla porque son la misma medición en dos momentos,
 * pero **no comparten consecuencia**: si la de liberación no se sostiene, lo
 * que está en duda es que el lote cumpliera; si no se sostiene la del
 * re-análisis, lo que está en duda es la vigencia que se le dio.
 */
export type TipoEnsayo = "LIBERACION" | "REANALISIS" | "RECEPCION";

export const MENSAJE_TIPO_ENSAYO: Record<TipoEnsayo, string> = {
  LIBERACION: "Liberación del lote",
  REANALISIS: "Re-análisis de vigencia",
  RECEPCION: "Inspección de recepción",
};

export const CONSECUENCIA_ENSAYO: Record<TipoEnsayo, string> = {
  LIBERACION: "No se sostiene que el lote cumpliera al liberarlo",
  REANALISIS: "No se sostiene la vigencia que se le dio",
  RECEPCION: "No se sostiene que el insumo cumpliera al recibirlo",
};

/**
 * Una medición tal como llega del cruce ensayo × instrumento.
 *
 * Los datos del ítem se repiten en cada fila a propósito: así llega un join y
 * así se puede probar sin montar un grafo de objetos.
 */
export type MedicionParaRevisar = {
  ensayo: TipoEnsayo;
  /** El lote granel o el envasado, según qué se midió. */
  itemId: string;
  itemCodigo: string;
  /** Siempre el lote granel: el recall se hace por lote, también para un envasado. */
  loteGranelId: string;
  productoNombre: string;
  /** Si todavía queda producto en casa. Un lote: aprobado; un envasado: con saldo. */
  disponibleEnAlmacen: boolean;
  unidadesDespachadas: number;
  clientesAfectados: number;
  fechaEnsayo: Date;
  caracteristica: string;
  instrumentoId: string;
  instrumentoCodigo: string;
  calibraciones: Calibracion[];
};

export type MedicionEnCuestion = {
  caracteristica: string;
  instrumentoId: string;
  instrumentoCodigo: string;
  respaldo: RespaldoMedicion;
};

export type ItemPorReensayar = {
  ensayo: TipoEnsayo;
  itemId: string;
  itemCodigo: string;
  loteGranelId: string;
  productoNombre: string;
  disponibleEnAlmacen: boolean;
  unidadesDespachadas: number;
  clientesAfectados: number;
  fechaEnsayo: Date;
  mediciones: MedicionEnCuestion[];
  peorRespaldo: RespaldoMedicion;
  destino: DestinoDelProducto;
};

/**
 * Dónde está el producto hoy. Es lo que decide qué se hace con él, y por eso
 * es lo que ordena la lista.
 */
export type DestinoDelProducto = "DESPACHADO" | "EN_ALMACEN" | "SIN_SALIDA";

/**
 * Cómo se dice cada destino, según qué se ensayó.
 *
 * `DESPACHADO` significa «ya no lo tenemos». Para un lote o un envase eso es
 * que lo tiene el cliente; para un insumo, que ya se consumió en producción
 * —y entonces el problema no es el insumo sino lo que se fabricó con él—.
 * Es la misma posición en la lista y son dos conversaciones distintas, así
 * que se nombran distinto.
 */
export const MENSAJE_DESTINO: Record<TipoEnsayo, Record<DestinoDelProducto, string>> = {
  LIBERACION: {
    DESPACHADO: "Ya está en poder del cliente",
    EN_ALMACEN: "Todavía en almacén",
    SIN_SALIDA: "Nunca salió",
  },
  REANALISIS: {
    DESPACHADO: "Ya está en poder del cliente",
    EN_ALMACEN: "Todavía en almacén",
    SIN_SALIDA: "Nunca salió",
  },
  RECEPCION: {
    DESPACHADO: "Ya se consumió en producción",
    EN_ALMACEN: "Todavía en almacén, sin consumir",
    SIN_SALIDA: "Ni consumido ni en stock",
  },
};

/**
 * `EN_DUDA` pesa más que `SIN_RESPALDO` y no al revés, que es lo que parece a
 * primera vista.
 *
 * `EN_DUDA` es un problema confirmado: el instrumento se verificó y estaba
 * fuera de tolerancia. `SIN_RESPALDO` casi siempre es un hueco de datos
 * —una calibración que existe en papel y todavía no se cargó— y se resuelve
 * cargándola, sin tocar el producto.
 */
const GRAVEDAD_RESPALDO: Record<RespaldoMedicion, number> = {
  CALIBRADO: 0,
  SIN_RESPALDO: 1,
  EN_DUDA: 2,
};

const URGENCIA_DESTINO: Record<DestinoDelProducto, number> = {
  SIN_SALIDA: 0,
  EN_ALMACEN: 1,
  DESPACHADO: 2,
};

export function destinoDelProducto(item: {
  unidadesDespachadas: number;
  disponibleEnAlmacen: boolean;
}): DestinoDelProducto {
  if (item.unidadesDespachadas > 0) return "DESPACHADO";
  return item.disponibleEnAlmacen ? "EN_ALMACEN" : "SIN_SALIDA";
}

/**
 * Los lotes y envasados con al menos una medición que no se puede dar por
 * respaldada, agrupados y ordenados por lo que urge.
 *
 * Solo entran mediciones que declaran con qué instrumento se tomaron: sin eso
 * no hay historial contra el cual derivar nada. Las que no lo declaran son un
 * problema distinto —no se sabe qué se usó— y se cuentan aparte en vez de
 * mezclarse acá, donde parecerían resueltas.
 *
 * Un mismo lote puede aparecer dos veces si falla su liberación y además el
 * re-análisis de uno de sus envasados: son dos trabajos distintos y juntarlos
 * escondería uno de los dos.
 */
export function lotesPorReensayar(mediciones: MedicionParaRevisar[]): ItemPorReensayar[] {
  const porItem = new Map<string, ItemPorReensayar>();

  for (const m of mediciones) {
    const respaldo = respaldoDeMedicion(m.calibraciones, m.fechaEnsayo);
    if (respaldo === "CALIBRADO") continue;

    const clave = `${m.ensayo}:${m.itemId}`;
    const existente = porItem.get(clave);
    const enCuestion: MedicionEnCuestion = {
      caracteristica: m.caracteristica,
      instrumentoId: m.instrumentoId,
      instrumentoCodigo: m.instrumentoCodigo,
      respaldo,
    };
    if (existente) {
      existente.mediciones.push(enCuestion);
      if (GRAVEDAD_RESPALDO[respaldo] > GRAVEDAD_RESPALDO[existente.peorRespaldo]) {
        existente.peorRespaldo = respaldo;
      }
      continue;
    }
    porItem.set(clave, {
      ensayo: m.ensayo,
      itemId: m.itemId,
      itemCodigo: m.itemCodigo,
      loteGranelId: m.loteGranelId,
      productoNombre: m.productoNombre,
      disponibleEnAlmacen: m.disponibleEnAlmacen,
      unidadesDespachadas: m.unidadesDespachadas,
      clientesAfectados: m.clientesAfectados,
      fechaEnsayo: m.fechaEnsayo,
      mediciones: [enCuestion],
      peorRespaldo: respaldo,
      destino: destinoDelProducto(m),
    });
  }

  return [...porItem.values()].sort(
    (a, b) =>
      URGENCIA_DESTINO[b.destino] - URGENCIA_DESTINO[a.destino] ||
      GRAVEDAD_RESPALDO[b.peorRespaldo] - GRAVEDAD_RESPALDO[a.peorRespaldo] ||
      b.fechaEnsayo.getTime() - a.fechaEnsayo.getTime() ||
      a.itemCodigo.localeCompare(b.itemCodigo)
  );
}

/**
 * Para el semáforo del panel: cuánto hay que revisar y cuánto de eso ya está
 * afuera.
 *
 * Se separan porque son dos conversaciones distintas: reensayar es trabajo de
 * laboratorio, avisarle a un cliente no.
 */
export function resumenReensayos(items: ItemPorReensayar[]): {
  total: number;
  despachados: number;
} {
  return {
    total: items.length,
    despachados: items.filter((i) => i.destino === "DESPACHADO").length,
  };
}
