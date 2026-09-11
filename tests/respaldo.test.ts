import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import {
  crearRespaldo,
  esNombreRespaldo,
  nombreRespaldo,
  respaldosAEliminar,
  restaurarRespaldo,
  rutaDentroDe,
  rutaDesdeUrlSqlite,
  sha256DeArchivo,
  verificarIntegridad,
} from "@/lib/respaldo";

// El respaldo se ejerce SIEMPRE contra bases efímeras en el temporal del
// sistema. Ninguna prueba abre ni copia la base de desarrollo.
async function baseTemporal() {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-"));
  const archivo = join(directorio, "origen.db");
  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
  });
  await cliente.$executeRawUnsafe("CREATE TABLE prueba (id INTEGER PRIMARY KEY, valor TEXT)");
  await cliente.$executeRawUnsafe("INSERT INTO prueba (id, valor) VALUES (1, 'antes')");
  await cliente.$disconnect();
  return { directorio, archivo };
}

async function leerValor(archivo: string): Promise<string | undefined> {
  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
  });
  try {
    const filas = await cliente.$queryRawUnsafe<{ valor: string }[]>(
      "SELECT valor FROM prueba WHERE id = 1"
    );
    return filas[0]?.valor;
  } finally {
    await cliente.$disconnect();
  }
}

test("el nombre del respaldo ordena alfabéticamente en orden cronológico", () => {
  const enero = nombreRespaldo(new Date(2026, 0, 5, 3, 7, 9));
  const marzo = nombreRespaldo(new Date(2026, 2, 5, 3, 7, 9));
  assert.equal(enero, "erp-20260105-030709.db");
  assert.ok(enero < marzo);
  assert.equal(esNombreRespaldo(enero), true);
  assert.equal(esNombreRespaldo("otra-cosa.db"), false);
  assert.equal(esNombreRespaldo("erp-20260105-030709.db.parcial"), false);
});

test("la retención conserva los más nuevos y nunca borra todo por error", () => {
  const nombres = [
    "erp-20260101-000000.db",
    "erp-20260102-000000.db",
    "erp-20260103-000000.db",
    "ruido.txt",
  ];
  assert.deepEqual(respaldosAEliminar(nombres, 2), ["erp-20260101-000000.db"]);
  assert.deepEqual(respaldosAEliminar(nombres, 5), []);
  // Retención inválida o cero: no se borra nada. "No conservar ninguno" casi
  // siempre es un error de configuración, no una instrucción.
  assert.deepEqual(respaldosAEliminar(nombres, 0), []);
  assert.deepEqual(respaldosAEliminar(nombres, -1), []);
  assert.deepEqual(respaldosAEliminar(nombres, 1.5), []);
});

test("la ruta de respaldo se valida contra el escape de directorio", () => {
  assert.equal(rutaDentroDe("/respaldos/erp.db", "/respaldos"), true);
  assert.equal(rutaDentroDe("/respaldos/../otro/erp.db", "/respaldos"), false);
  assert.equal(rutaDentroDe("/respaldos", "/respaldos"), false);
});

test("la ruta del archivo se extrae de la URL de SQLite", () => {
  assert.equal(rutaDesdeUrlSqlite("file:./dev.db"), "./dev.db");
  assert.equal(rutaDesdeUrlSqlite("file:C:/datos/erp.db?mode=rwc"), "C:/datos/erp.db");
  assert.equal(rutaDesdeUrlSqlite("postgresql://host/db"), null);
  assert.equal(rutaDesdeUrlSqlite(undefined), null);
  assert.equal(rutaDesdeUrlSqlite("file:"), null);
});

