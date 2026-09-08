import assert from "node:assert/strict";
import { test } from "node:test";
import { ajustarCantidadCompra, calcularFechaEntrega } from "@/lib/reservasProduccion";

test("aplica compra mínima y redondea al siguiente múltiplo", () => {
  assert.equal(ajustarCantidadCompra(12, 20, 5), 20);
  assert.equal(ajustarCantidadCompra(22, 20, 5), 25);
  assert.equal(ajustarCantidadCompra(22, 0, 0), 22);
});

test("evita propuestas para necesidades o parámetros inválidos", () => {
  assert.equal(ajustarCantidadCompra(0, 20, 5), 0);
  assert.equal(ajustarCantidadCompra(Number.NaN, 20, 5), 0);
});

test("calcula fecha esperada en días calendario sin mutar la fecha base", () => {
  const base = new Date(2026, 8, 8, 8, 30);
  const entrega = calcularFechaEntrega(base, 12);
  assert.equal(entrega.getFullYear(), 2026);
  assert.equal(entrega.getMonth(), 8);
  assert.equal(entrega.getDate(), 20);
  assert.equal(base.getDate(), 8);
});
