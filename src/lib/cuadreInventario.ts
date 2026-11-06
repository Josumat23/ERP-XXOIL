// ---------------------------------------------------------------------------
// Las cuatro invariantes del inventario, dichas como funciones.
//
// La cantidad de un ítem vive en tres niveles a la vez, y eso es deliberado:
//
//   Insumo.stock / Presentacion.stock   agregado de toda la compañía
//   SaldoAlmacen.cantidad               por almacén
//   SaldoZona.cantidad                  por zona dentro del almacén
//
// `src/lib/inventario.ts` los mantiene sincronizados en la misma transacción,
// con cerrojo optimista en cada nivel. Lo que no existía era la pregunta al
// revés: **¿siguen cuadrando?** Las pruebas verifican valores después de
// operaciones concretas, que no es lo mismo que comprobar el estado completo
// de la base un martes cualquiera.
//
// Tres de las cuatro invariantes tienen que valer exactamente. La cuarta es
// una desigualdad, y está documentada así en `docs/particion-stock-por-zona.md`:
//
//   saldoAlmacen = suma(saldoZona) + sinZona
//
// `sinZona` es derivado, no almacenado — lo que todavía no se repartió. Así que
// la suma de las zonas puede ser MENOR que el saldo del almacén; lo que no
// puede es ser mayor.
//
// Por qué funciones puras y sin Prisma: para poder sembrar un descuadre en una
// prueba y comprobar que se detecta. Un detector que nadie vio fallar no es un
// detector, es una decoración.
// ---------------------------------------------------------------------------

export type TipoItem = "INSUMO" | "PRESENTACION";

export type ItemConAgregado = {
  tipoItem: TipoItem;
  itemId: string;
  codigo: string;
  nombre: string;
  /** `Insumo.stock` o `Presentacion.stock`: el total de todos los almacenes. */
  stockAgregado: number;
};

export type SaldoDeAlmacen = {
  almacenId: string;
  tipoItem: TipoItem;
  itemId: string;
  cantidad: number;
};

export type SaldoDeZona = {
  almacenId: string;
  zonaAlmacenId: string;
  tipoItem: TipoItem;
  itemId: string;
  cantidad: number;
};

/** El movimiento de kardex más reciente de cada (almacén, ítem). */
export type UltimoMovimiento = {
  almacenId: string;
  tipoItem: TipoItem;
  itemId: string;
  /** Saldo del ALMACÉN después del movimiento, no el agregado de la compañía. */
  saldoNuevo: number;
};

export type Invariante =
  | "MAESTRO_VS_ALMACENES"
  | "KARDEX_VS_ALMACEN"
  | "ZONAS_SOBRE_ALMACEN"
  | "SALDO_DUPLICADO";

export type Descuadre = {
  invariante: Invariante;
  tipoItem: TipoItem;
  itemId: string;
  codigo: string;
  nombre: string;
  /** Presente solo en las invariantes que son por almacén. */
  almacenId?: string;
  esperado: number;
  encontrado: number;
  diferencia: number;
  detalle?: string;
};

/**
 * Tolerancia por defecto.
 *
 * Las cantidades son `Decimal` en la base y se comparan como `number`, así que
 * sumar muchas filas puede dejar basura en el último bit. No es holgura de
 * negocio: es el error de punto flotante de la propia suma. Un descuadre real
 * de inventario nunca mide 0.0000001.
 */
export const TOLERANCIA = 1e-6;

const clave = (tipoItem: TipoItem, itemId: string) => `${tipoItem}:${itemId}`;
const claveAlmacen = (almacenId: string, tipoItem: TipoItem, itemId: string) =>
  `${almacenId}:${tipoItem}:${itemId}`;

function sumarPorItem(saldos: SaldoDeAlmacen[]): Map<string, number> {
  const suma = new Map<string, number>();
  for (const saldo of saldos) {
    const k = clave(saldo.tipoItem, saldo.itemId);
    suma.set(k, (suma.get(k) ?? 0) + saldo.cantidad);
  }
  return suma;
}

