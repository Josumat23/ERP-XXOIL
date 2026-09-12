import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  MENSAJE_ERROR_ARMADO,
  puedePickearUnidad,
  repartoEnZona,
  validarArmado,
  validarCodigo,
} from "@/lib/unidadesManipulacion";
import { distribucionZonas } from "@/lib/saldosZona";

// Las HU son una TERCERA capa aditiva sobre el stock:
//
//   saldoAlmacen = suma(saldoZona) + sinZona
//   saldoZona    = suma(contenido de las HU de esa zona) + suelto
//
// Lo que hay sobre un pallet YA está contado en el saldo de su zona.

test("lo que está sobre una unidad ya está contado en la zona", () => {
  const reparto = repartoEnZona(
    100,
    [
      { presentacionId: "p1", cantidad: 40 },
      { presentacionId: "p1", cantidad: 25 },
      { presentacionId: "otro", cantidad: 99 },
    ],
    "p1"
  );
  assert.equal(reparto.enUnidades, 65);
  assert.equal(reparto.suelto, 35);
  assert.equal(reparto.enUnidades + reparto.suelto, reparto.total);
});

test("un descuadre deja el suelto en cero y queda visible", () => {
  // Mismo criterio que `distribucionZonas`: no se inventa un negativo, se
  // reporta 0 y la diferencia se ve comparando enUnidades contra total.
  const reparto = repartoEnZona(10, [{ presentacionId: "p1", cantidad: 15 }], "p1");
  assert.equal(reparto.suelto, 0);
  assert.equal(reparto.enUnidades, 15);
  assert.ok(reparto.enUnidades > reparto.total, "el descuadre tiene que poder verse");
});

test("solo se sube a un pallet lo que está suelto", () => {
  // Lo que ya está sobre otro pallet no se puede subir a este sin bajarlo: si
  // se permitiera, el mismo stock quedaría sobre dos unidades.
  const reparto = repartoEnZona(100, [{ presentacionId: "p1", cantidad: 80 }], "p1");
  assert.equal(validarArmado(true, reparto, 20), null);
  assert.equal(validarArmado(true, reparto, 21), "SIN_SUELTO");
  assert.equal(validarArmado(true, reparto, 0), "CANTIDAD_INVALIDA");
  assert.equal(validarArmado(true, reparto, -5), "CANTIDAD_INVALIDA");
  // Una unidad fuera de zona no tiene de dónde tomar.
  assert.equal(validarArmado(false, reparto, 5), "SIN_ZONA");
  assert.ok(MENSAJE_ERROR_ARMADO.SIN_SUELTO.includes("otra unidad"));
});

test("el código es obligatorio pero se puede generar", () => {
  assert.equal(validarCodigo("PAL-0001"), null);
  assert.match(validarCodigo("  ") ?? "", /obligatorio/);
  assert.match(validarCodigo("x".repeat(41)) ?? "", /40/);
});

test("una unidad completa solo se prepara si cabe en lo pendiente", () => {
  const pendientes = [
    { presentacionId: "a", pendiente: 10 },
    { presentacionId: "b", pendiente: 5 },
  ];
  // Cabe: se aplica tal cual.
  const cabe = puedePickearUnidad(
    [
      { presentacionId: "a", cantidad: 10 },
      { presentacionId: "b", cantidad: 3 },
    ],
    pendientes
  );
  assert.equal(cabe.puede, true);
  assert.equal(cabe.aplicar.length, 2);

  // Trae de más: bajarla obligaría a devolver el sobrante al rack en el mismo
  // acto, y el sistema no sabría a qué zona.
  const excede = puedePickearUnidad([{ presentacionId: "a", cantidad: 11 }], pendientes);
  assert.equal(excede.puede, false);
  assert.match(excede.motivo, /por cantidad/);

  // Trae algo que la oleada no pide.
  const ajeno = puedePickearUnidad([{ presentacionId: "z", cantidad: 1 }], pendientes);
  assert.equal(ajeno.puede, false);
  assert.match(ajeno.motivo, /no pide/);

  // Vacía no prepara nada.
  assert.equal(puedePickearUnidad([], pendientes).puede, false);
});

