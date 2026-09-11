import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import {
  creariaCicloUbicacion,
  etiquetaRutaUbicacion,
  idsSubarbolUbicacion,
  nivelUbicacion,
  ordenarArbolUbicaciones,
  rutaUbicacion,
} from "@/lib/ubicacionesTecnicas";

// planta → línea → estación, más una segunda línea hermana.
const ARBOL = [
  { id: "planta", parentId: null, codigo: "PLANTA-1", nombre: "Planta Lurín" },
  { id: "lineaA", parentId: "planta", codigo: "LINEA-A", nombre: "Línea de grasas" },
  { id: "lineaB", parentId: "planta", codigo: "LINEA-B", nombre: "Línea de lubricantes" },
  { id: "envasadora", parentId: "lineaA", codigo: "ENV-02", nombre: "Envasadora 2" },
];

test("el subárbol de una ubicación incluye todos sus descendientes", () => {
  assert.deepEqual(idsSubarbolUbicacion("planta", ARBOL).sort(), [
    "envasadora",
    "lineaA",
    "lineaB",
    "planta",
  ]);
  assert.deepEqual(idsSubarbolUbicacion("lineaA", ARBOL).sort(), ["envasadora", "lineaA"]);
  assert.deepEqual(idsSubarbolUbicacion("envasadora", ARBOL), ["envasadora"]);
  assert.deepEqual(idsSubarbolUbicacion("inexistente", ARBOL), ["inexistente"]);
});

test("la jerarquía rechaza ciclos al reubicar", () => {
  // Colgar la planta de su propia envasadora cerraría el ciclo.
  assert.equal(creariaCicloUbicacion("planta", "envasadora", ARBOL), true);
  assert.equal(creariaCicloUbicacion("planta", "planta", ARBOL), true);
  assert.equal(creariaCicloUbicacion("lineaA", "lineaB", ARBOL), false);
  assert.equal(creariaCicloUbicacion("envasadora", null, ARBOL), false);
});

test("la ruta y el nivel describen la posición en la jerarquía", () => {
  assert.deepEqual(
    rutaUbicacion("envasadora", ARBOL).map((u) => u.id),
    ["planta", "lineaA", "envasadora"]
  );
  assert.equal(etiquetaRutaUbicacion("envasadora", ARBOL), "PLANTA-1 › LINEA-A › ENV-02");
  assert.equal(nivelUbicacion("planta", ARBOL), 0);
  assert.equal(nivelUbicacion("lineaA", ARBOL), 1);
  assert.equal(nivelUbicacion("envasadora", ARBOL), 2);
  assert.deepEqual(rutaUbicacion("inexistente", ARBOL), []);
});

test("datos con ciclo no cuelgan el recorrido de la jerarquía", () => {
  // Defensa: la acción bloquea los ciclos, pero una fila corrupta no debe
  // dejar la pantalla colgada en un bucle infinito.
  const corrupto = [
    { id: "a", parentId: "b", codigo: "A", nombre: "A" },
    { id: "b", parentId: "a", codigo: "B", nombre: "B" },
  ];
  assert.deepEqual(idsSubarbolUbicacion("a", corrupto).sort(), ["a", "b"]);
  assert.deepEqual(
    rutaUbicacion("a", corrupto).map((u) => u.id),
    ["b", "a"]
  );
  assert.equal(ordenarArbolUbicaciones(corrupto).length, 2);
});

test("el árbol se ordena raíz por raíz, con los hermanos por código", () => {
  const orden = ordenarArbolUbicaciones(ARBOL);
  assert.deepEqual(
    orden.map((n) => [n.ubicacion.id, n.nivel]),
    [
      ["planta", 0],
      ["lineaA", 1],
      ["envasadora", 2],
      ["lineaB", 1],
    ]
  );

  // Un nodo cuyo padre no está en el listado no puede desaparecer de la pantalla.
  const huerfano = [...ARBOL, { id: "suelto", parentId: "otro", codigo: "X", nombre: "Suelto" }];
  assert.ok(ordenarArbolUbicaciones(huerfano).some((n) => n.ubicacion.id === "suelto"));
});

