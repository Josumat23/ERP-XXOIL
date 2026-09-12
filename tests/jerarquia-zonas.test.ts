import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  creariaCicloZona,
  etiquetaRutaZona,
  idsSubarbolZona,
  nivelZona,
  ocupacionPorZona,
  ordenarArbolZonas,
} from "@/lib/jerarquiaZonas";

// Slotting multi-nivel: pasillo → rack → nivel → posición. `SaldoZona` resolvió
// la cantidad por zona; esto resuelve la jerarquía de ubicaciones.

// PASILLO-A ├ RACK-1 ├ N1
//           │        └ N2
//           └ RACK-2
// PASILLO-B
const ALMACEN = [
  { id: "pa", parentId: null, codigo: "PASILLO-A", nombre: "Pasillo A" },
  { id: "pb", parentId: null, codigo: "PASILLO-B", nombre: null },
  { id: "r1", parentId: "pa", codigo: "RACK-1", nombre: null },
  { id: "r2", parentId: "pa", codigo: "RACK-2", nombre: null },
  { id: "n1", parentId: "r1", codigo: "N1", nombre: "Nivel bajo" },
  { id: "n2", parentId: "r1", codigo: "N2", nombre: null },
];

test("el subárbol de una zona incluye todas sus descendientes", () => {
  assert.deepEqual(idsSubarbolZona("pa", ALMACEN).sort(), ["n1", "n2", "pa", "r1", "r2"]);
  assert.deepEqual(idsSubarbolZona("r1", ALMACEN).sort(), ["n1", "n2", "r1"]);
  assert.deepEqual(idsSubarbolZona("n1", ALMACEN), ["n1"]);
  assert.deepEqual(idsSubarbolZona("inexistente", ALMACEN), ["inexistente"]);
});

test("la jerarquía rechaza ciclos", () => {
  assert.equal(creariaCicloZona("pa", "pa", ALMACEN), true);
  assert.equal(creariaCicloZona("pa", "n2", ALMACEN), true); // colgar el pasillo de su nieto
  assert.equal(creariaCicloZona("pb", "n2", ALMACEN), false);
  assert.equal(creariaCicloZona("pa", null, ALMACEN), false);
});

test("la ruta y el nivel ubican la zona en el árbol", () => {
  assert.equal(etiquetaRutaZona("n2", ALMACEN), "PASILLO-A › RACK-1 › N2");
  assert.equal(etiquetaRutaZona("pa", ALMACEN), "PASILLO-A");
  assert.equal(etiquetaRutaZona("inexistente", ALMACEN), "");
  assert.equal(nivelZona("n2", ALMACEN), 2);
  assert.equal(nivelZona("pa", ALMACEN), 0);
});

test("datos con ciclo no cuelgan el recorrido", () => {
  const conCiclo = [
    { id: "a", parentId: "b", codigo: "A", nombre: null },
    { id: "b", parentId: "a", codigo: "B", nombre: null },
  ];
  assert.deepEqual(idsSubarbolZona("a", conCiclo).sort(), ["a", "b"]);
  assert.equal(etiquetaRutaZona("a", conCiclo), "B › A");
  // Y siguen apareciendo en pantalla: una zona invisible es peor que una mal
  // ordenada.
  assert.equal(ordenarArbolZonas(conCiclo).length, 2);
});

test("el árbol se ordena raíz por raíz, con los hermanos por código", () => {
  assert.deepEqual(
    ordenarArbolZonas(ALMACEN).map(({ zona, nivel }) => `${"·".repeat(nivel)}${zona.codigo}`),
    ["PASILLO-A", "·RACK-1", "··N1", "··N2", "·RACK-2", "PASILLO-B"]
  );
});

