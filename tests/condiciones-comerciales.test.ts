import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  alcanzaPedidoMinimo,
  descuentoAplicable,
  mensajeIncumplimiento,
  ORDEN_PRIORIDAD,
  revisarCondicionesPedido,
  validarCondiciones,
} from "@/lib/condicionesComerciales";

test("el descuento del cliente reemplaza al del canal, no se suma", () => {
  // 15% y 10% podrían ser 25% o 23.5% según quién lo mire. Elegir por el
  // negocio sería inventarle una política de precios; lo más específico manda.
  assert.deepEqual(descuentoAplicable(15, 10), { pct: 15, origen: "CLIENTE" });
  assert.deepEqual(descuentoAplicable(null, 10), { pct: 10, origen: "CANAL" });
  assert.deepEqual(descuentoAplicable(null, 0), { pct: 0, origen: "CANAL" });
});

test("un descuento de cliente en 0 es una decisión, no un hueco", () => {
  // Significa «a este no le corresponde el descuento del canal». Por eso el
  // estado "sin descuento propio" se expresa con null y no con cero.
  assert.deepEqual(descuentoAplicable(0, 12), { pct: 0, origen: "CLIENTE" });
});

test("el descuento se valida como porcentaje", () => {
  const base = { pedidoMinimo: null, monedaDefecto: "PEN" };
  assert.equal(validarCondiciones({ ...base, descuentoGeneralPct: 0 }), null);
  assert.equal(validarCondiciones({ ...base, descuentoGeneralPct: 99.9 }), null);
  assert.equal(validarCondiciones({ ...base, descuentoGeneralPct: null }), null);
  assert.equal(
    validarCondiciones({ ...base, descuentoGeneralPct: -1 }),
    "DESCUENTO_INVALIDO"
  );
  assert.equal(
    validarCondiciones({ ...base, descuentoGeneralPct: 101 }),
    "DESCUENTO_INVALIDO"
  );
  // 100% regala la mercadería: si es muestra o reposición, corresponde
  // registrarla como tal y no como una venta con descuento total.
  assert.equal(
    validarCondiciones({ ...base, descuentoGeneralPct: 100 }),
    "DESCUENTO_EXCESIVO"
  );
});

test("el mínimo y la moneda se validan", () => {
  const base = { descuentoGeneralPct: null, monedaDefecto: "PEN" };
  assert.equal(validarCondiciones({ ...base, pedidoMinimo: 0 }), null);
  assert.equal(validarCondiciones({ ...base, pedidoMinimo: 500 }), null);
  assert.equal(validarCondiciones({ ...base, pedidoMinimo: null }), null);
  assert.equal(
    validarCondiciones({ ...base, pedidoMinimo: -1 }),
    "PEDIDO_MINIMO_INVALIDO"
  );
  assert.equal(
    validarCondiciones({ descuentoGeneralPct: null, pedidoMinimo: null, monedaDefecto: "EUR" }),
    "MONEDA_INVALIDA"
  );
});

test("sin mínimo declarado, cualquier pedido alcanza", () => {
  assert.equal(alcanzaPedidoMinimo(1, null), true);
  assert.equal(alcanzaPedidoMinimo(0, null), true);
});

test("el mínimo se compara con tolerancia de centavo", () => {
  assert.equal(alcanzaPedidoMinimo(500, 500), true, "justo en el mínimo alcanza");
  assert.equal(alcanzaPedidoMinimo(499.99, 500), false);
  // La aritmética de punto flotante no debe rechazar un pedido exacto.
  assert.equal(alcanzaPedidoMinimo(0.1 + 0.2, 0.3), true);
});

test("la orden de compra se exige antes que el mínimo", () => {
  // Quien recibe el rechazo necesita saber cuál condición incumplió, y la OC
  // es la que no se arregla agregando líneas.
  const incumple = revisarCondicionesPedido({
    total: 100,
    pedidoMinimo: 500,
    requiereOrdenCompra: true,
    ordenCompraCliente: null,
  });
  assert.deepEqual(incumple, { tipo: "FALTA_ORDEN_COMPRA" });
});

test("un cliente que exige orden de compra no acepta un espacio en blanco", () => {
  assert.deepEqual(
    revisarCondicionesPedido({
      total: 1000,
      pedidoMinimo: null,
      requiereOrdenCompra: true,
      ordenCompraCliente: "   ",
    }),
    { tipo: "FALTA_ORDEN_COMPRA" }
  );
  assert.equal(
    revisarCondicionesPedido({
      total: 1000,
      pedidoMinimo: null,
      requiereOrdenCompra: true,
      ordenCompraCliente: "OC-4471",
    }),
    null
  );
  // Y a quien no la exige, no se le pide.
  assert.equal(
    revisarCondicionesPedido({
      total: 1000,
      pedidoMinimo: null,
      requiereOrdenCompra: false,
      ordenCompraCliente: null,
    }),
    null
  );
});

test("el rechazo por mínimo dice los dos números", () => {
  const incumple = revisarCondicionesPedido({
    total: 320.5,
    pedidoMinimo: 500,
    requiereOrdenCompra: false,
    ordenCompraCliente: null,
  });
  assert.ok(incumple);
  const mensaje = mensajeIncumplimiento(incumple, "PEN");
  assert.match(mensaje, /320\.50/);
  assert.match(mensaje, /500\.00/);
  assert.match(mensaje, /PEN/);
});

test("la prioridad ordena la cola", () => {
  const clientes = [
    { nombre: "b", prioridad: "NORMAL" as const },
    { nombre: "a", prioridad: "ALTA" as const },
    { nombre: "c", prioridad: "BAJA" as const },
  ];
  const ordenados = [...clientes].sort(
    (x, y) => ORDEN_PRIORIDAD[x.prioridad] - ORDEN_PRIORIDAD[y.prioridad]
  );
  assert.deepEqual(ordenados.map((c) => c.nombre), ["a", "b", "c"]);
});

// --- Guardias estructurales -------------------------------------------------

test("el pedido aplica las condiciones antes de escribir nada", async () => {
  // Si se comprobaran después de reservar stock, un pedido rechazado dejaría
  // stock comprometido.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  const posicionRevision = acciones.indexOf("revisarCondicionesPedido({");
  const posicionCreate = acciones.indexOf("const pedido = await tx.pedido.create({");
  assert.ok(posicionRevision !== -1, "no se encontró la revisión de condiciones");
  assert.ok(posicionRevision < posicionCreate, "la revisión debe ir antes de crear el pedido");
  assert.match(acciones, /descuentoAplicable\(/);
});

test("no se agregó una lista de precios que nadie lee", async () => {
  // Un campo que apunte a un maestro vacío es un dato que nadie usa. La lista
  // de precios va como módulo propio, con sus ítems y el cálculo que los lea.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(cliente.length > 500, "el corte quedó vacío");
  assert.ok(!/listaPreciosId/.test(cliente));
  // Lo que sí quedó conectado.
  for (const campo of [
    "descuentoGeneralPct",
    "pedidoMinimo",
    "prioridadAtencion",
    "requiereOrdenCompra",
    "monedaDefecto",
  ]) {
    assert.ok(cliente.includes(campo), `falta ${campo}`);
  }
});
