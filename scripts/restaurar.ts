// Restauración de un respaldo. Se ejecuta con `npm run restaurar` (ver
// `scripts/restaurar.mjs`, que lanza este archivo bajo tsx). Uso:
//   npm run restaurar -- --respaldo <archivo> --destino <destino> [--forzar]
//
// El destino depende del motor del respaldo: una RUTA para un `.db` de SQLite,
// una URL de conexión para un `.dump` de PostgreSQL.
//
// Sin --forzar se niega a pisar un destino que ya tenga contenido. El destino
// se indica SIEMPRE de forma explícita: este script no deduce que hay que
// restaurar encima de la base viva.
// Hoy este script no lee `DATABASE_URL` —el destino se indica siempre de forma
// explícita— pero carga `.env` igual: la regla de que todo punto de entrada lo
// cargue es incondicional a propósito. Decidir archivo por archivo quién lo
// necesita es justamente como se escaparon `server.ts` y los sembradores.
import "dotenv/config";
import { controladorDeArtefacto, restaurarRespaldo } from "@/lib/respaldo";

function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const respaldo = argumento("respaldo");
const destino = argumento("destino");
const forzar = process.argv.includes("--forzar");

if (!respaldo || !destino) {
  console.error(
    "Uso: npm run restaurar -- --respaldo <archivo> --destino <destino> [--forzar]\n" +
      "  El destino es una RUTA para un respaldo .db (SQLite) y una URL de conexión\n" +
      "  para uno .dump (PostgreSQL)."
  );
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
  // Qué es la comprobación depende del motor —el SHA256 del archivo en SQLite,
  // cuántas tablas quedaron en PostgreSQL— y en los dos casos es una medición
  // del destino después de escribir, no una promesa de que salió bien.
  console.log(`  Comprobación: ${resultado.comprobacion}`);
}

principal(respaldo, destino).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
