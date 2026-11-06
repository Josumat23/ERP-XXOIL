import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOLERANCIA,
  compararValorContraCuenta,
  cuadrarInventario,
  cuadrarKardexContraAlmacen,
  cuadrarMaestroContraAlmacenes,
  cuadrarZonasContraAlmacen,
  detectarSaldosDuplicados,
  type ItemConAgregado,
  type SaldoDeAlmacen,
  type SaldoDeZona,
  type UltimoMovimiento,
} from "@/lib/cuadreInventario";

// ---------------------------------------------------------------------------
// El detector tiene que detectar.
//
// La mitad fácil de una comprobación de consistencia es que pase en verde
// cuando todo está bien. La que importa es la otra: que se ponga en rojo con un
// descuadre sembrado a mano, uno por invariante. Sin eso, `npm run
// cuadre:inventario` diciendo «todo cuadra» no significa nada —  podría estar
// comparando un mapa vacío contra otro.
//
// Son funciones puras, así que acá no hace falta base: el descuadre se siembra
// en los datos de entrada.
// ---------------------------------------------------------------------------

const ACEITE: ItemConAgregado = {
  tipoItem: "INSUMO",
  itemId: "i-aceite",
  codigo: "MP-001",
  nombre: "Aceite base SN-500",
  stockAgregado: 100,
};

const BALDE: ItemConAgregado = {
  tipoItem: "PRESENTACION",
  itemId: "p-balde",
  codigo: "PT-BALDE-20L",
  nombre: "Grasa EP-2 balde 20L",
  stockAgregado: 30,
};

/** Un estado consistente: 100 de aceite en dos almacenes, 30 de balde en uno. */
function estadoCuadrado() {
  const items: ItemConAgregado[] = [ACEITE, BALDE];
  const saldos: SaldoDeAlmacen[] = [
    { almacenId: "alm-lima", tipoItem: "INSUMO", itemId: "i-aceite", cantidad: 70 },
    { almacenId: "alm-areq", tipoItem: "INSUMO", itemId: "i-aceite", cantidad: 30 },
    { almacenId: "alm-lima", tipoItem: "PRESENTACION", itemId: "p-balde", cantidad: 30 },
  ];
  const ultimos: UltimoMovimiento[] = [
    { almacenId: "alm-lima", tipoItem: "INSUMO", itemId: "i-aceite", saldoNuevo: 70 },
    { almacenId: "alm-areq", tipoItem: "INSUMO", itemId: "i-aceite", saldoNuevo: 30 },
    { almacenId: "alm-lima", tipoItem: "PRESENTACION", itemId: "p-balde", saldoNuevo: 30 },
  ];
  // Partición parcial a propósito: 50 de los 70 repartidos, 20 sin zona.
  const zonas: SaldoDeZona[] = [
    {
      almacenId: "alm-lima",
      zonaAlmacenId: "z-rack-a",
      tipoItem: "INSUMO",
      itemId: "i-aceite",
      cantidad: 50,
    },
  ];
  return { items, saldos, ultimos, zonas };
}

test("un estado consistente no reporta nada", () => {
  assert.deepEqual(cuadrarInventario(estadoCuadrado()), []);
});

test("detecta el maestro adelantado respecto a la suma de sus almacenes", () => {
  const estado = estadoCuadrado();
  // El maestro dice 100 y los almacenes suman 95: la salida de 5 bajó el saldo
  // del almacén y no el agregado.
  estado.saldos[1].cantidad = 25;
  estado.ultimos[1].saldoNuevo = 25;

  const descuadres = cuadrarMaestroContraAlmacenes(estado.items, estado.saldos);
  assert.equal(descuadres.length, 1);
  assert.equal(descuadres[0].invariante, "MAESTRO_VS_ALMACENES");
  assert.equal(descuadres[0].codigo, "MP-001");
  assert.equal(descuadres[0].esperado, 100);
  assert.equal(descuadres[0].encontrado, 95);
  assert.equal(descuadres[0].diferencia, 5);
});