test("las tres capas componen y siempre cuadran", async () => {
  // La prueba que ata todo: almacén → zonas → unidades.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-hu-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const almacen = await prisma.almacen.create({
    data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Principal" },
  });
  const zona = await prisma.zonaAlmacen.create({ data: { almacenId: almacen.id, codigo: "A-01" } });
  const categoria = await prisma.categoria.create({
    data: { empresaId, nombre: `Grasas ${sufijo}` },
  });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `P-${sufijo}`, nombre: "Grasa" },
  });
  const presentacion = await prisma.presentacion.create({
    data: {
      empresaId,
      productoId: producto.id,
      sku: `SKU-${sufijo}`,
      nombre: "Balde",
      contenidoKg: 4,
      precio: 50,
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
  await prisma.saldoZona.create({
    data: {
      zonaAlmacenId: zona.id,
      tipoItem: "PRESENTACION",
      itemId: presentacion.id,
      presentacionId: presentacion.id,
      cantidad: 60,
    },
  });
  const unidad = await prisma.unidadManipulacion.create({
    data: {
      empresaId,
      codigo: `HU-${sufijo}`,
      zonaAlmacenId: zona.id,
      usuarioId: "u",
      usuarioNombre: "u",
      contenidos: { create: [{ presentacionId: presentacion.id, cantidad: 45 }] },
    },
  });

  const saldoAlmacen = 100;
  const porZona = [{ zonaAlmacenId: zona.id, cantidad: 60 }];
  const distribucion = distribucionZonas(saldoAlmacen, porZona);
  assert.equal(distribucion.sinZona, 40);
  assert.equal(distribucion.asignado + distribucion.sinZona, saldoAlmacen);

  const contenidos = await prisma.unidadManipulacionContenido.findMany({
    where: { unidad: { zonaAlmacenId: zona.id } },
  });
  const reparto = repartoEnZona(
    60,
    contenidos.map((c) => ({
      presentacionId: c.presentacionId,
      cantidad: c.cantidad.toNumber(),
    })),
    presentacion.id
  );
  assert.equal(reparto.enUnidades, 45);
  assert.equal(reparto.suelto, 15);
  // 45 sobre el pallet + 15 sueltas en la zona + 40 sin zona = 100 del almacén.
  assert.equal(reparto.enUnidades + reparto.suelto + distribucion.sinZona, saldoAlmacen);

  // Un ítem no puede tener dos filas en la misma unidad: serían dos verdades
  // sobre cuántas tiene encima.
  await assert.rejects(
    prisma.unidadManipulacionContenido.create({
      data: { unidadId: unidad.id, presentacionId: presentacion.id, cantidad: 1 },
    })
  );

  // Borrar la unidad se lleva su contenido, no el stock.
  await prisma.unidadManipulacion.delete({ where: { id: unidad.id } });
  assert.equal(
    await prisma.unidadManipulacionContenido.count({ where: { unidadId: unidad.id } }),
    0
  );
  const saldoIntacto = await prisma.saldoZona.findFirstOrThrow({
    where: { zonaAlmacenId: zona.id, itemId: presentacion.id },
  });
  assert.equal(saldoIntacto.cantidad.toNumber(), 60, "desarmar no toca el saldo de la zona");
});

test("el código de la unidad es único por compañía", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const unaId = `empresa-hu-a-${sufijo}`;
  const otraId = `empresa-hu-b-${sufijo}`;
  for (const id of [unaId, otraId]) {
    await prisma.empresa.create({ data: { id, razonSocial: id } });
  }
  const datos = { codigo: "PAL-0001", usuarioId: "u", usuarioNombre: "u" };
  await prisma.unidadManipulacion.create({ data: { empresaId: unaId, ...datos } });
  await assert.rejects(
    prisma.unidadManipulacion.create({ data: { empresaId: unaId, ...datos } })
  );
  // Pero la misma etiqueta puede existir en otra compañía.
  await prisma.unidadManipulacion.create({ data: { empresaId: otraId, ...datos } });
});

// --- Guardias estructurales -------------------------------------------------

test("armar y desarmar no tocan ningún saldo", async () => {
  // Lo que sube al pallet ya estaba contado en la zona. Si cargar moviera
  // saldos, el mismo stock se contaría dos veces.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/unidades-manipulacion/actions.ts"),
    "utf8"
  );
  const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  for (const fn of ["cargarUnidad", "desarmarUnidad"]) {
    const desde = acciones.indexOf(`export async function ${fn}`);
    const hasta = acciones.indexOf("export async function", desde + 10);
    const bloque = sinComentarios(acciones.slice(desde, hasta === -1 ? undefined : hasta));
    assert.ok(bloque.length > 0, `no se encontró ${fn}`);
    assert.doesNotMatch(bloque, /saldoZona\.(update|create|delete)/, `${fn} no debe tocar saldos`);
    assert.doesNotMatch(bloque, /registrarMovimiento/, `${fn} no debe generar kardex`);
  }

  // Mover sí cambia el saldo por zona —el pallet cambia de lugar— pero nunca
  // el del almacén ni el kardex.
  const mover = sinComentarios(
    acciones.slice(
      acciones.indexOf("export async function moverUnidad"),
      acciones.indexOf("export async function desarmarUnidad")
    )
  );
  assert.match(mover, /saldoZona\.updateMany/);
  assert.doesNotMatch(mover, /registrarMovimiento|saldoAlmacen\.update/);
});

test("mover una unidad entre almacenes se rechaza", async () => {
  // Arrastrar stock de un almacén a otro por acá lo movería sin kardex ni
  // documento: eso es un traslado.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/unidades-manipulacion/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function moverUnidad"),
    acciones.indexOf("export async function desarmarUnidad")
  );
  assert.match(bloque, /destino\.almacenId !== unidad\.zona\.almacenId/);
  assert.match(bloque, /traslado/);
});

test("preparar una unidad valida compañía, almacén y usa reclamo optimista", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/oleadas-picking/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function pickearUnidad"),
    acciones.indexOf("export async function completarOleada")
  );
  assert.ok(bloque.length > 0, "no se encontró pickearUnidad");
  // Los dos ids llegan del navegador.
  assert.match(bloque, /oleadaPicking\.findFirst\(\{\s*where: \{ id: oleadaId, empresaId \}/);
  assert.match(bloque, /unidadManipulacion\.findFirst\(\{\s*where: \{ id: unidadId, empresaId \}/);
  // Una recorrida ocurre en un almacén.
  assert.match(bloque, /unidad\.zona\.almacenId !== oleada\.almacenId/);
  assert.match(bloque, /reclamo\.count !== 1/);
  assert.match(bloque, /avance\.count !== 1/);
  // Y no genera kardex: la salida la sigue haciendo la guía.
  assert.doesNotMatch(bloque.replace(/^\s*\/\/.*$/gm, ""), /registrarMovimiento/);
});