test("la ocupación distingue lo propio de lo del subárbol", () => {
  // Un pasillo con un ítem suelto en el piso y once repartidos en sus racks.
  const items = new Map([
    ["pa", 1],
    ["n1", 7],
    ["n2", 3],
    ["r2", 1],
  ]);
  const ocupacion = ocupacionPorZona(ALMACEN, items);

  assert.deepEqual(ocupacion.get("pa"), { propia: 1, subarbol: 12 });
  assert.deepEqual(ocupacion.get("r1"), { propia: 0, subarbol: 10 });
  assert.deepEqual(ocupacion.get("n1"), { propia: 7, subarbol: 7 });
  // Una zona vacía es 0 y no undefined: la pantalla la muestra igual.
  assert.deepEqual(ocupacion.get("pb"), { propia: 0, subarbol: 0 });
});

test("una zona puede colgar de otra del mismo almacén y el stock sigue donde está", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-zonas-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const almacen = await prisma.almacen.create({
      data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Planta", tipo: "PLANTA" },
    });
    const pasillo = await prisma.zonaAlmacen.create({
      data: { almacenId: almacen.id, codigo: "PASILLO-A" },
    });
    const rack = await prisma.zonaAlmacen.create({
      data: { almacenId: almacen.id, codigo: "RACK-1", parentId: pasillo.id },
    });
    const nivel = await prisma.zonaAlmacen.create({
      data: { almacenId: almacen.id, codigo: "N1", parentId: rack.id },
    });

    const zonas = await prisma.zonaAlmacen.findMany({
      where: { almacenId: almacen.id },
      select: { id: true, parentId: true, codigo: true, nombre: true },
    });
    assert.equal(etiquetaRutaZona(nivel.id, zonas), "PASILLO-A › RACK-1 › N1");

    // El código sigue siendo único por almacén sin importar el nivel: una
    // etiqueta debe identificar una sola ubicación.
    await assert.rejects(() =>
      prisma.zonaAlmacen.create({
        data: { almacenId: almacen.id, codigo: "N1", parentId: pasillo.id },
      })
    );

    // Desarmar un pasillo que todavía tiene racks debajo se rechaza: tiene que
    // ser un acto deliberado, no un efecto colateral.
    await assert.rejects(() => prisma.zonaAlmacen.delete({ where: { id: pasillo.id } }));

    // El stock sigue viviendo en la zona concreta: la jerarquía no lo mueve.
    const insumo = await prisma.insumo.create({
      data: {
        empresaId,
        codigo: `INS-${sufijo}`,
        nombre: "Aceite",
        unidadMedida: "L",
        tipo: "MATERIA_PRIMA",
      },
    });
    await prisma.saldoZona.create({
      data: {
        zonaAlmacenId: nivel.id,
        tipoItem: "INSUMO",
        itemId: insumo.id,
        insumoId: insumo.id,
        cantidad: 40,
      },
    });
    const saldo = await prisma.saldoZona.findFirst({ where: { zonaAlmacenId: nivel.id } });
    assert.equal(saldo?.cantidad.toNumber(), 40);
    assert.equal(await prisma.saldoZona.count({ where: { zonaAlmacenId: pasillo.id } }), 0);
  } finally {
    await prisma.saldoZona.deleteMany({ where: { zona: { almacen: { empresaId } } } });
    await prisma.insumo.deleteMany({ where: { empresaId } });
    // De la hoja hacia la raíz, porque el padre tiene onDelete: Restrict.
    // Se borra por capas: las que ya no tienen hijas, hasta que no quede
    // ninguna. Confiar en el orden de `findMany` no sirve.
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const borradas = await prisma.zonaAlmacen.deleteMany({
        where: { almacen: { empresaId }, subzonas: { none: {} } },
      });
      if (borradas.count === 0) break;
    }
    await prisma.almacen.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("la zona superior se valida contra el mismo almacén", async () => {
  // El id llega del navegador. Colgar un rack de un pasillo de otro almacén
  // dejaría una ubicación imposible de recorrer físicamente.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/almacenes/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /zonaAlmacen\.findFirst\(\{[\s\S]{0,120}almacenId: almacenPropio/);
  assert.match(acciones, /La zona superior no pertenece a ese almacén/);
});
