import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

const workspace = resolve(process.cwd());
const temporalRaiz = resolve(tmpdir());
const temporal = mkdtempSync(join(temporalRaiz, "erp-xxoil-tests-"));
const baseDatos = join(temporal, "test.db");

function estaDentro(ruta, padre) {
  const relativa = relative(padre, ruta);
  return relativa !== "" && !relativa.startsWith(".." + sep) && relativa !== ".." && !isAbsolute(relativa);
}

if (!estaDentro(temporal, temporalRaiz) || estaDentro(temporal, workspace)) {
  throw new Error("Directorio temporal inseguro: " + temporal);
}

const databaseUrl = "file:" + baseDatos.replaceAll("\\", "/");
const entorno = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };

const tsxCli = resolve(workspace, "node_modules/tsx/dist/cli.mjs");
const archivoPruebas = resolve(workspace, "tests/critical-flows.test.ts");
function aplicarMigraciones() {
  const directorio = resolve(workspace, "prisma/migrations");
  const db = new Database(baseDatos);
  try {
    // La suite ejecuta los SQL versionados directamente para mantener la base
    // efímera fuera del repositorio incluso en Windows. Las migraciones de
    // entornos reales siguen aplicándose con Prisma.
    for (const nombre of readdirSync(directorio).sort()) {
      const archivo = join(directorio, nombre, "migration.sql");
      if (!existsSync(archivo)) continue;
      db.exec(readFileSync(archivo, "utf8"));
    }
  } finally {
    db.close();
  }
}

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

try {
  console.log("\n[tests] Aplicando migraciones a SQLite temporal");
  aplicarMigraciones();
  ejecutar("Cargando datos maestros mínimos", [tsxCli, "prisma/seed.ts"]);
  ejecutar("Ejecutando ciclos críticos", [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    archivoPruebas,
  ]);
} finally {
  const resuelto = resolve(temporal);
  if (!estaDentro(resuelto, temporalRaiz) || estaDentro(resuelto, workspace)) {
    throw new Error("Se rechazó limpiar una ruta insegura: " + resuelto);
  }
  rmSync(resuelto, { recursive: true, force: true });
}
