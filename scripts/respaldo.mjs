// Lanzador de `npm run respaldo`. El trabajo real está en `respaldo.ts`.
//
// Existe porque `node` a secas no resuelve TypeScript ni el alias `@/`: hay que
// arrancar un proceso con `--import tsx`. Definir NODE_OPTIONS dentro del
// proceso que ya arrancó no sirve —Node la lee al iniciar—, así que el trabajo
// va a un hijo, igual que en el runner de pruebas y en la demo.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const bootstrap = pathToFileURL(resolve("scripts/tsx-windows-bootstrap.mjs")).href;

const resultado = spawnSync(
  process.execPath,
  ["--import", "tsx", resolve("scripts/respaldo.ts"), ...process.argv.slice(2)],
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
