import assert from "node:assert/strict";
import { test } from "node:test";
import { creariaCicloCentroCosto, idsSubarbolCentroCosto, sumarSubarbolCentroCosto } from "@/lib/jerarquiaCentrosCosto";

const centros = [
  { id: "grupo", parentId: null },
  { id: "planta", parentId: "grupo" },
  { id: "linea", parentId: "planta" },
  { id: "ventas", parentId: null },
];

test("la jerarquía obtiene el subárbol completo sin duplicados", () => {
  assert.deepEqual(new Set(idsSubarbolCentroCosto("grupo", centros)), new Set(["grupo", "planta", "linea"]));
});

test("la agregación suma presupuesto o real de todos los descendientes", () => {
  assert.equal(sumarSubarbolCentroCosto("grupo", centros, new Map([["grupo", 10], ["planta", 20], ["linea", 30]])), 60);
  assert.equal(sumarSubarbolCentroCosto("ventas", centros, new Map([["ventas", 7]])), 7);
});

test("la jerarquía rechaza autorreferencias y padres descendientes", () => {
  assert.equal(creariaCicloCentroCosto("grupo", "grupo", centros), true);
  assert.equal(creariaCicloCentroCosto("grupo", "linea", centros), true);
  assert.equal(creariaCicloCentroCosto("linea", "ventas", centros), false);
});
