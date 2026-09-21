// Informe legible de `scripts/lib/rolesDeLasAcciones.mjs`.
//
//   npm run acciones:sin-pantalla
//
// Lee el código: no necesita base ni servidor. Carga el entorno aunque no lo
// use, porque la regla de que todo punto de entrada lo cargue es incondicional
// a propósito — ver `tests/base-por-configuracion`.
import "dotenv/config";
import { accionesSinPantalla, PENDIENTES_DE_DECISION } from "./lib/rolesDeLasAcciones.mjs";
import { rolesDeLaPantalla } from "../src/lib/accesoPantalla.ts";

const raiz = process.cwd();
const { revisados, hallazgos } = accionesSinPantalla({ raiz, rolesDePantalla: rolesDeLaPantalla });

console.log(`\n${revisados} archivo(s) de acciones bajo una pantalla con roles declarados.`);

const esperando = new Set(PENDIENTES_DE_DECISION.map((p) => p.href));
const nuevos = hallazgos.filter((h) => !esperando.has(h.href));

for (const p of PENDIENTES_DE_DECISION) {
  console.log(`  — esperando decisión: ${p.href} (${p.motivo})`);
}

if (nuevos.length === 0) {
  console.log("\n✔ Ninguna acción nueva admite un rol que no puede abrir su pantalla.");
  process.exit(0);
}

console.error(`\n✖ ${nuevos.length} acción(es) que admiten un rol que no puede abrir la pantalla:`);
for (const h of nuevos) {
  console.error(
    `   ${h.ruta}:${h.linea}\n      admite [${h.sobran.join(", ")}] y la pantalla la ven [${h.puedenVer.join(", ")}]`
  );
}
console.error(
  "\nPoder sin ver no tiene lectura razonable: es un POST sin pantalla que lo\n" +
    "respalde, y la pantalla le queda inservible a quien sí la abre."
);
process.exit(1);
