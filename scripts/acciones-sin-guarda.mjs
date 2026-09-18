// Informe legible de `scripts/lib/guardasDeAcciones.mjs`.
//
//   npm run acciones:sin-guarda
//
// No necesita base ni servidor: lee el código. La misma auditoría corre dentro
// de `npm test`; esto es para verla, y para poder pedirle el detalle con
// `--detalle` cuando uno quiere revisar a mano qué guarda tiene cada acción.
//
// Carga el entorno aunque no lo use: la regla de que todo punto de entrada lo
// cargue es incondicional a propósito — ver `tests/base-por-configuracion`.
import "dotenv/config";
import { auditarAcciones, archivosDeFuente } from "./lib/guardasDeAcciones.mjs";

const raiz = process.cwd();
const { acciones, exentas, sinAutenticar, sinAutorizar } = auditarAcciones({
  raiz,
  archivos: archivosDeFuente(raiz),
});

const enLinea = acciones.filter((a) => a.nombre.startsWith("enLinea")).length;
console.log(
  `\n${acciones.length} server action(s): ${acciones.length - enLinea} de archivo, ${enLinea} en línea.`
);
for (const e of exentas) console.log(`  — exenta: ${e.ruta}:${e.linea} ${e.nombre} (${e.motivo})`);

if (process.argv.includes("--detalle")) {
  for (const a of [...acciones].sort((x, y) => x.ruta.localeCompare(y.ruta))) {
    console.log(`  ${a.autentica ? "✔" : "✖"}${a.autoriza ? "✔" : "✖"} ${a.ruta}:${a.linea} ${a.nombre}`);
  }
}

const problemas = [
  ["sin autenticar (no se sabe quién llama)", sinAutenticar],
  ["autenticadas pero sin comprobar rol ni permiso", sinAutorizar],
].filter(([, lista]) => lista.length > 0);

if (problemas.length === 0) {
  console.log("\n✔ Todas autentican y comprueban rol o permiso.");
  process.exit(0);
}
for (const [titulo, lista] of problemas) {
  console.error(`\n✖ ${lista.length} ${titulo}:`);
  for (const a of lista) console.error(`   ${a.ruta}:${a.linea} → ${a.nombre}`);
}
console.error(
  "\nUna server action es un endpoint POST público. Si alguna no puede tener\n" +
    "guarda, agréguela a EXENTAS en scripts/lib/guardasDeAcciones.mjs con el motivo."
);
process.exit(1);
