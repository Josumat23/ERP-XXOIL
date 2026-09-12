// Respaldo manual de la base. Se ejecuta con `npm run respaldo` (ver
// `scripts/respaldo.mjs`, que lanza este archivo bajo tsx). Uso:
//   npm run respaldo -- [--dir <directorio>] [--retencion <n>]
//
// Sin --dir toma RESPALDO_DIR. El origen sale de DATABASE_URL: este script
// nunca adivina qué base respaldar.
import { crearRespaldo, resolverOrigen, type OrigenRespaldo } from "@/lib/respaldo";

function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const directorio = argumento("dir") ?? process.env.RESPALDO_DIR;
const retencion = Number(argumento("retencion") ?? process.env.RESPALDO_RETENCION ?? 7);
// El motor sale de DATABASE_URL. Si es uno reconocido pero todavía sin
// controlador, el error de crearRespaldo dice exactamente qué falta.
const origen = resolverOrigen(process.env.DATABASE_URL);

if (!directorio) {
  console.error("Falta el directorio de respaldo: use --dir <ruta> o defina RESPALDO_DIR.");
  process.exit(1);
}
if (!origen) {
  console.error("DATABASE_URL no declara un motor de base reconocido.");
  process.exit(1);
}

// En una función y no en el nivel superior: tsx compila estos scripts a CJS,
// donde el `await` suelto no existe.
async function principal(origen: OrigenRespaldo, directorio: string) {
  const resumen = await crearRespaldo({ origen, directorio, retencion });
  console.log(`Respaldo verificado: ${resumen.archivo}`);
  console.log(`  Tamaño: ${(resumen.bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  SHA256: ${resumen.sha256}`);
  if (resumen.eliminados.length > 0) {
    console.log(`  Eliminados por retención (${retencion}): ${resumen.eliminados.join(", ")}`);
  }
}

principal(origen, directorio).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
