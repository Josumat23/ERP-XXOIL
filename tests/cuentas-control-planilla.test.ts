import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { ETIQUETA_CONTROL, postearAsiento, type ClaveControl } from "@/lib/contabilidad";

// Seis claves de ControlContable se usaban en los asientos de planilla,
// gratificación, CTS y liquidación pero nunca se sembraron. Como el posteo es
// best-effort, la operación no fallaba: el asiento se descartaba en silencio y
// solo quedaba la IncidenciaContable.
//
// La suite tampoco lo veía, y la razón importa: la prueba de planilla
// **fabrica sus propias cuentas y controles** antes de postear, así que
// construía justo lo que faltaba en producción y pasaba en verde.

const CLAVES_PLANILLA: ClaveControl[] = [
  "GASTO_PERSONAL",
  "ESSALUD_POR_PAGAR",
  "ONP_AFP_POR_PAGAR",
  "RETENCION_5TA_POR_PAGAR",
  "SUELDOS_POR_PAGAR",
  "CTS_POR_PAGAR",
];

test("una instalación recién sembrada tiene los controles de planilla", async () => {
  // Contra los datos, no contra el texto del seed: es la diferencia entre
  // comprobar que está escrito y comprobar que quedó.
  const controles = await prisma.controlContable.findMany({
    where: { empresaId: "1", clave: { in: CLAVES_PLANILLA } },
    include: { cuenta: true },
  });

  const porClave = new Map(controles.map((c) => [c.clave, c.cuenta]));
  const faltantes = CLAVES_PLANILLA.filter((clave) => !porClave.has(clave));
  assert.deepEqual(faltantes, [], `sin control sembrado: ${faltantes}`);

  // A qué cuenta apunta cada uno no se comprueba aquí a propósito: la prueba
  // de planilla de `critical-flows` reapunta estos mismos controles a cuentas
  // TEST-* de su fixture, y la suite comparte base. Ese reapuntado es, además,
  // la razón por la que el defecto pasó inadvertido tanto tiempo: el fixture
  // construía justo lo que producción no tenía. Lo que sí se exige es que el
  // control exista y no cuelgue de una cuenta dada de baja.
  for (const clave of CLAVES_PLANILLA) {
    assert.equal(porClave.get(clave)?.activo, true, `${clave} apunta a una cuenta inactiva`);
  }
});

test("el plan sembrado trae las seis cuentas de planilla, con su naturaleza", async () => {
  // Contra el plan y no contra el control, por lo mismo de arriba. Un gasto
  // imputado a una cuenta de pasivo cuadra el asiento y descuadra el balance.
  const esperadas: Array<[string, "GASTO" | "PASIVO"]> = [
    ["6211", "GASTO"],
    ["4031", "PASIVO"],
    ["4032", "PASIVO"],
    // La retención de quinta es plata retenida a los trabajadores; el impuesto
    // propio de la empresa es otra cosa. En el PCGE el nivel de cuatro dígitos
    // (4017) no las distingue, por eso esta es la única cuenta de cinco.
    ["40173", "PASIVO"],
    ["4111", "PASIVO"],
    ["4151", "PASIVO"],
  ];

  const plan = await prisma.planCuentas.findFirstOrThrow({ where: { empresaId: "1" } });
  for (const [codigo, tipo] of esperadas) {
    const cuenta = await prisma.cuentaContable.findFirst({
      where: { planCuentasId: plan.id, codigo },
    });
    assert.ok(cuenta, `falta la cuenta ${codigo} en el plan sembrado`);
    assert.equal(cuenta.tipo, tipo, `${codigo} tiene la naturaleza equivocada`);
  }
});

test("un asiento de planilla ya genera libro, no una incidencia", async () => {
  // La prueba del defecto: con los controles sembrados, postear las seis
  // claves produce asiento. Antes se descartaba entero.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const incidenciasAntes = await prisma.incidenciaContable.count({ where: { empresaId: "1" } });

  const resultado = await prisma.$transaction((tx) =>
    postearAsiento(tx, {
      empresaId: "1",
      origen: "PLANILLA",
      glosa: `Planilla de prueba ${sufijo}`,
      referencia: sufijo,
      lineas: [
        { clave: "GASTO_PERSONAL", debe: 1000 },
        { clave: "ONP_AFP_POR_PAGAR", haber: 130 },
        { clave: "ESSALUD_POR_PAGAR", haber: 90 },
        { clave: "RETENCION_5TA_POR_PAGAR", haber: 50 },
        { clave: "SUELDOS_POR_PAGAR", haber: 730 },
      ],
      usuarioId: "u",
      usuarioNombre: "u",
    })
  );

  assert.equal(resultado.ok, true, `el asiento no se posteó: ${resultado.motivo}`);
  const asiento = await prisma.asientoContable.findFirst({
    where: { empresaId: "1", referencia: sufijo },
    include: { detalles: { include: { cuenta: true } } },
  });
  assert.ok(asiento, "no quedó asiento");
  assert.equal(asiento.detalles.length, 5);

  const debe = asiento.detalles.reduce((t, d) => t + d.debe.toNumber(), 0);
  const haber = asiento.detalles.reduce((t, d) => t + d.haber.toNumber(), 0);
  assert.equal(debe, 1000);
  assert.equal(haber, 1000);

  // Y ninguna incidencia nueva: ese era el único rastro que quedaba antes.
  assert.equal(await prisma.incidenciaContable.count({ where: { empresaId: "1" } }), incidenciasAntes);
});

test("cada clave de control tiene etiqueta para poder reapuntarla", async () => {
  // El control se reapunta desde Finanzas → Plan de cuentas, que lista las
  // claves por su etiqueta. Una clave sin etiqueta no aparece ahí, y entonces
  // la cuenta sembrada dejaría de ser un valor inicial para volverse fija.
  for (const clave of CLAVES_PLANILLA) {
    assert.ok(ETIQUETA_CONTROL[clave], `${clave} no tiene etiqueta`);
  }
});

test("la migración alcanza a las compañías que ya existen", async () => {
  // El seed solo corre en instalaciones nuevas. Sin la migración, una base ya
  // instalada se quedaba sin los controles para siempre — el mismo hueco que
  // dejó `seed-ubigeos.ts` cuando nadie lo ejecutaba.
  const sql = await readFile(
    resolve(process.cwd(), "prisma/migrations/20260913170000_payroll_control_accounts/migration.sql"),
    "utf8"
  );
  for (const clave of CLAVES_PLANILLA) {
    assert.match(sql, new RegExp(clave), `la migración no crea ${clave}`);
  }
  // Idempotente y sin pisar lo que el contador ya haya configurado.
  assert.match(sql, /WHERE NOT EXISTS/);
  assert.doesNotMatch(sql, /UPDATE "controles_contables"/);
  assert.doesNotMatch(sql, /UPDATE "cuentas_contables"/);
  // Cada control apunta a la cuenta del plan de SU compañía, no a una ajena.
  assert.match(sql, /c\."planCuentasId" = p\."id"/);
});
