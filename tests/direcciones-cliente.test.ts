import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  direccionPara,
  tiposFaltantes,
  validarDireccion,
  valorPrincipalDe,
} from "@/lib/direccionesCliente";

// Un cliente tiene varias direcciones y cada una cumple un papel distinto.
// Hasta el 2026-09-14 había una sola, y la de entrega se retipeaba a mano en
// cada pedido.

const base = {
  tipo: "ENTREGA",
  direccion: "Carretera Panamericana Sur km 1200",
  ubigeoId: "u1",
  latitud: null as number | null,
  longitud: null as number | null,
  principal: true,
  activa: true,
};

test("solo la dirección de entrega exige distrito", () => {
  // Es la que el reparto usa para agrupar y la que la licitación de flete
  // necesita para cotizar un tramo.
  assert.equal(validarDireccion({ ...base, ubigeoId: null }), "SIN_UBICACION");
  // Las otras tres son administrativas y muchas veces llegan sin distrito.
  for (const tipo of ["FISCAL", "FACTURACION", "COBRANZA"]) {
    assert.equal(validarDireccion({ ...base, tipo, ubigeoId: null }), null, tipo);
  }
});

test("una dirección inactiva no puede ser la principal de su tipo", () => {
  // Dejaría al tipo sin principal utilizable, que es peor que no tener ninguna.
  assert.equal(validarDireccion({ ...base, activa: false }), "PRINCIPAL_INACTIVA");
  assert.equal(validarDireccion({ ...base, activa: false, principal: false }), null);
});

test("las coordenadas se validan: un camión no se manda por un decimal mal puesto", () => {
  assert.equal(validarDireccion({ ...base, latitud: -17.19, longitud: -70.6 }), null);
  assert.equal(validarDireccion({ ...base, latitud: 91 }), "COORDENADA_INVALIDA");
  assert.equal(validarDireccion({ ...base, longitud: -181 }), "COORDENADA_INVALIDA");
});

test("el tipo y la dirección son obligatorios", () => {
  assert.equal(validarDireccion({ ...base, tipo: "DEPOSITO" }), "TIPO_INVALIDO");
  assert.equal(validarDireccion({ ...base, direccion: "   " }), "SIN_DIRECCION");
  assert.equal(validarDireccion({ ...base, direccion: "x".repeat(501) }), "DIRECCION_LARGA");
});

test("con varias direcciones y ninguna principal, no se adivina", () => {
  // Elegir a cuál de tres plantas va el despacho es peor que pedir que alguien
  // lo diga.
  const dos = [
    { id: "a", tipo: "ENTREGA", principalDe: null, activa: true },
    { id: "b", tipo: "ENTREGA", principalDe: null, activa: true },
  ];
  assert.equal(direccionPara(dos, "ENTREGA"), null);
  // Con una sola activa no hay ambigüedad que resolver.
  assert.equal(direccionPara([dos[0]], "ENTREGA"), "a");
  // Y la principal gana siempre.
  assert.equal(
    direccionPara([...dos, { id: "c", tipo: "ENTREGA", principalDe: "ENTREGA", activa: true }], "ENTREGA"),
    "c"
  );
});

test("una principal desactivada deja de usarse", () => {
  const direcciones = [
    { id: "a", tipo: "ENTREGA", principalDe: "ENTREGA", activa: false },
    { id: "b", tipo: "ENTREGA", principalDe: null, activa: true },
  ];
  assert.equal(direccionPara(direcciones, "ENTREGA"), "b");
});

test("se reclaman fiscal y entrega, no las otras dos", () => {
  // Facturación y cobranza caen en la fiscal cuando no se declaran.
  assert.deepEqual(tiposFaltantes([]), ["FISCAL", "ENTREGA"]);
  assert.deepEqual(
    tiposFaltantes([
      { id: "a", tipo: "FISCAL", principalDe: "FISCAL", activa: true },
      { id: "b", tipo: "ENTREGA", principalDe: "ENTREGA", activa: true },
    ]),
    []
  );
  // Una inactiva no cuenta como cubierta.
  assert.deepEqual(
    tiposFaltantes([{ id: "a", tipo: "FISCAL", principalDe: null, activa: false }]),
    ["FISCAL", "ENTREGA"]
  );
});

test("valorPrincipalDe traduce la casilla al campo del índice", () => {
  assert.equal(valorPrincipalDe("ENTREGA", true), "ENTREGA");
  assert.equal(valorPrincipalDe("ENTREGA", false), null);
});

