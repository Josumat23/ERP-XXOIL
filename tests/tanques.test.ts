import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cabeEnTanque,
  composicionTanque,
  contenidoTanque,
  DECIMALES_KG,
  repartirConsumo,
  type AporteTanque,
} from "@/lib/tanques";

// ---------------------------------------------------------------------------
// La base lubricante llega en cisterna y se descarga sobre el remanente de la
// recepción anterior. Desde ese momento los lotes están mezclados: ningún kilo
// que salga del tanque se puede atribuir a una sola recepción.
//
// SAP obliga a elegir un lote al consumir, así que su registro afirma «salió
// del lote A» cuando salió de una mezcla — una respuesta equivocada con aire de
// certeza, que el día de un reclamo manda a revisar el lote que no era.
//
// Acá el consumo se reparte en proporción. Lo que estas pruebas cuidan es que
// ese reparto **sume exacto**: cada kilo repartido descuenta de la
// disponibilidad de una recepción, así que un reparto que suma de menos deja
// stock fantasma y uno que suma de más sobregira un lote.
// ---------------------------------------------------------------------------

const suma = (r: { cantidadKg: number }[]) =>
  Math.round(r.reduce((t, x) => t + x.cantidadKg, 0) * 10 ** DECIMALES_KG) / 10 ** DECIMALES_KG;

test("el consumo se reparte en proporción a lo que hay en el tanque", () => {
  const aportes: AporteTanque[] = [
    { recepcionCompraDetalleId: "A", cantidadKg: 6000 },
    { recepcionCompraDetalleId: "B", cantidadKg: 4000 },
  ];
  const r = repartirConsumo(aportes, 1000);
  assert.ok(Array.isArray(r));
  assert.deepEqual(r, [
    { recepcionCompraDetalleId: "A", cantidadKg: 600 },
    { recepcionCompraDetalleId: "B", cantidadKg: 400 },
  ]);
});

test("el reparto suma exactamente lo pedido, aunque no dé redondo", () => {
  // Tres aportes desiguales y una cantidad que no divide: es el caso donde un
  // reparto ingenuo pierde o inventa kilos.
  const aportes: AporteTanque[] = [
    { recepcionCompraDetalleId: "A", cantidadKg: 1234.567 },
    { recepcionCompraDetalleId: "B", cantidadKg: 987.321 },
    { recepcionCompraDetalleId: "C", cantidadKg: 12.112 },
  ];
  for (const pedido of [1, 7.777, 100, 999.999, 1500, 2233.999]) {
    const r = repartirConsumo(aportes, pedido);
    assert.ok(Array.isArray(r), `falló con ${pedido}`);
    assert.equal(suma(r), pedido, `el reparto de ${pedido} no cierra`);
  }
});

test("vaciar el tanque entero reparte todo y no deja resto", () => {
  const aportes: AporteTanque[] = [
    { recepcionCompraDetalleId: "A", cantidadKg: 1234.567 },
    { recepcionCompraDetalleId: "B", cantidadKg: 987.321 },
  ];
  const total = contenidoTanque(aportes);
  const r = repartirConsumo(aportes, total);
  assert.ok(Array.isArray(r));
  assert.equal(suma(r), total);
  // Y ningún aporte queda repartiendo más de lo que tenía.
  for (const linea of r) {
    const aporte = aportes.find((a) => a.recepcionCompraDetalleId === linea.recepcionCompraDetalleId);
    assert.ok(linea.cantidadKg <= aporte!.cantidadKg + 1e-9, "un aporte se sobregiró");
  }
});

test("ningún aporte se sobregira por un redondeo hacia arriba", () => {
  // Un aporte diminuto junto a uno enorme es donde el redondeo proporcional
  // puede asignarle más de lo que tiene.
  const aportes: AporteTanque[] = [
    { recepcionCompraDetalleId: "GRANDE", cantidadKg: 9999.999 },
    { recepcionCompraDetalleId: "MINIMO", cantidadKg: 0.001 },
  ];
  const r = repartirConsumo(aportes, 10000);
  assert.ok(Array.isArray(r));
  assert.equal(suma(r), 10000);
  const minimo = r.find((x) => x.recepcionCompraDetalleId === "MINIMO");
  assert.ok(!minimo || minimo.cantidadKg <= 0.001);
});

test("un aporte que recibiría cero no genera asignación", () => {
  // Una asignación de 0 kg no dice nada y ensucia la trazabilidad.
  const aportes: AporteTanque[] = [
    { recepcionCompraDetalleId: "GRANDE", cantidadKg: 50000 },
    { recepcionCompraDetalleId: "MINIMO", cantidadKg: 0.002 },
  ];
  const r = repartirConsumo(aportes, 1);
  assert.ok(Array.isArray(r));
  assert.ok(
    r.every((x) => x.cantidadKg > 0),
    "quedó una asignación en cero"
  );
  assert.equal(suma(r), 1);
});

