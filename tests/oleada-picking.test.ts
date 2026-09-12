import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  avanceDeOleada,
  consolidarLineas,
  esElegible,
  motivoNoElegible,
  sugerenciasDeZona,
  validarPick,
} from "@/lib/oleadaPicking";
import { distribucionZonas, validarMovimientoEntreZonas } from "@/lib/saldosZona";

// Picking por oleadas. Lo central: preparar NO descuenta inventario — eso lo
// hace la guía al salir — pero sí mueve la capa de zonas, sacando el ítem de
// su zona hacia "sin zona", que es la playa de despacho.

const guia = (parcial: Partial<Parameters<typeof esElegible>[0]> = {}) => ({
  id: "g1",
  numero: "T001-1",
  estadoDespacho: "PLANIFICADO",
  almacenId: "alm1",
  requiereEntrega: true,
  oleadaAbiertaId: null,
  ...parcial,
});

test("solo entra a una oleada lo que se puede preparar", () => {
  assert.equal(esElegible(guia()), true);
  // Ya salió: no hay nada que preparar.
  assert.equal(motivoNoElegible(guia({ estadoDespacho: "EN_RUTA" })), "YA_DESPACHADA");
  // Sin pedido que requiera entrega no mueve inventario (traslado no comercial).
  assert.equal(motivoNoElegible(guia({ requiereEntrega: false })), "SIN_ENTREGA");
  // Sin almacén no se sabe de dónde tomar el stock.
  assert.equal(motivoNoElegible(guia({ almacenId: null })), "SIN_ALMACEN");
  // Dos personas preparando la misma guía en paralelo es stock contado dos veces.
  assert.equal(motivoNoElegible(guia({ oleadaAbiertaId: "op1" })), "YA_EN_OLEADA");
});

test("el orden de las razones no deja pasar una guía ya despachada", () => {
  // Una guía en ruta y además sin almacén sigue siendo, sobre todo, una guía
  // que ya salió: el mensaje tiene que decir eso.
  assert.equal(
    motivoNoElegible(guia({ estadoDespacho: "EN_RUTA", almacenId: null })),
    "YA_DESPACHADA"
  );
});

test("la lista se consolida por presentación, no por guía", () => {
  // Quien camina quiere saber cuántas unidades llevarse, no repetir el pasillo
  // una vez por documento.
  const lineas = consolidarLineas([
    [{ presentacionId: "b", cantidad: 3 }, { presentacionId: "a", cantidad: 2 }],
    [{ presentacionId: "a", cantidad: 5 }],
    [{ presentacionId: "c", cantidad: 1 }],
  ]);
  assert.deepEqual(lineas, [
    { presentacionId: "a", cantidad: 7 },
    { presentacionId: "b", cantidad: 3 },
    { presentacionId: "c", cantidad: 1 },
  ]);
});

test("las zonas se sugieren por código y lo sin zona va al final", () => {
  // El código es como están rotuladas y, con slotting, como están dispuestas.
  // Lo que está sin zona va último porque hay que salir a buscarlo.
  const sugerencias = sugerenciasDeZona(
    [
      { zonaAlmacenId: "z2", codigo: "B-02", cantidad: 5 },
      { zonaAlmacenId: "z1", codigo: "A-01", cantidad: 10 },
      { zonaAlmacenId: "z3", codigo: "C-03", cantidad: 0 },
    ],
    4
  );
  assert.deepEqual(sugerencias.map((s) => s.codigo), ["A-01", "B-02", "Sin zona"]);
  assert.equal(sugerencias[2].zonaAlmacenId, null);
  // Una zona en cero no se sugiere: mandar a alguien a un rack vacío es peor
  // que no decirle nada.
  assert.ok(!sugerencias.some((s) => s.codigo === "C-03"));
});

test("sin stock sin asignar, no aparece la opción «sin zona»", () => {
  const sugerencias = sugerenciasDeZona([{ zonaAlmacenId: "z1", codigo: "A-01", cantidad: 2 }], 0);
  assert.deepEqual(sugerencias.map((s) => s.codigo), ["A-01"]);
});

test("no se puede preparar más de lo pedido", () => {
  // De más no es un sobrante que alguien note: es stock saliendo del almacén
  // sin documento que lo respalde.
  const linea = { cantidadRequerida: 10, cantidadPickeada: 4 };
  assert.equal(validarPick(linea, 6, 100), null);
  assert.match(validarPick(linea, 7, 100) ?? "", /Solo quedan 6/);
  assert.match(validarPick(linea, 0, 100) ?? "", /mayor a 0/);
  assert.match(validarPick(linea, -1, 100) ?? "", /mayor a 0/);
  // Ni más de lo que hay en el origen elegido.
  assert.match(validarPick(linea, 5, 3) ?? "", /no tiene esa cantidad/);
});

test("el avance suma y el faltante nunca es negativo", () => {
  assert.deepEqual(
    avanceDeOleada([
      { cantidadRequerida: 10, cantidadPickeada: 10 },
      { cantidadRequerida: 5, cantidadPickeada: 2 },
    ]),
    { requerido: 15, pickeado: 12, faltante: 3, completa: false }
  );
  assert.equal(avanceDeOleada([{ cantidadRequerida: 4, cantidadPickeada: 4 }]).completa, true);
  assert.equal(avanceDeOleada([]).completa, true);
});

