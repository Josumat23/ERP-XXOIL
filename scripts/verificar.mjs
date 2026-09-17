#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Corre localmente lo mismo que corre CI, en el mismo orden.
//
// Existe porque las dos listas no eran la misma y la diferencia costaba ciclos
// de CI enteros: `prisma format --check` solo corría allá, y `lint` corre allá
// con `--max-warnings=0` y acá sin él. Todo lo demás pasaba en verde, el PR se
// abría, y once minutos después fallaba por espacios en el schema.
//
// La lista de abajo tiene que coincidir con `.github/workflows/ci.yml`. No lo
// comprueba este archivo: lo comprueba una prueba
// (`tests/verificacion-local-igual-que-ci.test.ts`), porque un comentario que
// pide mantener dos cosas sincronizadas no sincroniza nada.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Los tipos que `next dev` genera en `.next/dev/types` entran al `tsc` del
// proyecto, y si el servidor los estaba escribiendo quedan truncados: `tsc`
// falla señalando un archivo que nadie escribió. CI nunca los tiene, así que
// borrarlos es parecerse más a CI, no menos. Next los regenera cuando hagan
// falta.
//
// Borrarlos UNA VEZ al arrancar no alcanza —se comprobó—: si el servidor de
// desarrollo sigue vivo, los vuelve a escribir mientras corren los pasos
// previos, y el typecheck se los encuentra de nuevo. Por eso se borran justo
// antes del paso que los lee, y por eso el aviso de abajo.
const limpiarTiposDeDev = () => rmSync(".next/dev/types", { recursive: true, force: true });

const PASOS = [
  { nombre: "Cliente de Prisma", comando: "npx prisma generate" },
  { nombre: "Formato del schema", comando: "npx prisma format --check" },
  { nombre: "Schema válido", comando: "npx prisma validate" },
  { nombre: "Lint", comando: "npm run lint -- --max-warnings=0" },
  {
    nombre: "TypeScript",
    comando: "npx tsc --noEmit",
    antes: limpiarTiposDeDev,
    // Si los errores señalan archivos dentro de `.next/`, no son del código.
    pistaAlFallar:
      "Si los errores señalan archivos dentro de `.next/`, vienen de los tipos que\n" +
      "  genera `next dev`, no de su código: detenga el servidor de desarrollo y repita.",
  },
  { nombre: "Pruebas", comando: "npm test" },
  { nombre: "Build", comando: "npm run build" },
];

limpiarTiposDeDev();

const inicio = Date.now();
const transcurrido = (desde) => `${((Date.now() - desde) / 1000).toFixed(0)} s`;

for (const [indice, paso] of PASOS.entries()) {
  const empezo = Date.now();
  console.log(`\n[${indice + 1}/${PASOS.length}] ${paso.nombre} — ${paso.comando}`);
  paso.antes?.();
  const resultado = spawnSync(paso.comando, { stdio: "inherit", shell: true });

  if (resultado.status !== 0) {
    console.error(
      `\n✖ ${paso.nombre} falló (${transcurrido(empezo)}).\n` +
        `  CI corre exactamente este comando y va a fallar igual.\n` +
        `  Los pasos siguientes no se ejecutaron.\n` +
        (paso.pistaAlFallar ? `\n  ${paso.pistaAlFallar}\n` : "")
    );
    process.exit(resultado.status ?? 1);
  }
  console.log(`✔ ${paso.nombre} (${transcurrido(empezo)})`);
}

console.log(`\n✔ Los ${PASOS.length} pasos que corre CI pasaron acá. Total: ${transcurrido(inicio)}.`);
