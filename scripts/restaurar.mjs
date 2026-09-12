// Lanzador de `npm run restaurar`. El trabajo real está en `restaurar.ts`.
//
// Existe por la misma razón que `respaldo.mjs`: `node` a secas no resuelve
// TypeScript ni el alias `@/`, y NODE_OPTIONS solo tiene efecto en un proceso
// que todavía no arrancó.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const bootstrap = pathToFileURL(resolve("scripts/tsx-windows-bootstrap.mjs")).href;

const resultado = spawnSync(
  process.execPath,
  ["--import", "tsx", resolve("scripts/restaurar.ts"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${bootstrap}`].filter(Boolean).join(" "),
    },
  }
);

if (resultado.error) throw resultado.error;
process.exit(resultado.status ?? 1);