/**
 * Invariante 1 — el agregado del maestro es la suma de sus almacenes.
 *
 * Un ítem sin ninguna fila de saldo cuenta como cero, no se omite: el caso que
 * importa es justamente el maestro que dice 40 cuando no hay saldo en ningún
 * almacén.
 */
export function cuadrarMaestroContraAlmacenes(
  items: ItemConAgregado[],
  saldos: SaldoDeAlmacen[],
  tolerancia = TOLERANCIA
): Descuadre[] {
  const suma = sumarPorItem(saldos);
  const descuadres: Descuadre[] = [];
  for (const item of items) {
    const encontrado = suma.get(clave(item.tipoItem, item.itemId)) ?? 0;
    const diferencia = item.stockAgregado - encontrado;
    if (Math.abs(diferencia) <= tolerancia) continue;
    descuadres.push({
      invariante: "MAESTRO_VS_ALMACENES",
      tipoItem: item.tipoItem,
      itemId: item.itemId,
      codigo: item.codigo,
      nombre: item.nombre,
      esperado: item.stockAgregado,
      encontrado,
      diferencia,
    });
  }
  return descuadres;
}

/**
 * Invariante 2 — el último movimiento del kardex dejó el saldo que hoy tiene el
 * almacén.
 *
 * `registrarMovimiento` escribe `saldoNuevo` y actualiza `SaldoAlmacen` a ese
 * mismo valor en la misma transacción. Si divergen, alguien movió el saldo sin
 * pasar por el kardex — y entonces la valorización, que se apoya en el costo
 * congelado del movimiento, está valuando una cantidad que ya no existe.
 *
 * Un almacén con saldo y sin ningún movimiento también es un descuadre: el
 * saldo no pudo haber nacido sin kardex.
 */
export function cuadrarKardexContraAlmacen(
  ultimos: UltimoMovimiento[],
  saldos: SaldoDeAlmacen[],
  items: ItemConAgregado[],
  tolerancia = TOLERANCIA
): Descuadre[] {
  const porItem = new Map(items.map((item) => [clave(item.tipoItem, item.itemId), item]));
  const ultimoPorAlmacen = new Map(
    ultimos.map((m) => [claveAlmacen(m.almacenId, m.tipoItem, m.itemId), m.saldoNuevo])
  );
  const descuadres: Descuadre[] = [];
  for (const saldo of saldos) {
    const k = claveAlmacen(saldo.almacenId, saldo.tipoItem, saldo.itemId);
    const item = porItem.get(clave(saldo.tipoItem, saldo.itemId));
    const tieneMovimiento = ultimoPorAlmacen.has(k);
    const saldoDelKardex = ultimoPorAlmacen.get(k) ?? 0;
    const diferencia = saldoDelKardex - saldo.cantidad;
    if (tieneMovimiento && Math.abs(diferencia) <= tolerancia) continue;
    // Un saldo en cero y sin movimientos es una fila vacía, no un descuadre:
    // la deja cualquier salida que consumió todo lo que había.
    if (!tieneMovimiento && Math.abs(saldo.cantidad) <= tolerancia) continue;
    descuadres.push({
      invariante: "KARDEX_VS_ALMACEN",
      tipoItem: saldo.tipoItem,
      itemId: saldo.itemId,
      codigo: item?.codigo ?? saldo.itemId,
      nombre: item?.nombre ?? "(ítem fuera del alcance consultado)",
      almacenId: saldo.almacenId,
      esperado: saldoDelKardex,
      encontrado: saldo.cantidad,
      diferencia,
      detalle: tieneMovimiento ? undefined : "el almacén tiene saldo y ningún movimiento de kardex",
    });
  }
  return descuadres;
}

/**
 * Invariante 3 — lo repartido en zonas no puede superar lo que hay en el
 * almacén.
 *
 * Desigualdad, no igualdad: `sinZona` es derivado y la partición es opcional.
 * Lo que se detecta es la suma de zonas por ENCIMA del saldo, que significa
 * stock contado dos veces.
 */
