import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  condicionAbierta,
  condicionVigenteEn,
  validarNuevaCondicion,
} from "@/lib/condicionesProveedor";

// Historial de condiciones comerciales con vigencias. `Proveedor.condicionPagoDias`
// sigue siendo el valor vigente que lee el sistema; esto responde qué regía
// cuándo y por qué cambió, que un campo mutable no puede contestar.

const f = (iso: string) => new Date(`${iso}T00:00:00`);

// Contado hasta el 1/3, luego 30 días hasta el 1/7, luego 45 desde entonces.
const HISTORIAL = [
  { id: "v1", condicionPagoDias: 0, vigenteDesde: f("2026-01-01"), vigenteHasta: f("2026-03-01") },
  { id: "v2", condicionPagoDias: 30, vigenteDesde: f("2026-03-01"), vigenteHasta: f("2026-07-01") },
  { id: "v3", condicionPagoDias: 45, vigenteDesde: f("2026-07-01"), vigenteHasta: null },
];

test("la condición vigente se resuelve por fecha", () => {
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-02-15"))?.condicionPagoDias, 0);
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-05-10"))?.condicionPagoDias, 30);
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-09-11"))?.condicionPagoDias, 45);
});

test("los rangos son semiabiertos: el día del cambio ya rige la nueva", () => {
  // El 1/3 es el primer día de la de 30, no el último de la de contado. Así
  // ninguna factura cae en dos condiciones ni en ninguna.
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-03-01"))?.condicionPagoDias, 30);
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-02-28"))?.condicionPagoDias, 0);
  assert.equal(condicionVigenteEn(HISTORIAL, f("2026-07-01"))?.condicionPagoDias, 45);
});

test("antes del primer registro no hay condición, y eso no es contado", () => {
  // Cero días es una condición pactada; la ausencia de una es otra cosa. Quien
  // lo muestre debe decir "sin condición registrada", que es la verdad.
  assert.equal(condicionVigenteEn(HISTORIAL, f("2025-12-31")), null);
  assert.equal(condicionVigenteEn([], f("2026-09-11")), null);
});

test("la vigente es la única abierta", () => {
  assert.equal(condicionAbierta(HISTORIAL)?.id, "v3");
  assert.equal(condicionAbierta([]), null);
  assert.equal(condicionAbierta(HISTORIAL.slice(0, 2)), null);
});

test("un solapamiento heredado no devuelve una respuesta ambigua", () => {
  // No debería ocurrir —la acción cierra la anterior al abrir la nueva— pero
  // si los datos lo traen, gana la de inicio más reciente en vez de que la
  // pantalla muestre un número al azar.
  const solapado = [
    { id: "a", condicionPagoDias: 30, vigenteDesde: f("2026-01-01"), vigenteHasta: null },
    { id: "b", condicionPagoDias: 60, vigenteDesde: f("2026-06-01"), vigenteHasta: null },
  ];
  assert.equal(condicionVigenteEn(solapado, f("2026-09-01"))?.id, "b");
});

test("no se puede insertar una condición anterior a la vigente", () => {
  // Permitirlo reescribiría el pasado —y con él, el plazo bajo el que ya se
  // recibieron facturas—, que es justo lo que este historial viene a impedir.
  assert.equal(
    validarNuevaCondicion(HISTORIAL, {
      condicionPagoDias: 15,
      vigenteDesde: f("2026-05-01"),
      motivo: "retroactiva",
    }),
    "ANTERIOR_A_LA_VIGENTE"
  );
  // Desde la misma fecha de la vigente sí: es corregir lo que se acaba de
  // pactar hoy, no reescribir un período ya cerrado.
  assert.equal(
    validarNuevaCondicion(HISTORIAL, {
      condicionPagoDias: 15,
      vigenteDesde: f("2026-07-01"),
      motivo: "corrección",
    }),
    null
  );
});

test("el motivo es obligatorio y el plazo tiene que ser entero no negativo", () => {
  const base = { vigenteDesde: f("2026-10-01"), motivo: "negociación anual" };
  assert.equal(validarNuevaCondicion(HISTORIAL, { ...base, condicionPagoDias: 60 }), null);
  assert.equal(validarNuevaCondicion(HISTORIAL, { ...base, condicionPagoDias: 0 }), null);
  assert.equal(validarNuevaCondicion(HISTORIAL, { ...base, condicionPagoDias: -1 }), "PLAZO_INVALIDO");
  assert.equal(validarNuevaCondicion(HISTORIAL, { ...base, condicionPagoDias: 30.5 }), "PLAZO_INVALIDO");
  assert.equal(
    validarNuevaCondicion(HISTORIAL, { ...base, condicionPagoDias: 30, motivo: "   " }),
    "SIN_MOTIVO"
  );
});

test("registrar una condición cierra la anterior sin huecos", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-cond-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const proveedor = await prisma.proveedor.create({
      data: { empresaId, razonSocial: "Proveedor con historial", condicionPagoDias: 0 },
    });

    const primera = await prisma.condicionComercialProveedor.create({
      data: {
        proveedorId: proveedor.id,
        condicionPagoDias: 30,
        vigenteDesde: f("2026-01-01"),
        motivo: "Condición inicial",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    // Abrir la segunda cierra la primera EN LA MISMA FECHA.
    await prisma.condicionComercialProveedor.update({
      where: { id: primera.id },
      data: { vigenteHasta: f("2026-06-01") },
    });
    await prisma.condicionComercialProveedor.create({
      data: {
        proveedorId: proveedor.id,
        condicionPagoDias: 45,
        vigenteDesde: f("2026-06-01"),
        motivo: "Negociación por volumen",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    const historial = await prisma.condicionComercialProveedor.findMany({
      where: { proveedorId: proveedor.id },
      select: { id: true, condicionPagoDias: true, vigenteDesde: true, vigenteHasta: true },
    });
    assert.equal(historial.length, 2);
    // Ninguna fecha cae fuera de todas las condiciones ni dentro de dos.
    assert.equal(condicionVigenteEn(historial, f("2026-05-31"))?.condicionPagoDias, 30);
    assert.equal(condicionVigenteEn(historial, f("2026-06-01"))?.condicionPagoDias, 45);

    // Borrar el proveedor se lleva su historial: es parte de su ficha.
    await prisma.proveedor.delete({ where: { id: proveedor.id } });
    assert.equal(
      await prisma.condicionComercialProveedor.count({ where: { proveedorId: proveedor.id } }),
      0
    );
  } finally {
    await prisma.proveedor.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

// --- Guardias ---------------------------------------------------------------

test("el plazo no se puede cambiar por la puerta de atrás", async () => {
  // Dos caminos para cambiar el mismo valor, uno de los cuales no deja
  // historial, vacían la función: el selector del maestro dejó de ser editable.
  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/catalogo/proveedores/ProveedorFormulario.tsx"),
    "utf8"
  );
  assert.doesNotMatch(
    formulario,
    /name="condicionPagoDias"/,
    "el maestro no debe tener un campo editable de plazo: el cambio va por el historial"
  );
});

test("registrar una condición valida el proveedor contra la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/catalogo/proveedores/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(acciones.indexOf("export async function registrarCondicionComercial"));
  assert.match(bloque, /proveedor\.findFirst\(\{[\s\S]{0,80}empresaId/);
  assert.match(bloque, /validarNuevaCondicion\(/);
  // Y deja el maestro sincronizado con la versión vigente.
  assert.match(bloque, /proveedor\.update\(\{[\s\S]{0,120}condicionPagoDias/);
});
