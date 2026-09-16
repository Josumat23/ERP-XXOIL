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
import { avisoParcial, errorDeFiltroVacio, seleccionarPruebas } from "./lib/pruebas.mjs";

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

// ---------------------------------------------------------------------------
// Filtro: `npm test -- respaldo` corre solo los archivos que lo contengan.
//
// Existe por una cuenta concreta. Los días 15 y 16 de septiembre la suite
// completa se corrió unas diez veces, ~8 minutos cada una, y la mayoría fue
// para comprobar arreglos de dos líneas: un mensaje de error, un número mal
// contado. Sin filtro, verificar un cambio de dos líneas cuesta lo mismo que
// verificar el sistema entero, así que o se paga de más o se verifica de menos.
//
// Dos cosas que el filtro NO puede hacer, porque serían peores que no tenerlo:
//
//   1. Pasar en silencio cuando no encuentra nada. Un filtro mal escrito
//      correría cero pruebas y terminaría en verde, que es exactamente la
//      forma de creer que algo está probado cuando no lo está.
//   2. Parecerse a una corrida completa. Una corrida filtrada en verde NO
//      autoriza a publicar nada, así que lo dice al empezar y al terminar.
// ---------------------------------------------------------------------------
const todos = readdirSync(resolve(workspace, "tests"))
  .filter((nombre) => nombre.endsWith(".test.ts"))
  .sort();
const seleccion = seleccionarPruebas(todos, process.argv.slice(2));

const errorFiltro = errorDeFiltroVacio(seleccion, todos.length);
if (errorFiltro) throw new Error(errorFiltro);

const archivosPruebas = seleccion.archivos.map((nombre) => resolve(workspace, "tests", nombre));

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

const PARCIAL = avisoParcial(seleccion, todos.length);

if (seleccion.parcial) console.log(`\n[tests] ${PARCIAL}`);

console.log(`\n[tests] Creando la base efímera ${nombreBase}`);
await crearBase(plantilla, nombreBase);

try {
  console.log("\n[tests] Aplicando migraciones");
  aplicarMigraciones(databaseUrl, workspace);
  ejecutar("Cargando datos maestros mínimos", ["--import", "tsx", "prisma/seed.ts"]);
  ejecutar(
    seleccion.parcial
      ? `Ejecutando ${seleccion.archivos.length} de ${todos.length} archivos`
      : "Ejecutando ciclos críticos",
    ["--import", "tsx", "--test", "--test-concurrency=1", ...archivosPruebas]
  );
  // Al final y no solo al principio: después de cientos de líneas de salida,
  // lo que queda a la vista es esto. Una corrida filtrada en verde no autoriza
  // a publicar nada.
  if (seleccion.parcial) console.log(`\n[tests] ${PARCIAL}`);
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
