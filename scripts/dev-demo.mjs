// Levanta el servidor de desarrollo contra una base DESECHABLE, nunca contra
// la base real. Uso:
//   npm run dev:demo            (reutiliza la base demo si ya existe)
//   npm run dev:demo -- --reset (la recrea desde cero)
//
// Existe para poder revisar la aplicación en el navegador sin apuntar a la
// base de desarrollo. La base demo se llama `erp_demo` y este script IGNORA el
// nombre de base que traiga `DATABASE_URL`: la variable se usa solo como
// PLANTILLA de conexión —máquina, puerto y credenciales— para que una variable
// heredada no pueda redirigirlo a una base que no es la suya.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import "dotenv/config";
import {
  PREFIJO_BASE_DEMO,
  aplicarMigraciones,
  crearBase,
  eliminarBase,
  esUrlPostgres,
  existeBase,
  urlConBase,
} from "./lib/postgres.mjs";

const require = createRequire(import.meta.url);
const raiz = resolve(process.cwd());
const plantilla = process.env.DATABASE_URL;
const NOMBRE_BASE = PREFIJO_BASE_DEMO;

if (!plantilla || !esUrlPostgres(plantilla)) {
  console.error(
    "[demo] DATABASE_URL tiene que ser una conexión de PostgreSQL: se usa como plantilla " +
      "(máquina, puerto y credenciales) para la base demo. Ver docs/postgresql.md."
  );
  process.exit(1);
}

const databaseUrl = urlConBase(plantilla, NOMBRE_BASE);

if (process.argv.includes("--reset") && (await existeBase(plantilla, NOMBRE_BASE))) {
  await eliminarBase(plantilla, NOMBRE_BASE, PREFIJO_BASE_DEMO);
  console.log("[demo] Base anterior eliminada.");
}

const recienCreada = !(await existeBase(plantilla, NOMBRE_BASE));
if (recienCreada) await crearBase(plantilla, NOMBRE_BASE);

// Reutilizar una base creada antes de una migración nueva levantaría el
// servidor contra un esquema incompleto, y el error recién aparecería al abrir
// la pantalla afectada. Antes hacía falta un registro propio —una tabla
// `_demo_migraciones` mantenida a mano— porque la suite aplicaba los SQL
// sueltos; ahora aplica Prisma, que lleva el suyo en `_prisma_migrations` y
// sabe cuáles faltan.
aplicarMigraciones(databaseUrl, raiz);

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

console.log(`[demo] Base: ${NOMBRE_BASE}`);
console.log("[demo] Usuario inicial: admin / cambiar123");

const servidor = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "server.ts", "--dev"], {
  cwd: raiz,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});
servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