export function cuadrarZonasContraAlmacen(
  zonas: SaldoDeZona[],
  saldos: SaldoDeAlmacen[],
  items: ItemConAgregado[],
  tolerancia = TOLERANCIA
): Descuadre[] {
  const porItem = new Map(items.map((item) => [clave(item.tipoItem, item.itemId), item]));
  const saldoPorAlmacen = new Map(
    saldos.map((s) => [claveAlmacen(s.almacenId, s.tipoItem, s.itemId), s.cantidad])
  );
  const sumaZonas = new Map<string, number>();
  for (const zona of zonas) {
    const k = claveAlmacen(zona.almacenId, zona.tipoItem, zona.itemId);
    sumaZonas.set(k, (sumaZonas.get(k) ?? 0) + zona.cantidad);
  }
  const descuadres: Descuadre[] = [];
  for (const [k, repartido] of sumaZonas) {
    const [almacenId, tipoItem, itemId] = k.split(":") as [string, TipoItem, string];
    const enAlmacen = saldoPorAlmacen.get(k) ?? 0;
    const exceso = repartido - enAlmacen;
    if (exceso <= tolerancia) continue;
    const item = porItem.get(clave(tipoItem, itemId));
    descuadres.push({
      invariante: "ZONAS_SOBRE_ALMACEN",
      tipoItem,
      itemId,
      codigo: item?.codigo ?? itemId,
      nombre: item?.nombre ?? "(ítem fuera del alcance consultado)",
      almacenId,
      esperado: enAlmacen,
      encontrado: repartido,
      diferencia: exceso,
      detalle: "lo repartido en zonas supera el saldo del almacén",
    });
  }
  return descuadres;
}

/**
 * Invariante 4 — una sola fila de saldo por (almacén, ítem).
 *
 * `SaldoAlmacen` lleva `@@unique([almacenId, tipoItem, presentacionId, insumoId])`
 * con dos columnas nuleables, y tanto SQLite como PostgreSQL consideran dos
 * NULL distintos: la clave NO impide la fila duplicada. Hoy lo evita un cerrojo
 * en la aplicación, que es exactamente la clase de garantía que conviene
 * comprobar en los datos en vez de confiarle. `SaldoZona` no tiene el problema
 * porque lleva `itemId` no nuleable.
 *
 * Con una fila duplicada la cantidad del almacén se cuenta dos veces, así que
 * esto además explica descuadres de la invariante 1.
 */
export function detectarSaldosDuplicados(
  saldos: SaldoDeAlmacen[],
  items: ItemConAgregado[]
): Descuadre[] {
  const porItem = new Map(items.map((item) => [clave(item.tipoItem, item.itemId), item]));
  const cuenta = new Map<string, SaldoDeAlmacen[]>();
  for (const saldo of saldos) {
    const k = claveAlmacen(saldo.almacenId, saldo.tipoItem, saldo.itemId);
    const lista = cuenta.get(k);
    if (lista) lista.push(saldo);
    else cuenta.set(k, [saldo]);
  }
  const descuadres: Descuadre[] = [];
  for (const [k, lista] of cuenta) {
    if (lista.length < 2) continue;
    const [almacenId, tipoItem, itemId] = k.split(":") as [string, TipoItem, string];
    const item = porItem.get(clave(tipoItem, itemId));
    descuadres.push({
      invariante: "SALDO_DUPLICADO",
      tipoItem,
      itemId,
      codigo: item?.codigo ?? itemId,
      nombre: item?.nombre ?? "(ítem fuera del alcance consultado)",
      almacenId,
      esperado: 1,
      encontrado: lista.length,
      diferencia: lista.length - 1,
      detalle: `${lista.length} filas de SaldoAlmacen para el mismo almacén e ítem`,
    });
  }
  return descuadres;
}

export type EntradaCuadre = {
  items: ItemConAgregado[];
  saldos: SaldoDeAlmacen[];
  zonas: SaldoDeZona[];
  ultimos: UltimoMovimiento[];
  tolerancia?: number;
};

