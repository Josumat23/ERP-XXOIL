// Restauración de un respaldo. Se ejecuta con `npm run restaurar` (ver
// `scripts/restaurar.mjs`, que lanza este archivo bajo tsx). Uso:
//   npm run restaurar -- --respaldo <archivo> --destino <archivo> [--forzar]
//
// Sin --forzar se niega a pisar un archivo existente. El destino se indica
// SIEMPRE de forma explícita: este script no deduce que hay que restaurar
// encima de la base viva.
import { controladorDeArtefacto, restaurarRespaldo } from "@/lib/respaldo";

function argumento(nombre: string): string | undefined {
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

// En una función y no en el nivel superior: tsx compila estos scripts a CJS,
// donde el `await` suelto no existe.
async function principal(respaldo: string, destino: string) {
  // El motor del artefacto se deduce de su extensión: restaurar un volcado de
  // otro motor con el driver de SQLite fallaría diciendo «no pasó la
  // verificación de integridad», que manda a buscar el problema donde no está.
  const controlador = controladorDeArtefacto(respaldo);
  const resultado = await restaurarRespaldo({ respaldo, destino, forzar, controlador });
  console.log(`Restaurado en ${resultado.destino}`);
  console.log(`  SHA256 del resultado: ${resultado.sha256}`);
}

principal(respaldo, destino).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
