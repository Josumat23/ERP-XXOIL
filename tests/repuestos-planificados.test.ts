import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  costoAnualPlanificado,
  costoPlanificado,
  ejecucionesPorAnio,
} from "@/lib/repuestosPlanificados";

// Lista técnica planificada: lo que un plan preventivo PREVÉ consumir, para
// poder presupuestar antes de ejecutar. Separada del consumo real, que es lo
// que mueve kardex y costo.

test("el costo por ejecución suma las líneas al costo vigente", () => {
  const { lineas, porEjecucion } = costoPlanificado([
    { insumoId: "a", nombre: "Aceite 15W40", cantidad: 4, costoUnitario: 25.5 },
    { insumoId: "b", nombre: "Filtro", cantidad: 1, costoUnitario: 18.9 },
  ]);
  assert.equal(lineas[0].subtotal, 102);
  assert.equal(lineas[1].subtotal, 18.9);
  assert.equal(porEjecucion, 120.9);
});

test("una lista vacía cuesta cero, no falla", () => {
  const { lineas, porEjecucion } = costoPlanificado([]);
  assert.deepEqual(lineas, []);
  assert.equal(porEjecucion, 0);
});

test("el redondeo por línea evita centésimas invisibles", () => {
  // 3 × 0.335 = 1.005 → 1.01 en la línea, y la suma en pantalla cuadra con lo
  // que se ve, en vez de arrastrar una fracción que nadie puede verificar.
  const { porEjecucion } = costoPlanificado([
    { insumoId: "a", nombre: "Empaque", cantidad: 3, costoUnitario: 0.335 },
  ]);
  assert.equal(porEjecucion, 1.01);
});

test("las ejecuciones por año solo se estiman cuando se pueden saber", () => {
  assert.equal(ejecucionesPorAnio("POR_TIEMPO", 30), 12.17);
  assert.equal(ejecucionesPorAnio("POR_TIEMPO", 365), 1);

  // Un plan por contador depende de cuánto se use el equipo: suponerlo sería
  // inventar un dato del negocio.
  assert.equal(ejecucionesPorAnio("POR_CONTADOR", 30), null);
  // Frecuencia inválida: null, no "infinitas veces".
  assert.equal(ejecucionesPorAnio("POR_TIEMPO", 0), null);
  assert.equal(ejecucionesPorAnio("POR_TIEMPO", -5), null);
  assert.equal(ejecucionesPorAnio("POR_TIEMPO", null), null);
});

test("el costo anual es null y no cero cuando no se puede estimar", () => {
  // Un cero se lee como "no cuesta nada", que es lo contrario de "no se sabe".
  assert.equal(costoAnualPlanificado(120.9, null), null);
  assert.equal(costoAnualPlanificado(120.9, 12.17), 1471.35);
  assert.equal(costoAnualPlanificado(0, 12), 0);
});

test("la lista se guarda por plan y no admite el mismo repuesto dos veces", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-repuestos-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const almacen = await prisma.almacen.create({
      data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Planta", tipo: "PLANTA" },
    });
    const equipo = await prisma.equipo.create({
      data: { empresaId, codigo: `EQ-${sufijo}`, nombre: "Compresor", almacenId: almacen.id },
    });
    const plan = await prisma.planMantenimiento.create({
      data: {
        empresaId,
        equipoId: equipo.id,
        nombre: "Cambio de aceite",
        tipo: "POR_TIEMPO",
        frecuenciaDias: 90,
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const insumo = await prisma.insumo.create({
      data: {
        empresaId,
        codigo: `INS-${sufijo}`,
        nombre: "Aceite 15W40",
        unidadMedida: "L",
        tipo: "MATERIA_PRIMA",
        costoUnitario: 25.5,
      },
    });

    await prisma.repuestoPlanMantenimiento.create({
      data: { planMantenimientoId: plan.id, insumoId: insumo.id, cantidad: 4 },
    });

    // Repetir el mismo repuesto en el mismo plan se rechaza: si hacen falta
    // más unidades, van en la cantidad, no en otra fila.
    await assert.rejects(() =>
      prisma.repuestoPlanMantenimiento.create({
        data: { planMantenimientoId: plan.id, insumoId: insumo.id, cantidad: 1 },
      })
    );

    // Borrar el plan se lleva su lista (es parte del plan, no historia propia).
    await prisma.planMantenimiento.delete({ where: { id: plan.id } });
    assert.equal(
      await prisma.repuestoPlanMantenimiento.count({ where: { planMantenimientoId: plan.id } }),
      0
    );
  } finally {
    await prisma.planMantenimiento.deleteMany({ where: { empresaId } });
    await prisma.insumo.deleteMany({ where: { empresaId } });
    await prisma.equipo.deleteMany({ where: { empresaId } });
    await prisma.almacen.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("la lista planificada no se confunde con el consumo real", async () => {
  // La razón de ser de la separación: prellenar el consumo desde el plan haría
  // que el sistema diera por gastados repuestos que quizá no se usaron, y ese
  // consumo mueve kardex y costo.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/equipos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /repuestoPlanMantenimiento\.create/);
  assert.doesNotMatch(
    acciones,
    /repuestoOrdenMantenimiento\.create/,
    "la lista planificada no debe escribir consumo real"
  );

  const preventivo = await readFile(
    resolve(process.cwd(), "src/lib/mantenimientoPreventivo.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    preventivo,
    /repuestoOrdenMantenimiento/,
    "generar la orden desde el plan no debe dar por consumidos los repuestos previstos"
  );
});

test("agregar un repuesto valida plan e insumo contra la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/equipos/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function agregarRepuestoPlan"),
    acciones.indexOf("export async function quitarRepuestoPlan")
  );
  assert.ok(bloque.length > 0);
  assert.match(bloque, /planMantenimiento\.findFirst/);
  assert.match(bloque, /insumo\.findFirst/);
  assert.equal((bloque.match(/empresaId: auth\.usuario\.empresaId/g) ?? []).length, 2);
});
