import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { generarOrdenesPreventivasVencidas } from "@/lib/mantenimientoPreventivo";

// ---------------------------------------------------------------------------
// Quién escribe en qué compañía.
//
// Los modelos con `empresaId` lo declaraban como `String @default("1")`. Ese
// default existió por una razón buena —las migraciones que agregaron la columna
// tenían que rellenar las filas existentes, todas de la compañía original "1"—
// pero quedó convertido en una trampa: una escritura que **omitía** el campo no
// fallaba ni avisaba, simplemente archivaba la fila en la compañía "1". Una
// auditoría de 2026-09-12 encontró así nueve escrituras sin compañía, entre
// ellas notas de crédito y comisiones, que además se **leen** filtrando por ese
// mismo campo: con una segunda sociedad habrían aparecido en el P&L equivocado.
//
// Hasta el 2026-09-16 este archivo compensaba eso leyendo `src/` con
// expresiones regulares, porque en SQLite quitar el default de 88 modelos era
// reconstruir 88 tablas. En PostgreSQL es `ALTER COLUMN ... DROP DEFAULT`, así
// que la migración `20260916221229_empresa_explicita` lo quitó de los 94 y el
// trabajo pasó al compilador, que lo hace mejor: no se le escapa una escritura
// por una forma sintáctica que el regex no previó, y falla antes de correr.
//
// Lo que queda aquí es lo que el compilador no puede cuidar de sí mismo: que
// nadie le devuelva el default y apague la exigencia sin que se note.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

