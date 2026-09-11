// Respaldo manual de la base. Uso:
//   npm run respaldo -- [--dir <directorio>] [--retencion <n>]
//
// Sin --dir toma RESPALDO_DIR. El origen sale de DATABASE_URL: este script
// nunca adivina qué base respaldar.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const bootstrap = pathToFileURL(resolve("scripts/tsx-windows-bootstrap.mjs")).href;
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import=${bootstrap}`]
  .filter(Boolean)
  .join(" ");

const { crearRespaldo, rutaDesdeUrlSqlite } = await import("../src/lib/respaldo.ts");

function argumento(nombre) {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const directorio = argumento("dir") ?? process.env.RESPALDO_DIR;
const retencion = Number(argumento("retencion") ?? process.env.RESPALDO_RETENCION ?? 7);
const origen = rutaDesdeUrlSqlite(process.env.DATABASE_URL);

if (!directorio) {
  console.error("Falta el directorio de respaldo: use --dir <ruta> o defina RESPALDO_DIR.");
  process.exit(1);
}
if (!origen) {
  console.error("DATABASE_URL no apunta a un archivo SQLite.");
  process.exit(1);
}

const resumen = await crearRespaldo({ origen, directorio, retencion });
console.log(`Respaldo verificado: ${resumen.archivo}`);
console.log(`  Tamaño: ${(resumen.bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  SHA256: ${resumen.sha256}`);
if (resumen.eliminados.length > 0) {
  console.log(`  Eliminados por retención (${retencion}): ${resumen.eliminados.join(", ")}`);
}
