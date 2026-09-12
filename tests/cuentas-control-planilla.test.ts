import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  CLAVES_RECLASIFICABLES,
  ETIQUETA_CONTROL,
  postearAsiento,
  type ClaveControl,
} from "@/lib/contabilidad";

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
  // Separada de GASTO_PERSONAL el 2026-09-13: el aporte patronal no es
  // remuneración del trabajador y no puede compartir la cuenta de sueldos.
  "GASTO_ESSALUD_PATRONAL",
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
    ["6271", "GASTO"],
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
      // Una planilla real en miniatura: al debe la remuneración y el aporte
      // patronal; al haber los descuentos al trabajador, el patronal por pagar
      // y el neto, que es la remuneración menos sus descuentos (1000 − 130 −
      // 50 = 820). El patronal no se le descuenta a nadie: entra y sale.
      lineas: [
        { clave: "GASTO_PERSONAL", debe: 1000 },
        { clave: "GASTO_ESSALUD_PATRONAL", debe: 90 },
        { clave: "ONP_AFP_POR_PAGAR", haber: 130 },
        { clave: "ESSALUD_POR_PAGAR", haber: 90 },
        { clave: "RETENCION_5TA_POR_PAGAR", haber: 50 },
        { clave: "SUELDOS_POR_PAGAR", haber: 820 },
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
  assert.equal(asiento.detalles.length, 6);

  const debe = asiento.detalles.reduce((t, d) => t + d.debe.toNumber(), 0);
  const haber = asiento.detalles.reduce((t, d) => t + d.haber.toNumber(), 0);
  assert.equal(debe, 1090);
  assert.equal(haber, 1090);

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

test("el aporte patronal no comparte cuenta con el sueldo", async () => {
  // El aporte patronal es una contribución social de la empresa, no
  // remuneración del trabajador: en el PCGE va a 627 y no a 621. Hasta el
  // 2026-09-13 compartían clave, y por lo tanto cuenta.
  const plan = await prisma.planCuentas.findFirstOrThrow({ where: { empresaId: "1" } });
  const cuentas = await prisma.cuentaContable.findMany({
    where: { planCuentasId: plan.id, codigo: { in: ["6211", "6271"] } },
  });
  assert.equal(cuentas.length, 2, "faltan las dos cuentas");
  assert.notEqual(cuentas[0].id, cuentas[1].id);

  // Y el asiento de planilla usa la clave nueva para el patronal.
  const contabilidad = await readFile(resolve(process.cwd(), "src/lib/contabilidad.ts"), "utf8");
  const bloque = contabilidad.slice(
    contabilidad.indexOf("export async function postearPlanilla"),
    contabilidad.indexOf("export async function postearGratificacion")
  );
  assert.ok(bloque.length > 0, "no se encontró postearPlanilla");
  assert.match(
    bloque,
    /clave: "GASTO_ESSALUD_PATRONAL",\s*\n\s*glosa: `EsSalud/,
    "el patronal debe imputarse a su propia clave"
  );
  // Una sola línea con GASTO_PERSONAL: la de la remuneración.
  assert.equal((bloque.match(/clave: "GASTO_PERSONAL"/g) ?? []).length, 1);
});

test("el aporte patronal sigue siendo reclasificable entre centros", async () => {
  // Antes de separarlo ya lo era, porque vivía dentro de GASTO_PERSONAL y
  // lleva centro de costo. Sacarlo de la lista al separar la clave le habría
  // quitado una capacidad que nadie pidió quitar.
  assert.ok(CLAVES_RECLASIFICABLES.includes("GASTO_ESSALUD_PATRONAL"));
  assert.ok(CLAVES_RECLASIFICABLES.includes("GASTO_PERSONAL"));
});

test("la migración alcanza a las compañías que ya existen", async () => {
  // El seed solo corre en instalaciones nuevas. Sin la migración, una base ya
  // instalada se quedaba sin los controles para siempre — el mismo hueco que
  // dejó `seed-ubigeos.ts` cuando nadie lo ejecutaba.
  // Las claves se repartieron en dos migraciones: seis en la que saldó la
  // deuda y la del aporte patronal al separarlo. Se comprueba la unión, no un
  // archivo puntual, para que agregar una clave en una migración nueva no
  // obligue a reescribir esta prueba.
  const archivos = [
    "20260913170000_payroll_control_accounts",
    "20260913190000_employer_contribution_account",
  ];
  const sqls = await Promise.all(
    archivos.map((dir) =>
      readFile(resolve(process.cwd(), `prisma/migrations/${dir}/migration.sql`), "utf8")
    )
  );
  const todo = sqls.join("\n");

  for (const clave of CLAVES_PLANILLA) {
    assert.match(todo, new RegExp(clave), `ninguna migración crea ${clave}`);
  }
  // Cada una idempotente, sin pisar lo que el contador ya haya configurado, y
  // apuntando a la cuenta del plan de SU compañía.
  for (const [i, sql] of sqls.entries()) {
    assert.match(sql, /WHERE NOT EXISTS/, `${archivos[i]} no es idempotente`);
    assert.doesNotMatch(sql, /UPDATE "controles_contables"/, `${archivos[i]} pisa controles`);
    assert.doesNotMatch(sql, /UPDATE "cuentas_contables"/, `${archivos[i]} pisa cuentas`);
    assert.match(sql, /c\."planCuentasId" = p\."id"/, `${archivos[i]} cruza compañías`);
  }
});