test("las ubicaciones técnicas quedan acotadas a la compañía y aceptan varios niveles", async () => {
  const sufijo = Date.now().toString(36);
  const empresas = [`empresa-ubicacion-a-${sufijo}`, `empresa-ubicacion-b-${sufijo}`];
  const [empresaA, empresaB] = empresas;
  await prisma.empresa.createMany({ data: empresas.map((id) => ({ id, razonSocial: id })) });

  try {
    const plantaAlmacen = await prisma.almacen.create({
      data: { empresaId: empresaA, tipo: "PLANTA", codigo: "PL1", nombre: "Planta A" },
    });
    const raiz = await prisma.ubicacionTecnica.create({
      data: { empresaId: empresaA, codigo: "PLANTA-1", nombre: "Planta", almacenId: plantaAlmacen.id },
    });
    const linea = await prisma.ubicacionTecnica.create({
      data: { empresaId: empresaA, codigo: "LINEA-A", nombre: "Línea A", parentId: raiz.id },
    });
    const estacion = await prisma.ubicacionTecnica.create({
      data: { empresaId: empresaA, codigo: "ENV-02", nombre: "Envasadora", parentId: linea.id },
    });

    // El mismo código convive en otra compañía: el único índice es (empresaId, codigo).
    await prisma.ubicacionTecnica.create({
      data: { empresaId: empresaB, codigo: "PLANTA-1", nombre: "Planta B" },
    });

    const deA = await prisma.ubicacionTecnica.findMany({
      where: { empresaId: empresaA },
      select: { id: true, parentId: true, codigo: true, nombre: true },
    });
    assert.equal(deA.length, 3);
    assert.equal(etiquetaRutaUbicacion(estacion.id, deA), "PLANTA-1 › LINEA-A › ENV-02");
    assert.equal(nivelUbicacion(estacion.id, deA), 2);

    // Un equipo se instala en una ubicación y puede moverse sin perder su historial.
    const equipo = await prisma.equipo.create({
      data: {
        empresaId: empresaA,
        codigo: `EQ-${sufijo}`,
        nombre: "Envasadora 2",
        almacenId: plantaAlmacen.id,
        ubicacionTecnicaId: estacion.id,
      },
    });
    assert.equal(
      (await prisma.equipo.findUniqueOrThrow({ where: { id: equipo.id } })).ubicacionTecnicaId,
      estacion.id
    );
    await prisma.equipo.update({ where: { id: equipo.id }, data: { ubicacionTecnicaId: linea.id } });
    assert.equal(await prisma.equipo.count({ where: { ubicacionTecnicaId: linea.id } }), 1);
    assert.equal(await prisma.equipo.count({ where: { ubicacionTecnicaId: estacion.id } }), 0);

    // Una ubicación con descendientes no se borra en silencio (onDelete: Restrict).
    await assert.rejects(
      prisma.ubicacionTecnica.delete({ where: { id: linea.id } }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
    );

    // Y no puede colgar de una compañía inexistente.
    await assert.rejects(
      prisma.ubicacionTecnica.create({
        data: { empresaId: `inexistente-${sufijo}`, codigo: "X", nombre: "X" },
      }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
    );
  } finally {
    await prisma.equipo.deleteMany({ where: { empresaId: { in: empresas } } });
    // De la hoja a la raíz: los padres tienen onDelete: Restrict.
    for (const codigo of ["ENV-02", "LINEA-A", "PLANTA-1"]) {
      await prisma.ubicacionTecnica.deleteMany({ where: { empresaId: { in: empresas }, codigo } });
    }
    await prisma.almacen.deleteMany({ where: { empresaId: { in: empresas } } });
    await prisma.empresa.deleteMany({ where: { id: { in: empresas } } });
  }
});
