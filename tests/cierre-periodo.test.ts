import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  pendientesDeCierre,
  puedeCompletarTarea,
  siguienteOrdenTarea,
  verificacionesDeCierre,
} from "@/lib/cierrePeriodo";

// Checklist de cierre: verificaciones automáticas derivadas de los datos del
// propio período, más tareas propias con orden y dependencia.

const TODO_LIMPIO = {
  incidenciasContablesAbiertas: 0,
  comprobantesSinAceptar: 0,
  asientosDelPeriodo: 12,
};

test("las verificaciones se devuelven todas, superadas incluidas", () => {
  // Un checklist que solo muestra lo que falta no sirve para dar un cierre por
  // revisado: quien lo firma necesita ver qué se comprobó.
  const v = verificacionesDeCierre(TODO_LIMPIO);
  assert.equal(v.length, 3);
  assert.deepEqual(
    v.map((x) => x.pendientes),
    [0, 0, 0]
  );
  // Cada una dice dónde ir a resolverla.
  assert.ok(v.every((x) => x.href.startsWith("/")));
});

test("cada verificación cuenta sus casos pendientes", () => {
  const v = verificacionesDeCierre({
    incidenciasContablesAbiertas: 3,
    comprobantesSinAceptar: 2,
    asientosDelPeriodo: 5,
  });
  assert.equal(v.find((x) => x.clave === "INCIDENCIAS_CONTABLES")?.pendientes, 3);
  assert.equal(v.find((x) => x.clave === "COMPROBANTES_SUNAT")?.pendientes, 2);
  assert.equal(v.find((x) => x.clave === "SIN_ASIENTOS")?.pendientes, 0);
});

test("un período sin asientos se marca para revisar, no como falla", () => {
  // Puede ser correcto si no hubo actividad; lo que no puede es pasar
  // inadvertido.
  const v = verificacionesDeCierre({ ...TODO_LIMPIO, asientosDelPeriodo: 0 });
  assert.equal(v.find((x) => x.clave === "SIN_ASIENTOS")?.pendientes, 1);
});

test("la dependencia es el orden: no se salta una tarea anterior", () => {
  const tareas = [
    { id: "t1", orden: 1, completadaEn: null },
    { id: "t2", orden: 2, completadaEn: null },
    { id: "t3", orden: 3, completadaEn: null },
  ];
  assert.equal(puedeCompletarTarea(tareas, "t1", false), null);
  assert.equal(puedeCompletarTarea(tareas, "t2", false), "ANTERIOR_PENDIENTE");
  assert.equal(puedeCompletarTarea(tareas, "t3", false), "ANTERIOR_PENDIENTE");

  // Completada la primera, se habilita la segunda y solo la segunda.
  const conPrimera = [{ ...tareas[0], completadaEn: new Date() }, tareas[1], tareas[2]];
  assert.equal(puedeCompletarTarea(conPrimera, "t2", false), null);
  assert.equal(puedeCompletarTarea(conPrimera, "t3", false), "ANTERIOR_PENDIENTE");
});

test("no se completa una tarea ya hecha ni en un período cerrado", () => {
  const tareas = [{ id: "t1", orden: 1, completadaEn: new Date() }];
  assert.equal(puedeCompletarTarea(tareas, "t1", false), "YA_COMPLETADA");
  assert.equal(puedeCompletarTarea(tareas, "inexistente", false), "YA_COMPLETADA");
  // El período cerrado gana sobre cualquier otra razón.
  assert.equal(puedeCompletarTarea(tareas, "t1", true), "PERIODO_CERRADO");
});

test("las tareas se agregan al final", () => {
  assert.equal(siguienteOrdenTarea([]), 1);
  assert.equal(siguienteOrdenTarea([{ orden: 1 }, { orden: 2 }]), 3);
  // Tolera huecos: borrar la 2 no hace que la próxima reutilice su número.
  assert.equal(siguienteOrdenTarea([{ orden: 1 }, { orden: 5 }]), 6);
});

