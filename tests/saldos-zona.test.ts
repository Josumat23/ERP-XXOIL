import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import {
  distribucionCuadra,
  distribucionZonas,
  validarMovimientoEntreZonas,
  zonaPrincipal,
} from "@/lib/saldosZona";

test("la distribución reparte el saldo del almacén entre zonas y el resto sin zona", () => {
  const d = distribucionZonas(100, [
    { zonaAlmacenId: "a", cantidad: 60 },
    { zonaAlmacenId: "b", cantidad: 25 },
  ]);
  assert.equal(d.asignado, 85);
  assert.equal(d.sinZona, 15);
  assert.equal(d.total, 100);
  assert.equal(distribucionCuadra(d), true);

  // Sin nada repartido, todo es "sin zona".
  const vacia = distribucionZonas(40, []);
  assert.equal(vacia.asignado, 0);
  assert.equal(vacia.sinZona, 40);
  assert.equal(distribucionCuadra(vacia), true);

  // Las zonas en cero no ensucian el listado.
  assert.deepEqual(
    distribucionZonas(10, [{ zonaAlmacenId: "a", cantidad: 0 }]).porZona,
    []
  );
});

test("un reparto inconsistente no produce un 'sin zona' negativo", () => {
  // Dato corrupto: las zonas suman más que el almacén. El descuadre tiene que
  // quedar visible, no disfrazado de número negativo.
  const d = distribucionZonas(50, [{ zonaAlmacenId: "a", cantidad: 80 }]);
  assert.equal(d.sinZona, 0);
  assert.equal(d.asignado, 80);
  assert.equal(distribucionCuadra(d), false);
});

test("mover entre zonas solo se permite si el origen tiene el stock", () => {
  const d = distribucionZonas(100, [
    { zonaAlmacenId: "a", cantidad: 60 },
    { zonaAlmacenId: "b", cantidad: 25 },
  ]);

  assert.equal(validarMovimientoEntreZonas({ zonaOrigenId: "a", zonaDestinoId: "b", cantidad: 60 }, d), null);
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: "a", zonaDestinoId: "b", cantidad: 61 }, d),
    "SIN_SALDO_EN_ORIGEN"
  );
  // Desde el stock sin zona asignada.
  assert.equal(validarMovimientoEntreZonas({ zonaOrigenId: null, zonaDestinoId: "a", cantidad: 15 }, d), null);
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: null, zonaDestinoId: "a", cantidad: 16 }, d),
    "SIN_SALDO_SIN_ZONA"
  );
  // Una zona sin saldo registrado es una zona con cero.
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: "z", zonaDestinoId: "a", cantidad: 1 }, d),
    "SIN_SALDO_EN_ORIGEN"
  );

  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: "a", zonaDestinoId: "a", cantidad: 5 }, d),
    "MISMA_ZONA"
  );
  for (const cantidad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      validarMovimientoEntreZonas({ zonaOrigenId: "a", zonaDestinoId: "b", cantidad }, d),
      "CANTIDAD_INVALIDA"
    );
  }
});

test("la zona principal es la de mayor cantidad, con desempate estable", () => {
  assert.equal(
    zonaPrincipal([
      { zonaAlmacenId: "a", cantidad: 10 },
      { zonaAlmacenId: "b", cantidad: 30 },
    ]),
    "b"
  );
  assert.equal(zonaPrincipal([]), null);
  assert.equal(zonaPrincipal([{ zonaAlmacenId: "a", cantidad: 0 }]), null);
  // Empate: gana el id menor, para que no dependa del orden de la consulta.
  assert.equal(
    zonaPrincipal([
      { zonaAlmacenId: "b", cantidad: 5 },
      { zonaAlmacenId: "a", cantidad: 5 },
    ]),
    "a"
  );
  assert.equal(
    zonaPrincipal([
      { zonaAlmacenId: "a", cantidad: 5 },
      { zonaAlmacenId: "b", cantidad: 5 },
    ]),
    "a"
  );
});

