import assert from "node:assert/strict";
import { test } from "node:test";
import { nivelesAplicables, validarNivelesCompra } from "@/lib/aprobacionesCompra";

const decimal = (valor: number) => ({ toNumber: () => valor });

const GENERAL_1 = {
  orden: 1,
  nombre: "Jefatura de compras",
  montoDesdePen: decimal(1000),
  rolAprobador: "GERENCIA",
  almacenId: null,
};
const GENERAL_2 = {
  orden: 2,
  nombre: "Gerencia general",
  montoDesdePen: decimal(50000),
  rolAprobador: "ADMIN",
  almacenId: null,
};
const PLANTA_LURIN = {
  orden: 3,
  nombre: "Jefatura de planta Lurín",
  montoDesdePen: decimal(1000),
  rolAprobador: "GERENCIA",
  almacenId: "lurin",
};
const PLANTA_CALLAO = {
  orden: 4,
  nombre: "Jefatura de planta Callao",
  montoDesdePen: decimal(0),
  rolAprobador: "GERENCIA",
  almacenId: "callao",
};

const TODOS = [GENERAL_1, GENERAL_2, PLANTA_LURIN, PLANTA_CALLAO];

test("el monto sigue decidiendo qué niveles aplican", () => {
  assert.deepEqual(nivelesAplicables([GENERAL_1, GENERAL_2], 500).map((p) => p.orden), []);
  assert.deepEqual(nivelesAplicables([GENERAL_1, GENERAL_2], 1000).map((p) => p.orden), [1]);
  assert.deepEqual(nivelesAplicables([GENERAL_1, GENERAL_2], 60000).map((p) => p.orden), [1, 2]);
});

test("una orden sin planta de destino solo recorre los niveles generales", () => {
  // Liberaciones de acuerdo y OC adjudicadas desde un RFQ no llevan almacén.
  assert.deepEqual(nivelesAplicables(TODOS, 60000).map((p) => p.orden), [1, 2]);
  assert.deepEqual(nivelesAplicables(TODOS, 60000, null).map((p) => p.orden), [1, 2]);
});

test("la planta SUMA sus niveles a los generales, no los reemplaza", () => {
  // Es la decisión central del esquema: configurar una planta solo puede
  // agregar controles. Si reemplazara, una planta mal configurada aflojaría
  // la aprobación sin que nadie lo note.
  assert.deepEqual(nivelesAplicables(TODOS, 60000, "lurin").map((p) => p.orden), [1, 2, 3]);
  assert.deepEqual(nivelesAplicables(TODOS, 60000, "callao").map((p) => p.orden), [1, 2, 4]);
});

test("los niveles de una planta no alcanzan a las órdenes de otra", () => {
  // El nivel de Callao arranca en 0, así que aplicaría a cualquier monto — pero
  // solo a las órdenes destinadas a Callao.
  assert.deepEqual(nivelesAplicables(TODOS, 10, "callao").map((p) => p.orden), [4]);
  assert.deepEqual(nivelesAplicables(TODOS, 10, "lurin").map((p) => p.orden), []);
  assert.deepEqual(nivelesAplicables(TODOS, 10, "otra-planta").map((p) => p.orden), []);
});

test("la secuencia combinada sale ordenada y conserva el monto sin convertir", () => {
  const pasos = nivelesAplicables(
    [PLANTA_LURIN, GENERAL_2, GENERAL_1],
    60000,
    "lurin"
  );
  assert.deepEqual(pasos.map((p) => p.orden), [1, 2, 3]);
  // El Decimal del nivel atraviesa la función sin convertirse: el paso guarda
  // exactamente el umbral configurado.
  assert.equal(pasos[1].montoDesdePen.toNumber(), 50000);
  assert.equal(pasos[1].rolAprobador, "ADMIN");
  // Un rol desconocido cae en GERENCIA y nunca en ADMIN: ante un dato raro se
  // escala al permiso menor, no al mayor.
  const raro = nivelesAplicables(
    [{ ...GENERAL_1, rolAprobador: "VENTAS" }],
    5000
  );
  assert.equal(raro[0].rolAprobador, "GERENCIA");
});

test("la validación de niveles sigue rechazando configuraciones imposibles", () => {
  assert.equal(validarNivelesCompra([]), false);
  assert.equal(
    validarNivelesCompra([{ orden: 1, nombre: "Ok", montoDesdePen: 100, rolAprobador: "GERENCIA" }]),
    false
  );
  assert.equal(
    validarNivelesCompra([
      { orden: 1, nombre: "Jefatura", montoDesdePen: 100, rolAprobador: "GERENCIA" },
    ]),
    true
  );
  assert.equal(
    validarNivelesCompra([
      { orden: 1, nombre: "Jefatura", montoDesdePen: 100, rolAprobador: "GERENCIA" },
      { orden: 1, nombre: "Gerencia", montoDesdePen: 200, rolAprobador: "ADMIN" },
    ]),
    false
  );
  assert.equal(
    validarNivelesCompra([
      { orden: 0, nombre: "Jefatura", montoDesdePen: 100, rolAprobador: "GERENCIA" },
    ]),
    false
  );
  assert.equal(
    validarNivelesCompra([
      { orden: 1, nombre: "Jefatura", montoDesdePen: -1, rolAprobador: "GERENCIA" },
    ]),
    false
  );
});