test("un maestro con stock y sin ninguna fila de saldo cuenta como cero, no se omite", () => {
  const descuadres = cuadrarMaestroContraAlmacenes([ACEITE], []);
  assert.equal(descuadres.length, 1);
  assert.equal(descuadres[0].encontrado, 0);
  assert.equal(descuadres[0].diferencia, 100);
});

test("detecta el saldo del almacén que no coincide con el último movimiento del kardex", () => {
  const estado = estadoCuadrado();
  // Alguien movió el saldo sin pasar por el kardex.
  estado.saldos[0].cantidad = 60;

  const descuadres = cuadrarKardexContraAlmacen(estado.ultimos, estado.saldos, estado.items);
  assert.equal(descuadres.length, 1);
  assert.equal(descuadres[0].invariante, "KARDEX_VS_ALMACEN");
  assert.equal(descuadres[0].almacenId, "alm-lima");
  assert.equal(descuadres[0].esperado, 70);
  assert.equal(descuadres[0].encontrado, 60);
});

test("detecta el almacén con saldo y sin un solo movimiento de kardex", () => {
  const estado = estadoCuadrado();
  const descuadres = cuadrarKardexContraAlmacen([], estado.saldos, estado.items);
  assert.equal(descuadres.length, 3);
  for (const descuadre of descuadres) {
    assert.equal(descuadre.invariante, "KARDEX_VS_ALMACEN");
    assert.match(descuadre.detalle ?? "", /ningún movimiento de kardex/);
  }
});

test("un saldo en cero y sin movimientos es una fila vacía, no un descuadre", () => {
  const saldos: SaldoDeAlmacen[] = [
    { almacenId: "alm-lima", tipoItem: "INSUMO", itemId: "i-aceite", cantidad: 0 },
  ];
  assert.deepEqual(cuadrarKardexContraAlmacen([], saldos, [{ ...ACEITE, stockAgregado: 0 }]), []);
});

test("las zonas sumando MENOS que el almacén no son descuadre: el resto es sinZona", () => {
  const estado = estadoCuadrado();
  assert.deepEqual(cuadrarZonasContraAlmacen(estado.zonas, estado.saldos, estado.items), []);
});

test("detecta las zonas sumando MÁS que el saldo del almacén", () => {
  const estado = estadoCuadrado();
  estado.zonas.push({
    almacenId: "alm-lima",
    zonaAlmacenId: "z-rack-b",
    tipoItem: "INSUMO",
    itemId: "i-aceite",
    cantidad: 40, // 50 + 40 = 90 repartidos sobre un saldo de 70
  });

  const descuadres = cuadrarZonasContraAlmacen(estado.zonas, estado.saldos, estado.items);
  assert.equal(descuadres.length, 1);
  assert.equal(descuadres[0].invariante, "ZONAS_SOBRE_ALMACEN");
  assert.equal(descuadres[0].esperado, 70);
  assert.equal(descuadres[0].encontrado, 90);
  assert.equal(descuadres[0].diferencia, 20);
});

test("detecta la fila de SaldoAlmacen duplicada que la clave única no impide", () => {
  const estado = estadoCuadrado();
  // La clave de SaldoAlmacen tiene dos columnas nuleables, y dos NULL se
  // consideran distintos: la base acepta esta fila.
  estado.saldos.push({
    almacenId: "alm-lima",
    tipoItem: "INSUMO",
    itemId: "i-aceite",
    cantidad: 70,
  });

  const duplicados = detectarSaldosDuplicados(estado.saldos, estado.items);
  assert.equal(duplicados.length, 1);
  assert.equal(duplicados[0].invariante, "SALDO_DUPLICADO");
  assert.equal(duplicados[0].almacenId, "alm-lima");
  assert.equal(duplicados[0].encontrado, 2);
});

