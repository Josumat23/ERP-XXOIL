// Levanta el servidor de desarrollo contra una base DESECHABLE, nunca contra
// la base real. Uso:
//   npm run dev:demo            (reutiliza la base demo si ya existe)
//   npm run dev:demo -- --reset (la recrea desde cero)
//
// Existe para poder revisar la aplicación en el navegador sin apuntar a
// `dev.db`. La base demo vive en `.demo/`, está fuera del control de
// versiones, y este script IGNORA cualquier DATABASE_URL del entorno: la
// define él mismo, para que una variable heredada no pueda redirigirlo a una
// base que no es la suya.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const raiz = resolve(process.cwd());
const directorioDemo = join(raiz, ".demo");
const baseDemo = join(directorioDemo, "demo.db");

// Cinturón y tirantes: este script solo puede escribir dentro de `.demo/`.
if (!baseDemo.startsWith(directorioDemo) || basename(baseDemo) !== "demo.db") {
  throw new Error(`Ruta de base demo inesperada: ${baseDemo}`);
}

const reiniciar = process.argv.includes("--reset");
if (reiniciar && existsSync(directorioDemo)) {
  rmSync(directorioDemo, { recursive: true, force: true });
  console.log("[demo] Base anterior eliminada.");
}
mkdirSync(directorioDemo, { recursive: true });

const databaseUrl = "file:" + baseDemo.replaceAll("\\", "/");
const recienCreada = !existsSync(baseDemo);

// Registro de migraciones aplicadas a la base demo. Sin esto, reutilizar una
// base creada antes de una migración nueva levanta el servidor contra un
// esquema incompleto, y el error recién aparece al abrir la pantalla afectada.
//
// Ante una base anterior al registro NO se intenta adivinar qué migraciones
// corrieron: deducirlo del mensaje de error de SQLite ("already exists",
// "duplicate column"...) enmascararía un fallo real. La base demo es
// desechable, así que se pide recrearla.
function aplicarMigracionesPendientes() {
  const Database = require("better-sqlite3");
  const db = new Database(baseDemo);
  const aplicadas = [];
  try {
    const tieneEsquema = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'empresas'")
      .get();
    const tieneRegistro = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_demo_migraciones'")
      .get();
    if (tieneEsquema && !tieneRegistro) {
      throw new Error(
        "La base demo es anterior al registro de migraciones y no se puede actualizar con seguridad.\n" +
          "Recréela con:  npm run dev:demo -- --reset"
      );
    }

    db.exec('CREATE TABLE IF NOT EXISTS "_demo_migraciones" ("nombre" TEXT NOT NULL PRIMARY KEY)');
    const yaAplicada = db.prepare('SELECT 1 FROM "_demo_migraciones" WHERE "nombre" = ?');
    const registrar = db.prepare('INSERT INTO "_demo_migraciones" ("nombre") VALUES (?)');
    for (const nombre of readdirSync(join(raiz, "prisma/migrations")).sort()) {
      const archivo = join(raiz, "prisma/migrations", nombre, "migration.sql");
      if (!existsSync(archivo)) continue;
      if (yaAplicada.get(nombre)) continue;
      db.exec(readFileSync(archivo, "utf8"));
      registrar.run(nombre);
      aplicadas.push(nombre);
    }
  } finally {
    db.close();
  }
  return aplicadas;
}

let pendientes = [];
try {
  pendientes = aplicarMigracionesPendientes();
} catch (error) {
  console.error(`[demo] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
if (pendientes.length > 0 && !recienCreada) {
  console.log(`[demo] Migraciones nuevas aplicadas: ${pendientes.join(", ")}`);
}

if (recienCreada) {
  console.log("[demo] Sembrando datos de demostración…");
  const bootstrap = pathToFileURL(join(raiz, "scripts/tsx-windows-bootstrap.mjs")).href;
  const entorno = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${bootstrap}`].filter(Boolean).join(" "),
  };
  // La tercera semilla puebla una SEGUNDA compañía, para poder revisar el
  // aislamiento con dos compañías que ambas tienen datos. Se omite con
  // --sin-segunda-empresa.
  const semillas = ["prisma/seed.ts", "prisma/seed-demo.ts"];
  if (!process.argv.includes("--sin-segunda-empresa")) semillas.push("prisma/seed-segunda-empresa.ts");
  for (const semilla of semillas) {
    if (!existsSync(join(raiz, semilla))) continue;
    const resultado = spawnSync(process.execPath, ["--import", "tsx", semilla], {
      cwd: raiz,
      env: entorno,
      stdio: "inherit",
    });
    if (resultado.status !== 0) {
      throw new Error(`${semilla} terminó con código ${resultado.status ?? "desconocido"}.`);
    }
  }
}

console.log(`[demo] Base: ${baseDemo}`);
console.log("[demo] Usuario inicial: admin / cambiar123");

const servidor = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "server.ts", "--dev"], {
  cwd: raiz,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});
servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
