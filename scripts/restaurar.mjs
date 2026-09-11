// Restauración de un respaldo. Uso:
//   npm run restaurar -- --respaldo <archivo> --destino <archivo> [--forzar]
//
// Sin --forzar se niega a pisar un archivo existente. El destino se indica
// SIEMPRE de forma explícita: este script no deduce que hay que restaurar
// encima de la base viva.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const bootstrap = pathToFileURL(resolve("scripts/tsx-windows-bootstrap.mjs")).href;
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import=${bootstrap}`]
  .filter(Boolean)
  .join(" ");

const { restaurarRespaldo } = await import("../src/lib/respaldo.ts");

function argumento(nombre) {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const respaldo = argumento("respaldo");
const destino = argumento("destino");
const forzar = process.argv.includes("--forzar");

if (!respaldo || !destino) {
  console.error("Uso: npm run restaurar -- --respaldo <archivo> --destino <archivo> [--forzar]");
  process.exit(1);
}

try {
  const resultado = await restaurarRespaldo({ respaldo, destino, forzar });
  console.log(`Restaurado en ${resultado.destino}`);
  console.log(`  SHA256 del resultado: ${resultado.sha256}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