test("los pendientes suman verificaciones abiertas y tareas sin completar", () => {
  const verificaciones = verificacionesDeCierre({
    incidenciasContablesAbiertas: 3,
    comprobantesSinAceptar: 1,
    asientosDelPeriodo: 4,
  });
  const tareas = [
    { id: "t1", orden: 1, completadaEn: new Date() },
    { id: "t2", orden: 2, completadaEn: null },
  ];
  // Dos verificaciones abiertas (cuentan una vez cada una, no por caso) más
  // una tarea pendiente.
  assert.equal(pendientesDeCierre(verificaciones, tareas), 3);
  assert.equal(pendientesDeCierre(verificacionesDeCierre(TODO_LIMPIO), []), 0);
});

test("las tareas cuelgan del período y se llevan con él", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-cierre-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const periodo = await prisma.periodoFiscal.create({
      data: { empresaId, anio: 2026, mes: 9 },
    });
    await prisma.tareaCierrePeriodo.create({
      data: { periodoFiscalId: periodo.id, orden: 1, descripcion: "Conciliar bancos" },
    });
    await prisma.tareaCierrePeriodo.create({
      data: { periodoFiscalId: periodo.id, orden: 2, descripcion: "Revisar depreciación" },
    });

    // El orden es único por período: no puede haber dos "paso 1".
    await assert.rejects(() =>
      prisma.tareaCierrePeriodo.create({
        data: { periodoFiscalId: periodo.id, orden: 1, descripcion: "Duplicada" },
      })
    );

    // Un período cerrado guarda cuántos puntos quedaron abiertos.
    await prisma.periodoFiscal.update({
      where: { id: periodo.id },
      data: { estado: "CERRADO", cerradoEn: new Date(), cerradoPor: "Contadora", pendientesAlCerrar: 2 },
    });
    const cerrado = await prisma.periodoFiscal.findUniqueOrThrow({ where: { id: periodo.id } });
    assert.equal(cerrado.pendientesAlCerrar, 2);

    await prisma.periodoFiscal.delete({ where: { id: periodo.id } });
    assert.equal(
      await prisma.tareaCierrePeriodo.count({ where: { periodoFiscalId: periodo.id } }),
      0
    );
  } finally {
    await prisma.periodoFiscal.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

// --- Guardias ---------------------------------------------------------------

test("el sistema no propone una lista de tareas contables", async () => {
  // Qué incluye un cierre contable es criterio del contador. Sembrar tareas
  // por defecto sería inventar un procedimiento profesional.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.match(esquema, /model TareaCierrePeriodo/);

  for (const semilla of ["prisma/seed.ts", "prisma/seed-demo.ts"]) {
    const contenido = await readFile(resolve(process.cwd(), semilla), "utf8");
    assert.doesNotMatch(
      contenido,
      /tareaCierrePeriodo/,
      `${semilla} no debe sembrar tareas de cierre predefinidas`
    );
  }
});

test("cerrar el período no se bloquea, pero deja constancia", async () => {
  // Bloquear el cierre por un dato menor podría dejar los libros sin poder
  // cerrarse. La decisión queda registrada en pendientesAlCerrar.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/calendario-fiscal/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function alternarPeriodoFiscal"),
    acciones.indexOf("export type EstadoFormulario")
  );
  assert.match(bloque, /pendientesAlCerrar/);
  assert.doesNotMatch(
    bloque,
    /throw new Error\([^)]*pendient/i,
    "cerrar no debe lanzar por tener pendientes"
  );
});

test("las acciones del checklist validan contra la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/calendario-fiscal/actions.ts"),
    "utf8"
  );
  const agregar = acciones.slice(
    acciones.indexOf("export async function agregarTareaCierre"),
    acciones.indexOf("export async function completarTareaCierre")
  );
  const completar = acciones.slice(acciones.indexOf("export async function completarTareaCierre"));
  assert.match(agregar, /periodoFiscal\.findFirst\(\{[\s\S]{0,80}empresaId/);
  assert.match(completar, /periodo: \{ empresaId \}/);
});
