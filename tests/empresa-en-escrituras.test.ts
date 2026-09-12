import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { generarOrdenesPreventivasVencidas } from "@/lib/mantenimientoPreventivo";

// ---------------------------------------------------------------------------
// Quién escribe en qué compañía.
//
// Los 88 modelos con `empresaId` lo declaran como `String @default("1")`. Ese
// default existe por una razón buena —las migraciones que agregaron la columna
// tenían que rellenar las filas existentes, todas de la compañía original "1"—
// pero quedó convertido en una trampa: una escritura que **omite** el campo no
// falla ni avisa, simplemente archiva la fila en la compañía "1".
//
// La mitad de lectura del aislamiento multiempresa está cubierta y probada. La
// de escritura no lo estaba: una auditoría de 2026-09-12 encontró nueve
// escrituras de la aplicación sin compañía, entre ellas notas de crédito y
// comisiones, que además se **leen** filtrando por ese mismo campo. Con una
// segunda sociedad habrían aparecido en el P&L equivocado.
//
// Quitar el default de 88 modelos sería una reconstrucción de 88 tablas en
// SQLite, desproporcionada frente al riesgo. Esta guardia es el control
// proporcionado: hace ruidoso lo que el default vuelve silencioso.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

/** Modelos cuyo `empresaId` tiene default, es decir: los que se pueden omitir. */
async function modelosConCompaniaPorDefecto(): Promise<Map<string, string>> {
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const modelos = new Map<string, string>();
  for (const bloque of esquema.split(/\nmodel /).slice(1)) {
    const nombre = bloque.slice(0, bloque.indexOf(" ")).trim();
    const cuerpo = bloque.slice(0, bloque.indexOf("\n}"));
    if (/empresaId\s+String\s+@default\("1"\)/.test(cuerpo)) {
      modelos.set(nombre[0].toLowerCase() + nombre.slice(1), nombre);
    }
  }
  return modelos;
}

async function fuentesDeAplicacion(dir: string, acc: string[] = []): Promise<string[]> {
  for (const nombre of await readdir(dir)) {
    // `src/generated` es el cliente de Prisma: no es código nuestro.
    if (nombre === "generated") continue;
    const ruta = join(dir, nombre);
    if ((await stat(ruta)).isDirectory()) await fuentesDeAplicacion(ruta, acc);
    else if (/\.tsx?$/.test(ruta)) acc.push(ruta);
  }
  return acc;
}

/** El objeto que abre en `desde`, contando llaves. */
function objetoDesde(texto: string, desde: number): string {
  let nivel = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === "{") nivel++;
    else if (texto[i] === "}" && --nivel === 0) return texto.slice(desde, i + 1);
  }
  return texto.slice(desde);
}

test("ninguna escritura de la aplicación deja que la compañía la ponga el default", async () => {
  const modelos = await modelosConCompaniaPorDefecto();
  // Si esto queda en cero, la guardia dejó de mirar algo y pasaría siempre.
  assert.ok(modelos.size > 50, `solo ${modelos.size} modelos con empresaId por defecto`);

  const fuentes = await fuentesDeAplicacion(resolve(RAIZ, "src"));
  const sinCompania: string[] = [];

  for (const archivo of fuentes) {
    const texto = await readFile(archivo, "utf8");
    for (const [accessor, modelo] of modelos) {
      const re = new RegExp(`\\.${accessor}\\.(create|createMany|upsert)\\s*\\(`, "g");
      let coincidencia: RegExpExecArray | null;
      while ((coincidencia = re.exec(texto))) {
        const inicio = texto.indexOf("{", coincidencia.index + coincidencia[0].length - 1);
        if (inicio === -1) continue;
        if (/\bempresaId\b/.test(objetoDesde(texto, inicio))) continue;
        const linea = texto.slice(0, coincidencia.index).split("\n").length;
        sinCompania.push(
          `${relative(RAIZ, archivo).replaceAll("\\", "/")}:${linea} ${modelo}.${coincidencia[1]}`
        );
      }
    }
  }

  assert.deepEqual(
    sinCompania,
    [],
    `Escrituras que caerían en la compañía "1":\n  ${sinCompania.join("\n  ")}`
  );
});

test("las semillas quedan fuera a propósito, y la guardia sí las vería", async () => {
  // `prisma/seed.ts` y `seed-demo.ts` pueblan deliberadamente la compañía "1":
  // ahí el default es la respuesta correcta y no un olvido. Se excluyen por
  // directorio, no por lista de excepciones, para que agregar una escritura
  // nueva en `src/` no tenga forma de quedar exenta.
  const fuentes = await fuentesDeAplicacion(resolve(RAIZ, "src"));
  assert.ok(fuentes.length > 100, "la guardia no está leyendo el código de la aplicación");
  assert.ok(
    !fuentes.some((f) => f.includes(`${join("src", "generated")}`)),
    "el cliente generado no debe auditarse"
  );
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
