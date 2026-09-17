import { respaldoDeMedicion, type Calibracion, type RespaldoMedicion } from "./calibracion";

// ---------------------------------------------------------------------------
// Qué hay que reensayar.
//
// El sistema ya sabía, instrumento por instrumento, qué lotes había medido y
// con qué respaldo. Faltaba la pregunta al revés, que es la que se hace el día
// que una calibración vuelve fuera de tolerancia: «¿qué tengo que reensayar,
// de todo el laboratorio, y por dónde empiezo?».
//
// Ir instrumento por instrumento no sirve ese día: hay que revisarlos todos
// para descubrir cuáles tienen trabajo pendiente, y el que se olvida es el que
// importaba.
//
// La decisión de fondo del ciclo es el ORDEN. Una lista de lotes sin orden
// obliga a leerla entera para saber qué urge, y con volumen real nadie la lee
// entera. Lo que manda no es la gravedad del problema de medición sino dónde
// está el producto: un lote que el cliente ya tiene no se reensaya y listo
// —hay que decidir qué se le dice—, mientras que uno en almacén se reensaya y
// se acabó.
// ---------------------------------------------------------------------------

/**
 * Una medición tal como llega del cruce ensayo × instrumento.
 *
 * Los datos del lote se repiten en cada fila a propósito: así llega un join y
 * así se puede probar sin montar un grafo de objetos.
 */
export type MedicionParaRevisar = {
  loteId: string;
  loteCodigo: string;
  productoNombre: string;
  loteAprobado: boolean;
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

export type LotePorReensayar = {
  loteId: string;
  loteCodigo: string;
  productoNombre: string;
  loteAprobado: boolean;
  unidadesDespachadas: number;
  clientesAfectados: number;
  fechaEnsayo: Date;
  mediciones: MedicionEnCuestion[];
  peorRespaldo: RespaldoMedicion;
  destino: DestinoDelLote;
};

/**
 * Dónde está el producto hoy. Es lo que decide qué se hace con él, y por eso
 * es lo que ordena la lista.
 */
export type DestinoDelLote = "DESPACHADO" | "EN_ALMACEN" | "SIN_SALIDA";

export const MENSAJE_DESTINO: Record<DestinoDelLote, string> = {
  DESPACHADO: "Ya está en poder del cliente",
  EN_ALMACEN: "Aprobado, todavía sin despachar",
  SIN_SALIDA: "Nunca salió",
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

const URGENCIA_DESTINO: Record<DestinoDelLote, number> = {
  SIN_SALIDA: 0,
  EN_ALMACEN: 1,
  DESPACHADO: 2,
};

export function destinoDelLote(lote: {
  unidadesDespachadas: number;
  loteAprobado: boolean;
}): DestinoDelLote {
  if (lote.unidadesDespachadas > 0) return "DESPACHADO";
  return lote.loteAprobado ? "EN_ALMACEN" : "SIN_SALIDA";
}

/**
 * Los lotes con al menos una medición que no se puede dar por respaldada,
 * agrupados y ordenados por lo que urge.
 *
 * Solo entran mediciones que declaran con qué instrumento se tomaron: sin eso
 * no hay historial contra el cual derivar nada. Las que no lo declaran son un
 * problema distinto —no se sabe qué se usó— y se cuentan aparte en vez de
 * mezclarse acá, donde parecerían resueltas.
 */
export function lotesPorReensayar(mediciones: MedicionParaRevisar[]): LotePorReensayar[] {
  const porLote = new Map<string, LotePorReensayar>();

  for (const m of mediciones) {
    const respaldo = respaldoDeMedicion(m.calibraciones, m.fechaEnsayo);
    if (respaldo === "CALIBRADO") continue;

    const existente = porLote.get(m.loteId);
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
    porLote.set(m.loteId, {
      loteId: m.loteId,
      loteCodigo: m.loteCodigo,
      productoNombre: m.productoNombre,
      loteAprobado: m.loteAprobado,
      unidadesDespachadas: m.unidadesDespachadas,
      clientesAfectados: m.clientesAfectados,
      fechaEnsayo: m.fechaEnsayo,
      mediciones: [enCuestion],
      peorRespaldo: respaldo,
      destino: destinoDelLote(m),
    });
  }

  return [...porLote.values()].sort(
    (a, b) =>
      URGENCIA_DESTINO[b.destino] - URGENCIA_DESTINO[a.destino] ||
      GRAVEDAD_RESPALDO[b.peorRespaldo] - GRAVEDAD_RESPALDO[a.peorRespaldo] ||
      b.fechaEnsayo.getTime() - a.fechaEnsayo.getTime() ||
      a.loteCodigo.localeCompare(b.loteCodigo)
  );
}

/**
 * Para el semáforo del panel: cuántos lotes hay que revisar y cuántos de ellos
 * ya están afuera.
 *
 * Se separan porque son dos conversaciones distintas: reensayar es trabajo de
 * laboratorio, avisarle a un cliente no.
 */
export function resumenReensayos(lotes: LotePorReensayar[]): {
  total: number;
  despachados: number;
} {
  return {
    total: lotes.length,
    despachados: lotes.filter((l) => l.destino === "DESPACHADO").length,
  };
}