test("ningún modelo le pone compañía por defecto", async () => {
  // Devolver el `@default("1")` a un solo modelo basta para que sus escrituras
  // vuelvan a ser silenciosas: Prisma dejaría de exigir el campo justo ahí.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const conDefault: string[] = [];
  let conEmpresa = 0;

  for (const bloque of esquema.split(/\nmodel /).slice(1)) {
    const nombre = bloque.slice(0, bloque.indexOf(" ")).trim();
    const cuerpo = bloque.slice(0, bloque.indexOf("\n}"));
    if (!/^\s*empresaId\s+String/m.test(cuerpo)) continue;
    conEmpresa++;
    if (/^\s*empresaId\s+String[^\n]*@default\(/m.test(cuerpo)) conDefault.push(nombre);
  }

  // Si esto queda en cero la guardia dejó de mirar algo y pasaría siempre.
  assert.ok(conEmpresa > 50, `solo ${conEmpresa} modelos con empresaId`);
  assert.deepEqual(
    conDefault,
    [],
    `Estos modelos volverían a aceptar escrituras sin compañía:\n  ${conDefault.join("\n  ")}`
  );
});

test("el cliente generado exige la compañía, no la ofrece", async () => {
  // La guardia de arriba mira la intención; esta mira el resultado. Entre las
  // dos está el paso que de verdad protege: que `prisma generate` haya corrido
  // y el tipo diga `empresaId: string` y no `empresaId?: string`. Un esquema
  // corregido con un cliente viejo compila igual de mal que antes.
  const modelo = await readFile(
    resolve(RAIZ, "src/generated/prisma/models/Cliente.ts"),
    "utf8"
  );
  const bloque = modelo.slice(modelo.indexOf("export type ClienteUncheckedCreateInput = {"));
  const cuerpo = bloque.slice(0, bloque.indexOf("\n}"));
  assert.ok(cuerpo.length > 50, "el corte del tipo quedó vacío");
  assert.match(cuerpo, /^\s*empresaId: string$/m, "empresaId volvió a ser opcional");
});

test("la orden preventiva se archiva en la compañía del equipo, no en la «1»", async () => {
  // La tarea programada genera órdenes para los planes vencidos de TODAS las
  // compañías. Omitía `empresaId`, así que el código salía del correlativo de
  // la compañía correcta y la fila se guardaba en la "1" — y `@@unique([empresaId,
  // codigo])` convertía eso en un choque de numeración en cuanto la segunda
  // compañía llegaba a un número que la primera ya tenía.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-om-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const almacen = await prisma.almacen.create({
      data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Planta", tipo: "PLANTA" },
    });
    const equipo = await prisma.equipo.create({
      data: { empresaId, codigo: `EQ-${sufijo}`, nombre: "Compresor", almacenId: almacen.id },
    });
    // Un plan por tiempo cuya base de cálculo es `creadoEn`: nace vencido.
    const plan = await prisma.planMantenimiento.create({
      data: {
        empresaId,
        equipoId: equipo.id,
        nombre: `Cambio de aceite ${sufijo}`,
        tipo: "POR_TIEMPO",
        frecuenciaDias: 1,
        ultimaEjecucionFecha: new Date(2020, 0, 1),
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    await prisma.$transaction((tx) => generarOrdenesPreventivasVencidas(tx));

    const orden = await prisma.ordenMantenimiento.findFirst({
      where: { planMantenimientoId: plan.id },
    });
    assert.ok(orden, "no se generó la orden del plan vencido");
    assert.equal(orden.empresaId, empresaId);
    assert.notEqual(orden.empresaId, "1");

    // Y sigue siendo idempotente: con una orden abierta no genera otra.
    await prisma.$transaction((tx) => generarOrdenesPreventivasVencidas(tx));
    assert.equal(
      await prisma.ordenMantenimiento.count({ where: { planMantenimientoId: plan.id } }),
      1
    );

    await prisma.ordenMantenimiento.deleteMany({ where: { planMantenimientoId: plan.id } });
    await prisma.planMantenimiento.delete({ where: { id: plan.id } });
    await prisma.equipo.delete({ where: { id: equipo.id } });
    await prisma.almacen.delete({ where: { id: almacen.id } });
  } finally {
    await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  }
});

test("la numeración por compañía solo se sostiene si la fila declara su compañía", async () => {
  // El índice único es `(empresaId, codigo)`. Dos compañías pueden tener su
  // propio OM-00001; lo que no puede haber son dos OM-00001 en la misma. Esa
  // es exactamente la falla que producía omitir el campo: el correlativo de la
  // segunda compañía empieza en 1 y la fila aterrizaba en la primera.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresas = [`empresa-num-a-${sufijo}`, `empresa-num-b-${sufijo}`];
  const equipos: string[] = [];
  const almacenes: string[] = [];
  try {
    for (const empresaId of empresas) {
      await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
      const almacen = await prisma.almacen.create({
        data: { empresaId, codigo: `ALM-${empresaId}`, nombre: "Planta", tipo: "PLANTA" },
      });
      almacenes.push(almacen.id);
      const equipo = await prisma.equipo.create({
        data: { empresaId, codigo: `EQ-${empresaId}`, nombre: "Compresor", almacenId: almacen.id },
      });
      equipos.push(equipo.id);
      await prisma.ordenMantenimiento.create({
        data: {
          empresaId,
          codigo: "OM-00001",
          equipoId: equipo.id,
          tipo: "PREVENTIVO",
          descripcion: "Primera orden",
          fechaProgramada: new Date(),
          usuarioId: "u",
          usuarioNombre: "u",
        },
      });
    }

    // El mismo código repetido dentro de una compañía sí se rechaza.
    await assert.rejects(
      prisma.ordenMantenimiento.create({
        data: {
          empresaId: empresas[0],
          codigo: "OM-00001",
          equipoId: equipos[0],
          tipo: "CORRECTIVO",
          descripcion: "Repetida",
          fechaProgramada: new Date(),
          usuarioId: "u",
          usuarioNombre: "u",
        },
      })
    );
  } finally {
    await prisma.ordenMantenimiento.deleteMany({ where: { empresaId: { in: empresas } } });
    for (const id of equipos) await prisma.equipo.delete({ where: { id } }).catch(() => {});
    for (const id of almacenes) await prisma.almacen.delete({ where: { id } }).catch(() => {});
    for (const id of empresas) await prisma.empresa.delete({ where: { id } }).catch(() => {});
  }
});