test("un tanque no se sobregira", () => {
  // Consumir más de lo que hay no es un redondeo: es producto que no existe.
  const aportes: AporteTanque[] = [{ recepcionCompraDetalleId: "A", cantidadKg: 100 }];
  assert.equal(repartirConsumo(aportes, 100.5), "CONTENIDO_INSUFICIENTE");
  // Pero medio gramo de más es ruido de balanza, no un sobregiro.
  assert.ok(Array.isArray(repartirConsumo(aportes, 100.0004)));
});

test("un tanque vacío se distingue de una cantidad inválida", () => {
  // Dos causas distintas piden dos mensajes distintos: «no hay de qué
  // consumir» manda a mirar el tanque, «la cantidad es inválida» al formulario.
  assert.equal(repartirConsumo([], 10), "TANQUE_VACIO");
  assert.equal(repartirConsumo([{ recepcionCompraDetalleId: "A", cantidadKg: 0 }], 10), "TANQUE_VACIO");
  assert.equal(repartirConsumo([{ recepcionCompraDetalleId: "A", cantidadKg: 10 }], 0), "CANTIDAD_INVALIDA");
  assert.equal(repartirConsumo([{ recepcionCompraDetalleId: "A", cantidadKg: 10 }], -5), "CANTIDAD_INVALIDA");
});

test("una descarga que no entra en el tanque se rechaza", () => {
  // Descargar de más no es un redondeo: es producto en el piso.
  assert.equal(cabeEnTanque({ contenidoActualKg: 8000, capacidadKg: 10000, descargaKg: 2000 }), true);
  assert.equal(
    cabeEnTanque({ contenidoActualKg: 8000, capacidadKg: 10000, descargaKg: 2000.001 }),
    "EXCEDE_CAPACIDAD"
  );
  assert.equal(cabeEnTanque({ contenidoActualKg: 0, capacidadKg: 10000, descargaKg: 0 }), "CANTIDAD_INVALIDA");
});

test("la composición dice cuánto aportó cada lote, no solo cuáles", () => {
  // Es lo que hace útil el modelo el día de un reclamo: con qué proporción
  // participó cada recepción.
  const c = composicionTanque([
    { recepcionCompraDetalleId: "A", cantidadKg: 3000 },
    { recepcionCompraDetalleId: "B", cantidadKg: 1000 },
    { recepcionCompraDetalleId: "VACIO", cantidadKg: 0 },
  ]);
  assert.deepEqual(c, [
    { recepcionCompraDetalleId: "A", cantidadKg: 3000, porcentaje: 75 },
    { recepcionCompraDetalleId: "B", cantidadKg: 1000, porcentaje: 25 },
  ]);
  // Un tanque vacío no tiene composición, y no divide por cero.
  assert.deepEqual(composicionTanque([]), []);
  assert.deepEqual(composicionTanque([{ recepcionCompraDetalleId: "A", cantidadKg: 0 }]), []);
});

test("mezclar y consumir conserva la masa a lo largo de varias operaciones", () => {
  // La prueba que de verdad importa: después de descargar, consumir, volver a
  // descargar y volver a consumir, lo que queda en el tanque tiene que ser
  // exactamente lo que entró menos lo que salió.
  let aportes: AporteTanque[] = [{ recepcionCompraDetalleId: "A", cantidadKg: 5000 }];
  let entrado = 5000;
  let salido = 0;

  const consumir = (kg: number) => {
    const r = repartirConsumo(aportes, kg);
    assert.ok(Array.isArray(r), `no se pudo consumir ${kg}`);
    salido += suma(r);
    aportes = aportes.map((a) => {
      const linea = r.find((x) => x.recepcionCompraDetalleId === a.recepcionCompraDetalleId);
      return { ...a, cantidadKg: Math.round((a.cantidadKg - (linea?.cantidadKg ?? 0)) * 1e3) / 1e3 };
    });
  };

  consumir(1333.333);
  aportes.push({ recepcionCompraDetalleId: "B", cantidadKg: 7777.777 });
  entrado += 7777.777;
  consumir(2500);
  consumir(999.999);
  aportes.push({ recepcionCompraDetalleId: "C", cantidadKg: 1.111 });
  entrado += 1.111;
  consumir(4321.5);

  const queda = contenidoTanque(aportes);
  assert.equal(
    queda,
    Math.round((entrado - salido) * 1e3) / 1e3,
    "la masa no se conserva después de mezclar y consumir"
  );
  assert.ok(aportes.every((a) => a.cantidadKg >= 0), "un aporte quedó en negativo");
});