/** Las cuatro invariantes de una vez, en orden de causa antes que efecto. */
export function cuadrarInventario(entrada: EntradaCuadre): Descuadre[] {
  const tolerancia = entrada.tolerancia ?? TOLERANCIA;
  return [
    // Los duplicados primero: explican descuadres de las otras invariantes, y
    // leer la causa antes que el síntoma ahorra el viaje en falso.
    ...detectarSaldosDuplicados(entrada.saldos, entrada.items),
    ...cuadrarMaestroContraAlmacenes(entrada.items, entrada.saldos, tolerancia),
    ...cuadrarKardexContraAlmacen(entrada.ultimos, entrada.saldos, entrada.items, tolerancia),
    ...cuadrarZonasContraAlmacen(entrada.zonas, entrada.saldos, entrada.items, tolerancia),
  ];
}

// ---------------------------------------------------------------------------
// El cuadre de VALOR es otra cosa, y conviene no mezclarlo.
//
// Las cuatro invariantes de arriba tienen que valer: un descuadre es un defecto.
// El valor contra la cuenta contable NO, y decir lo contrario sería vender una
// comprobación que siempre va a estar en rojo. Dos razones documentadas:
//
//   1. `postearAsiento()` es best-effort a propósito (ver
//      `docs/incidencias-contables.md`): si falta el control contable o el
//      período está cerrado, la operación sigue y el fallo queda registrado en
//      `IncidenciaContable`. El auxiliar puede adelantarse al mayor por diseño.
//   2. Los movimientos anteriores a la implantación del costo congelado valen
//      cero en la valorización (`docs/valorizacion-inventario.md`), y no se les
//      aplica el costo actual porque eso falsearía un cierre pasado.
//
// Así que esto no devuelve un veredicto: devuelve la diferencia y, al lado, las
// causas CANDIDATAS.
//
// Candidatas, no explicaciones, y la distinción no es cosmética: la primera
// versión de esto marcaba la diferencia como «ya explicada» en cuanto hubiera
// un solo ítem sin costo congelado. Corrida contra la base de trabajo informó
// 32,486 de diferencia con «causa conocida: 1 ítem sin costo» — y un ítem no
// explica treinta y dos mil. Un detector que invita a descartar lo que acaba de
// encontrar es peor que no tenerlo. Ahora lista las candidatas y deja el juicio
// a quien lee, que es quien puede valuar el ítem que falta.
// ---------------------------------------------------------------------------

export type GrupoDeValor = {
  /** Clave de `ControlContable`: INVENTARIO_INSUMOS o INVENTARIO_PT. */
  claveControl: string;
  cuentaCodigo: string;
  /** Suma de saldo × costo congelado, de `construirValorizacionInventario`. */
  valorInventario: number;
  /** `debe - haber` de la cuenta, acumulado. */
  saldoCuenta: number;
  /** Ítems con saldo y sin costo congelado: valen 0 en la valorización. */
  itemsSinCosto: number;
  /** Incidencias de posteo registradas para la compañía. */
  incidencias: number;
};

export type ComparacionValor = GrupoDeValor & {
  diferencia: number;
  /**
   * Causas documentadas que PODRÍAN aportar a la diferencia, en texto legible.
   * No afirman cuánto aportan: eso solo lo sabe quien pueda valuar lo que falta.
   */
  causasCandidatas: string[];
  /**
   * La cuenta de inventario es de activo: un saldo negativo no se explica por
   * un desfase de posteo, significa que se acreditó más de lo que se cargó.
   */
  signoInesperado: boolean;
};

export function compararValorContraCuenta(
  grupos: GrupoDeValor[],
  tolerancia = 0.05
): ComparacionValor[] {
  return grupos.map((grupo) => {
    const bruta = grupo.valorInventario - grupo.saldoCuenta;
    const diferencia = Math.abs(bruta) <= tolerancia ? 0 : bruta;
    const causasCandidatas: string[] = [];
    if (diferencia !== 0 && grupo.itemsSinCosto > 0) {
      causasCandidatas.push(
        `${grupo.itemsSinCosto} ítem(s) con saldo y sin costo congelado: valen 0 en la valorización`
      );
    }
    if (diferencia !== 0 && grupo.incidencias > 0) {
      causasCandidatas.push(
        `${grupo.incidencias} incidencia(s) de posteo: operaciones que no llegaron al mayor`
      );
    }
    return { ...grupo, diferencia, causasCandidatas, signoInesperado: grupo.saldoCuenta < 0 };
  });
}