test("un ítem puede tener cantidad en más de una zona y el total no cambia", async () => {
  const sufijo = Date.now().toString(36);
  const empresaId = `empresa-zona-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const almacen = await prisma.almacen.create({
      data: { empresaId, tipo: "PLANTA", codigo: "ALM-Z", nombre: "Almacén con zonas" },
    });
    const [zonaA, zonaB] = await Promise.all([
      prisma.zonaAlmacen.create({ data: { almacenId: almacen.id, codigo: "A-01" } }),
      prisma.zonaAlmacen.create({ data: { almacenId: almacen.id, codigo: "B-02" } }),
    ]);
    const categoria = await prisma.categoria.create({ data: { empresaId, nombre: `Cat ${sufijo}` } });
    const producto = await prisma.producto.create({
      data: { empresaId, categoriaId: categoria.id, codigo: `P-${sufijo}`, nombre: "Producto" },
    });
    const presentacion = await prisma.presentacion.create({
      data: {
        empresaId,
        productoId: producto.id,
        sku: `SKU-${sufijo}`,
        nombre: "Balde",
        contenidoKg: 4,
        precio: 100,
        stock: 100,
      },
    });
    await prisma.saldoAlmacen.create({
      data: {
        almacenId: almacen.id,
        tipoItem: "PRESENTACION",
        presentacionId: presentacion.id,
        cantidad: 100,
      },
    });

    // Esto es lo que el puntero único no permitía: el mismo ítem en dos zonas.
    await prisma.saldoZona.createMany({
      data: [
        {
          zonaAlmacenId: zonaA.id,
          tipoItem: "PRESENTACION",
          itemId: presentacion.id,
          presentacionId: presentacion.id,
          cantidad: 60,
        },
        {
          zonaAlmacenId: zonaB.id,
          tipoItem: "PRESENTACION",
          itemId: presentacion.id,
          presentacionId: presentacion.id,
          cantidad: 25,
        },
      ],
    });

    const leerDistribucion = async () => {
      const [saldoAlmacen, saldos] = await Promise.all([
        prisma.saldoAlmacen.findFirst({
          where: { almacenId: almacen.id, tipoItem: "PRESENTACION", presentacionId: presentacion.id },
        }),
        prisma.saldoZona.findMany({
          where: { tipoItem: "PRESENTACION", presentacionId: presentacion.id, zona: { almacenId: almacen.id } },
        }),
      ]);
      return distribucionZonas(
        saldoAlmacen?.cantidad.toNumber() ?? 0,
        saldos.map((s) => ({ zonaAlmacenId: s.zonaAlmacenId, cantidad: s.cantidad.toNumber() }))
      );
    };

    const antes = await leerDistribucion();
    assert.equal(antes.total, 100);
    assert.equal(antes.asignado, 85);
    assert.equal(antes.sinZona, 15);
    assert.equal(distribucionCuadra(antes), true);
    assert.equal(zonaPrincipal(antes.porZona), zonaA.id);

    // Mover 40 de A a B: ambas zonas cambian, el total del almacén no.
    await prisma.$transaction([
      prisma.saldoZona.updateMany({
        where: { zonaAlmacenId: zonaA.id, presentacionId: presentacion.id },
        data: { cantidad: { decrement: 40 } },
      }),
      prisma.saldoZona.updateMany({
        where: { zonaAlmacenId: zonaB.id, presentacionId: presentacion.id },
        data: { cantidad: { increment: 40 } },
      }),
    ]);

    const despues = await leerDistribucion();
    assert.equal(despues.total, 100, "mover entre zonas no debe alterar el saldo del almacén");
    assert.equal(despues.asignado, 85);
    assert.equal(despues.sinZona, 15);
    assert.equal(
      despues.porZona.find((s) => s.zonaAlmacenId === zonaA.id)?.cantidad,
      20
    );
    assert.equal(
      despues.porZona.find((s) => s.zonaAlmacenId === zonaB.id)?.cantidad,
      65
    );
    // La zona principal se movió con el stock: es derivada, no un puntero.
    assert.equal(zonaPrincipal(despues.porZona), zonaB.id);

    // Una zona con saldo no se puede borrar en silencio.
    await assert.rejects(
      prisma.zonaAlmacen.delete({ where: { id: zonaA.id } }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
    );

    // El índice único impide dos filas para la misma zona e ítem. Funciona
    // porque la clave usa itemId, que no es nuleable: con presentacionId e
    // insumoId (uno de ellos siempre NULL) SQLite las consideraría distintas.
    await assert.rejects(
      prisma.saldoZona.create({
        data: {
          zonaAlmacenId: zonaA.id,
          tipoItem: "PRESENTACION",
          itemId: presentacion.id,
          presentacionId: presentacion.id,
          cantidad: 1,
        },
      }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
    );
  } finally {
    await prisma.saldoZona.deleteMany({ where: { zona: { almacen: { empresaId } } } });
    await prisma.saldoAlmacen.deleteMany({ where: { almacen: { empresaId } } });
    await prisma.zonaAlmacen.deleteMany({ where: { almacen: { empresaId } } });
    await prisma.presentacion.deleteMany({ where: { empresaId } });
    await prisma.producto.deleteMany({ where: { empresaId } });
    await prisma.categoria.deleteMany({ where: { empresaId } });
    await prisma.almacen.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});