test("el respaldo produce una copia verificada, con manifiesto y retención", async () => {
  const { directorio, archivo } = await baseTemporal();
  const destino = join(directorio, "respaldos");
  try {
    const resumen = await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 1, 1, 0, 0),
    });

    assert.ok(resumen.bytes > 0);
    assert.equal(resumen.sha256, await sha256DeArchivo(resumen.archivo));
    assert.equal(await verificarIntegridad(resumen.archivo), true);
    // La copia trae los datos, no solo el esquema.
    assert.equal(await leerValor(resumen.archivo), "antes");

    const manifiesto = await readFile(`${resumen.archivo}.sha256`, "utf8");
    assert.match(manifiesto, new RegExp(resumen.sha256));

    // El origen queda intacto: VACUUM INTO no lo modifica.
    assert.equal(await leerValor(archivo), "antes");

    // Con retención 2, el tercer respaldo elimina el primero.
    await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 2, 1, 0, 0),
    });
    const tercero = await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 3, 1, 0, 0),
    });
    assert.deepEqual(tercero.eliminados, ["erp-20260101-010000.db"]);

    const quedan = (await readdir(destino)).filter(esNombreRespaldo).sort();
    assert.deepEqual(quedan, ["erp-20260102-010000.db", "erp-20260103-010000.db"]);
    // El manifiesto del eliminado se va con él, no queda huérfano.
    assert.equal((await readdir(destino)).includes("erp-20260101-010000.db.sha256"), false);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("la restauración devuelve los datos del respaldo y respeta las protecciones", async () => {
  const { directorio, archivo } = await baseTemporal();
  const destino = join(directorio, "respaldos");
  try {
    const resumen = await crearRespaldo({ origen: archivo, directorio: destino, retencion: 5 });

    // La base viva cambia DESPUÉS del respaldo.
    const cliente = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
    });
    await cliente.$executeRawUnsafe("UPDATE prueba SET valor = 'despues' WHERE id = 1");
    await cliente.$disconnect();
    assert.equal(await leerValor(archivo), "despues");

    // Restaurar sobre un archivo existente exige confirmación explícita.
    await assert.rejects(
      restaurarRespaldo({ respaldo: resumen.archivo, destino: archivo }),
      /exige confirmarlo explícitamente/
    );
    assert.equal(await leerValor(archivo), "despues");

    // Restaurar sobre sí mismo se rechaza antes de tocar nada.
    await assert.rejects(
      restaurarRespaldo({ respaldo: resumen.archivo, destino: resumen.archivo, forzar: true }),
      /el mismo archivo/
    );

    // En una ruta nueva no hace falta forzar, y el dato vuelve al estado del respaldo.
    const copia = join(directorio, "restaurado.db");
    await restaurarRespaldo({ respaldo: resumen.archivo, destino: copia });
    assert.equal(await leerValor(copia), "antes");

    // Y con confirmación explícita, la base viva vuelve al estado respaldado:
    // este es el procedimiento de recuperación, ejercido de punta a punta.
    await restaurarRespaldo({ respaldo: resumen.archivo, destino: archivo, forzar: true });
    assert.equal(await leerValor(archivo), "antes");
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("un respaldo corrupto no se restaura", async () => {
  const { directorio, archivo } = await baseTemporal();
  try {
    const corrupto = join(directorio, "corrupto.db");
    await writeFile(corrupto, "esto no es una base SQLite", "utf8");
    await assert.rejects(
      restaurarRespaldo({ respaldo: corrupto, destino: join(directorio, "nuevo.db") }),
      /no se restauró nada|integridad/
    );
    // El origen sigue intacto tras el intento fallido.
    assert.equal(await leerValor(archivo), "antes");
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("la tarea de respaldo no corre sin RESPALDO_DIR configurado", async () => {
  // Instalar una versión nueva no debe empezar a escribir copias en una ruta
  // que nadie eligió.
  const tareas = await readFile(resolve(process.cwd(), "src/lib/tareasProgramadas.ts"), "utf8");
  assert.match(tareas, /RESPALDO_DIR/);
  assert.match(tareas, /Respaldo no configurado/);
  assert.match(tareas, /RESPALDO_BASE: ejecutarRespaldoBase/);
});
