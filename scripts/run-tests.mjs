// La suite corre contra una base de PostgreSQL EFÍMERA, creada al empezar y
// destruida al terminar, pase lo que pase.
//
// Hasta el 2026-09-15 esa base era un archivo SQLite en el directorio temporal
// del sistema y la garantía era «el archivo está fuera del repositorio». Con
// PostgreSQL no hay archivo: la garantía pasa a ser el NOMBRE. Cada corrida
// inventa `erp_test_<azar>`, y tanto este script como `src/lib/prisma.ts`
// exigen ese prefijo — el script para poder destruirla, el cliente para poder
// conectarse. Una prueba que apunte a `erp_dev`, o a la base de alguien más
// por un `.env` heredado, falla antes de abrir la conexión.
//
// `DATABASE_URL` se usa solo como PLANTILLA: de ahí salen la máquina, el
// puerto y las credenciales; el nombre de la base se reemplaza siempre.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  PREFIJO_BASE_PRUEBAS,
  aplicarMigraciones,
  crearBase,
  eliminarBase,
  esUrlPostgres,
  nombreDeUrl,
  otrasBasesDePruebas,
  urlConBase,
} from "./lib/postgres.mjs";

const workspace = resolve(process.cwd());
const plantilla = process.env.DATABASE_URL;

if (!plantilla || plantilla.trim() === "") {
  throw new Error(
    "Falta DATABASE_URL. La suite la usa como plantilla de conexión: de ahí salen la máquina, " +
      "el puerto y las credenciales del PostgreSQL contra el que se crea la base de pruebas. " +
      "Defínala en `.env` (ver docs/postgresql.md)."
  );
}
if (!esUrlPostgres(plantilla)) {
  throw new Error(
    `DATABASE_URL apunta a ${plantilla}, que no es una conexión de PostgreSQL. ` +
      "El proyecto migró a PostgreSQL el 2026-09-15; las migraciones de SQLite quedaron " +
      "archivadas en `prisma/migraciones-sqlite-historico/`. Ver docs/postgresql.md."
  );
}

const nombreBase = PREFIJO_BASE_PRUEBAS + randomBytes(6).toString("hex");
// Cinturón y tirantes: aunque el nombre lo genera esta misma línea, se
// comprueba que no coincida con la base configurada antes de crear nada.
if (nombreBase === nombreDeUrl(plantilla)) {
  throw new Error("La base de pruebas coincide con la configurada: no se crea ni se destruye.");
}

const databaseUrl = urlConBase(plantilla, nombreBase);
const tsxWindowsBootstrap = pathToFileURL(
  resolve(workspace, "scripts/tsx-windows-bootstrap.mjs")
).href;
const nodeOptions = [process.env.NODE_OPTIONS, `--import=${tsxWindowsBootstrap}`]
  .filter(Boolean)
  .join(" ");
const entorno = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test", NODE_OPTIONS: nodeOptions };
const archivosPruebas = readdirSync(resolve(workspace, "tests"))
  .filter((nombre) => nombre.endsWith(".test.ts"))
  .sort()
  .map((nombre) => resolve(workspace, "tests", nombre));

function ejecutar(etiqueta, argumentos) {
  console.log("\n[tests] " + etiqueta);
  const resultado = spawnSync(process.execPath, argumentos, {
    cwd: workspace,
    env: entorno,
    stdio: "inherit",
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(etiqueta + " terminó con código " + (resultado.status ?? "desconocido") + ".");
  }
}

console.log(`\n[tests] Creando la base efímera ${nombreBase}`);
await crearBase(plantilla, nombreBase);

try {
  console.log("\n[tests] Aplicando migraciones");
  aplicarMigraciones(databaseUrl, workspace);
  ejecutar("Cargando datos maestros mínimos", ["--import", "tsx", "prisma/seed.ts"]);
  ejecutar("Ejecutando ciclos críticos", [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    ...archivosPruebas,
  ]);
} finally {
  // Se destruye siempre, incluso si las pruebas fallaron: una base huérfana por
  // corrida fallida llenaría el servidor de `erp_test_…` en una tarde.
  await eliminarBase(plantilla, nombreBase, PREFIJO_BASE_PRUEBAS);
  console.log(`\n[tests] Base ${nombreBase} eliminada.`);

  // Las pruebas del respaldo crean bases auxiliares con el mismo prefijo y las
  // destruyen en su propio `finally`. Si alguna sobrevivió, la corrida murió de
  // mala manera: se avisa en vez de borrarla, porque también podría ser de otra
  // corrida que está pasando ahora mismo.
  const otras = await otrasBasesDePruebas(plantilla, nombreBase);
  if (otras.length > 0) {
    console.log(
      `[tests] Aviso: quedan bases de pruebas de otras corridas: ${otras.join(", ")}.\n` +
        "        Si no hay otra suite corriendo, se pueden borrar sin consecuencias."
    );
  }
}