test("«sin zona» ya vale como destino de un movimiento entre zonas", () => {
  // Es lo que hace el picking: sacar del rack hacia la playa de despacho, que
  // no es una zona de almacenamiento. Antes solo valía como origen.
  const distribucion = distribucionZonas(10, [{ zonaAlmacenId: "z1", cantidad: 6 }]);
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: "z1", zonaDestinoId: null, cantidad: 6 }, distribucion),
    null
  );
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: "z1", zonaDestinoId: null, cantidad: 7 }, distribucion),
    "SIN_SALDO_EN_ORIGEN"
  );
  // Sin zona a sin zona no mueve nada.
  assert.equal(
    validarMovimientoEntreZonas({ zonaOrigenId: null, zonaDestinoId: null, cantidad: 1 }, distribucion),
    "MISMA_ZONA"
  );
});

test("preparar deja el saldo del almacén intacto y baja el de la zona", async () => {
  // La invariante del diseño por capas: suma(zonas) + sinZona = saldoAlmacén.
  // Preparar mueve stock DENTRO de esa ecuación, sin cambiar el total.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-op-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const almacen = await prisma.almacen.create({
    data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Principal" },
  });
  const zona = await prisma.zonaAlmacen.create({
    data: { almacenId: almacen.id, codigo: "A-01" },
  });
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
    data: { almacenId: almacen.id, tipoItem: "PRESENTACION", presentacionId: presentacion.id, cantidad: 100 },
  });
  await prisma.saldoZona.create({
    data: {
      zonaAlmacenId: zona.id,
      tipoItem: "PRESENTACION",
      itemId: presentacion.id,
      presentacionId: presentacion.id,
      cantidad: 40,
    },
  });

  const antes = distribucionZonas(100, [{ zonaAlmacenId: zona.id, cantidad: 40 }]);
  assert.equal(antes.sinZona, 60);

  // Lo que hace registrarPick con la capa de zonas: sacar 15 de la zona.
  await prisma.saldoZona.updateMany({
    where: { zonaAlmacenId: zona.id, itemId: presentacion.id },
    data: { cantidad: { decrement: 15 } },
  });

  const saldoAlmacen = await prisma.saldoAlmacen.findFirstOrThrow({
    where: { almacenId: almacen.id, presentacionId: presentacion.id },
  });
  const saldoZona = await prisma.saldoZona.findFirstOrThrow({
    where: { zonaAlmacenId: zona.id, itemId: presentacion.id },
  });

  // El total del almacén NO se movió: preparar no es una salida de inventario.
  assert.equal(saldoAlmacen.cantidad.toNumber(), 100);
  assert.equal(saldoZona.cantidad.toNumber(), 25);

  const despues = distribucionZonas(100, [{ zonaAlmacenId: zona.id, cantidad: 25 }]);
  // Lo preparado pasó a "sin zona": está en la playa, no en el rack.
  assert.equal(despues.sinZona, 75);
  assert.equal(despues.asignado + despues.sinZona, 100);
});

test("una guía entra a lo sumo una vez en la misma oleada", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-op2-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const almacen = await prisma.almacen.create({
    data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Principal" },
  });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente" },
  });
  const g = await prisma.guiaRemision.create({
    data: {
      empresaId,
      numero: `T001-${sufijo}`,
      clienteId: cliente.id,
      fechaTraslado: new Date(),
      puntoPartida: "A",
      puntoLlegada: "B",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const oleada = await prisma.oleadaPicking.create({
    data: {
      empresaId,
      numero: `OP-${sufijo}`,
      almacenId: almacen.id,
      usuarioId: "u",
      usuarioNombre: "u",
      guias: { create: [{ guiaId: g.id }] },
    },
  });
  await assert.rejects(
    prisma.oleadaPickingGuia.create({ data: { oleadaId: oleada.id, guiaId: g.id } })
  );

  // Y borrar la oleada se lleva sus vínculos y líneas, pero no la guía.
  await prisma.oleadaPicking.delete({ where: { id: oleada.id } });
  assert.equal(await prisma.oleadaPickingGuia.count({ where: { guiaId: g.id } }), 0);
  assert.ok(await prisma.guiaRemision.findUnique({ where: { id: g.id } }));
});

// --- Guardias estructurales -------------------------------------------------

test("preparar no toca el kardex", async () => {
  // Descontar al preparar y otra vez al despachar cobraría el stock dos veces.
  // Es el mismo criterio que impide que la nota de débito por mora recargue lo
  // que el recargo ya aplicó.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/oleadas-picking/actions.ts"),
    "utf8"
  );
  const sinComentarios = acciones.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(sinComentarios, /registrarMovimiento/, "el picking no genera kardex");
  assert.doesNotMatch(sinComentarios, /saldoAlmacen\.update/, "el picking no toca el saldo del almacén");
  // Sí mueve la capa de zonas.
  assert.match(sinComentarios, /saldoZona\.updateMany/);
});

test("el picking valida compañía y usa reclamo optimista", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/oleadas-picking/actions.ts"),
    "utf8"
  );
  // Los ids llegan del navegador.
  assert.match(acciones, /guiaRemision\.findMany\(\{\s*where: \{ id: \{ in: guiaIds \}, empresaId \}/);
  assert.match(acciones, /pickingLinea\.findFirst\(\{\s*where: \{ id: lineaId, oleada: \{ empresaId \} \}/);
  // Dos reclamos: el saldo de la zona y el avance de la línea.
  assert.match(acciones, /reclamo\.count !== 1/);
  assert.match(acciones, /avance\.count !== 1/);
  // Cerrar y cancelar se acotan por compañía y estado en el propio where.
  assert.match(acciones, /where: \{ id: oleadaId, empresaId, estado: "ABIERTA" \}/);
});

test("una oleada con mercadería preparada no se cancela", async () => {
  // El sistema no sabe a qué zona volvió cada unidad, así que devolverla es
  // una decisión que se toma en el reparto entre zonas.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/oleadas-picking/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(acciones.indexOf("export async function cancelarOleada"));
  assert.match(bloque, /pickeado > 0/);
  assert.match(bloque, /Traslados/);
});