test("el duplicado se reporta ANTES del descuadre que provoca", () => {
  const estado = estadoCuadrado();
  estado.saldos.push({
    almacenId: "alm-lima",
    tipoItem: "INSUMO",
    itemId: "i-aceite",
    cantidad: 70,
  });

  const descuadres = cuadrarInventario(estado);
  // El duplicado hace que el aceite sume 170 contra un maestro de 100: dos
  // hallazgos, y el primero es la causa.
  assert.equal(descuadres[0].invariante, "SALDO_DUPLICADO");
  assert.ok(descuadres.some((d) => d.invariante === "MAESTRO_VS_ALMACENES"));
});

test("la tolerancia absorbe el error de punto flotante y no un descuadre real", () => {
  const casi: ItemConAgregado = { ...ACEITE, stockAgregado: 0.1 + 0.2 }; // 0.30000000000000004
  const saldos: SaldoDeAlmacen[] = [
    { almacenId: "alm-lima", tipoItem: "INSUMO", itemId: "i-aceite", cantidad: 0.3 },
  ];
  assert.deepEqual(cuadrarMaestroContraAlmacenes([casi], saldos), []);

  // Un gramo de diferencia sí se reporta: la tolerancia no es holgura de negocio.
  const unGramo: ItemConAgregado = { ...ACEITE, stockAgregado: 0.301 };
  assert.equal(cuadrarMaestroContraAlmacenes([unGramo], saldos).length, 1);
  assert.ok(TOLERANCIA < 0.001);
});

test("el valor contra la cuenta informa la diferencia y lista causas CANDIDATAS", () => {
  const [limpio, conCausas] = compararValorContraCuenta([
    {
      claveControl: "INVENTARIO_INSUMOS",
      cuentaCodigo: "2411",
      valorInventario: 1000.02,
      saldoCuenta: 1000,
      itemsSinCosto: 0,
      incidencias: 0,
    },
    {
      claveControl: "INVENTARIO_PT",
      cuentaCodigo: "2111",
      valorInventario: 5000,
      saldoCuenta: 4200,
      itemsSinCosto: 3,
      incidencias: 1,
    },
  ]);

  // Dos céntimos entran en la tolerancia de redondeo contable.
  assert.equal(limpio.diferencia, 0);
  assert.deepEqual(limpio.causasCandidatas, []);

  assert.equal(conCausas.diferencia, 800);
  assert.equal(conCausas.causasCandidatas.length, 2);
  assert.match(conCausas.causasCandidatas[0], /sin costo congelado/);
  assert.match(conCausas.causasCandidatas[1], /incidencia/);
});

test("una causa candidata no se presenta como explicación de la diferencia", () => {
  // El caso real que obligó a cambiar esto: un solo ítem sin costo congelado
  // junto a una diferencia de treinta y dos mil. La candidata existe; explicar
  // la diferencia, no.
  const [c] = compararValorContraCuenta([
    {
      claveControl: "INVENTARIO_INSUMOS",
      cuentaCodigo: "2411",
      valorInventario: 37969.8,
      saldoCuenta: 5483.45,
      itemsSinCosto: 1,
      incidencias: 0,
    },
  ]);

  assert.ok(c.diferencia > 32000);
  assert.equal(c.causasCandidatas.length, 1);
  // Lo que importa: el tipo no ofrece ningún campo que diga «ya explicado».
  assert.equal("tieneCausaConocida" in c, false);
});

test("el saldo negativo de una cuenta de inventario se marca aparte", () => {
  const [negativa, normal] = compararValorContraCuenta([
    {
      claveControl: "INVENTARIO_PT",
      cuentaCodigo: "2111",
      valorInventario: 1892.86,
      saldoCuenta: -854.69,
      itemsSinCosto: 1,
      incidencias: 0,
    },
    {
      claveControl: "INVENTARIO_INSUMOS",
      cuentaCodigo: "2411",
      valorInventario: 100,
      saldoCuenta: 100,
      itemsSinCosto: 0,
      incidencias: 0,
    },
  ]);

  assert.equal(negativa.signoInesperado, true);
  assert.equal(normal.signoInesperado, false);
});