test("la base impide dos principales del mismo tipo", async () => {
  // La regla vive en el índice único, no en una intención del código.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-dir-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Minera del Sur" },
  });

  await prisma.direccionCliente.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      tipo: "ENTREGA",
      principalDe: "ENTREGA",
      direccion: "Unidad Toquepala",
    },
  });

  await assert.rejects(
    prisma.direccionCliente.create({
      data: {
        empresaId,
        clienteId: cliente.id,
        tipo: "ENTREGA",
        principalDe: "ENTREGA",
        direccion: "Unidad Cuajone",
      },
    }),
    "dos principales del mismo tipo deben chocar en la base"
  );

  // Pero varias NO principales conviven: los NULL no chocan entre sí.
  for (const nombre of ["Unidad Cuajone", "Almacén Ilo", "Planta Moquegua"]) {
    await prisma.direccionCliente.create({
      data: { empresaId, clienteId: cliente.id, tipo: "ENTREGA", direccion: nombre },
    });
  }
  assert.equal(await prisma.direccionCliente.count({ where: { clienteId: cliente.id } }), 4);

  // Y una principal por cada tipo distinto sí puede coexistir.
  await prisma.direccionCliente.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      tipo: "FISCAL",
      principalDe: "FISCAL",
      direccion: "Av. Principal 100",
    },
  });

  // Borrar el cliente se lleva sus direcciones.
  await prisma.cliente.delete({ where: { id: cliente.id } });
  assert.equal(await prisma.direccionCliente.count({ where: { clienteId: cliente.id } }), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("la migración conserva la dirección que cada cliente ya tenía", async () => {
  // Si el maestro se estrenara vacío, el dato cargado se perdería y cada ficha
  // arrancaría sin domicilio fiscal.
  const sql = await readFile(
    resolve(
      process.cwd(),
      "prisma/migraciones-sqlite-historico/20260914140000_customer_multiple_addresses/migration.sql"
    ),
    "utf8"
  );
  assert.match(sql, /INSERT INTO "direcciones_cliente"/);
  assert.match(sql, /FROM "clientes"/);
  assert.match(sql, /'FISCAL', 'FISCAL'/);
  // Y no inventa filas para quien no tenía dirección.
  assert.match(sql, /WHERE "direccion" IS NOT NULL/);
});

test("el pedido conserva la dirección como foto, no como referencia viva", async () => {
  // Un pedido despachado no puede cambiar de destino porque alguien editó la
  // ficha del cliente después.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(esquema.indexOf("model Pedido {"), esquema.indexOf("model PedidoDetalle"));
  assert.match(modelo, /direccionEntrega\s+String\?/, "el texto copiado debe seguir existiendo");
  assert.match(modelo, /direccionEntregaId\s+String\?/, "y la referencia de dónde salió");
});

test("el pedido no acepta una dirección que no es de ese cliente", async () => {
  // El id llega del navegador. Si no se comprobara, un pedido podría declarar
  // que va a la planta de otro cliente — o de otra compañía.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("let direccionEntregaValidaId"),
    acciones.indexOf("if (cliente.bloqueadoCobranza)")
  );
  assert.ok(bloque.length > 0, "no se encontró la validación de procedencia");
  for (const filtro of ["empresaId", "clienteId", 'tipo: "ENTREGA"', "activa: true"]) {
    assert.ok(bloque.includes(filtro), `la consulta debe filtrar por ${filtro}`);
  }
});

test("el selector de destino no ofrece domicilios fiscales", async () => {
  // Ofrecer el domicilio fiscal como destino de despacho es cómo se manda una
  // carga a una oficina administrativa.
  const pagina = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/nuevo/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /where: \{ tipo: "ENTREGA", activa: true \}/);
});

test("editar el texto del destino borra la procedencia", async () => {
  // Si no, el pedido diría venir de una dirección del maestro con un texto que
  // ya no coincide con ella.
  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/PedidoFormulario.tsx"),
    "utf8"
  );
  const bloque = formulario.slice(
    formulario.indexOf('name="direccionEntrega"'),
    formulario.indexOf("placeholder=\"Dirección, distrito")
  );
  assert.match(bloque, /setDireccionEntrega\(e\.target\.value\)/);
  assert.match(bloque, /setDireccionEntregaId\(""\)/);
});

test("las acciones de direcciones acotan a la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/[id]/direccionesActions.ts"),
    "utf8"
  );
  // El cliente y la dirección se releen; el id del navegador no se usa suelto.
  assert.match(acciones, /findFirst\(\{ where: \{ id: clienteId, empresaId \} \}\)/);
  assert.match(acciones, /where: \{ id, empresaId, cliente: \{ empresaId \} \}/);
  // Y desactivar no borra: hay pedidos que citan esa dirección.
  assert.match(acciones, /data: \{ activa: false, principalDe: null \}/);
  assert.doesNotMatch(acciones, /direccionCliente\.delete/);
});
