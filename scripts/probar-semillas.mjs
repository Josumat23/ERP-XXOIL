// ---------------------------------------------------------------------------
// Los sembradores, desde una base VACÍA.
//
// `seed-trazabilidad.ts` se escribió y se probó siempre contra `erp_dev`, que
// ya tenía compras, ventas, clientes y facturas. Correrlo desde cero por
// primera vez encontró un agujero que ninguna prueba veía: el caso que la
// pantalla de recall existe para contestar —un lote del proveedor repartido en
// varias recepciones— NO se daba en una instalación recién sembrada. Funcionaba
// en `erp_dev` por una recepción cargada a mano meses antes, no por el
// sembrado. O sea que quien estrenara el sistema no podía ver la función.
//
// Por eso esto es un script y no una comprobación de una sola vez: cada cambio
// en los sembradores puede volver a dejar la demo sin un caso, y a mano nadie
// lo mira.
//
// Usa la misma maquinaria que la suite —base efímera con el prefijo obligado,
// creada al empezar y destruida al terminar pase lo que pase—, así que NUNCA
// toca `erp_dev` ni ninguna base de trabajo.
//
// No va dentro de `npm test` porque sembrar la demo entera tarda, y la suite ya
// dura ocho minutos. Se corre con `npm run semillas:desde-cero` cuando se toca
// un sembrador.
// ---------------------------------------------------------------------------
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  PREFIJO_BASE_PRUEBAS,
  aplicarMigraciones,
  crearBase,
  eliminarBase,
  esUrlPostgres,
  nombreDeUrl,
  urlConBase,
} from "./lib/postgres.mjs";

const raiz = process.cwd();
const plantilla = process.env.DATABASE_URL;
if (!plantilla || !esUrlPostgres(plantilla)) {
  throw new Error(
    "Falta DATABASE_URL o no es una conexión de PostgreSQL. Se usa solo como plantilla: " +
      "de ahí salen la máquina, el puerto y las credenciales; el nombre se reemplaza siempre."
  );
}

const nombreBase = PREFIJO_BASE_PRUEBAS + "semillas_" + randomBytes(5).toString("hex");
if (nombreBase === nombreDeUrl(plantilla)) {
  throw new Error("La base efímera coincide con la configurada: no se crea ni se destruye.");
}
const databaseUrl = urlConBase(plantilla, nombreBase);
const entorno = { ...process.env, DATABASE_URL: databaseUrl };

const SEMBRADORES = [
  ["Maestros mínimos", "prisma/seed.ts"],
  ["Demo comercial", "prisma/seed-demo.ts"],
  ["Calidad", "prisma/seed-calidad.ts"],
  ["Trazabilidad", "prisma/seed-trazabilidad.ts"],
  ["RRHH", "prisma/seed-rrhh.ts"],
  ["Comercial y compras", "prisma/seed-comercial-compras.ts"],
  ["Finanzas y proyectos", "prisma/seed-finanzas-proyectos.ts"],
  // Otra vez: los últimos se corren sobre bases que ya tienen datos, así que
  // tienen que ser idempotentes. Si el segundo pase escribe algo, se ve.
  ["Trazabilidad (otra vez)", "prisma/seed-trazabilidad.ts"],
  ["Calidad (otra vez)", "prisma/seed-calidad.ts"],
  ["RRHH (otra vez)", "prisma/seed-rrhh.ts"],
  ["Comercial y compras (otra vez)", "prisma/seed-comercial-compras.ts"],
  ["Finanzas y proyectos (otra vez)", "prisma/seed-finanzas-proyectos.ts"],
];

function correr(etiqueta, archivo) {
  console.log(`\n[semillas] ${etiqueta} — ${archivo}`);
  const resultado = spawnSync(process.execPath, ["--import", "tsx", resolve(raiz, archivo)], {
    cwd: raiz,
    env: entorno,
    stdio: "inherit",
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`${etiqueta} terminó con código ${resultado.status ?? "desconocido"}.`);
  }
}

console.log(`[semillas] Creando la base efímera ${nombreBase}`);
await crearBase(plantilla, nombreBase);
try {
  console.log("\n[semillas] Aplicando migraciones");
  aplicarMigraciones(databaseUrl, raiz);
  for (const [etiqueta, archivo] of SEMBRADORES) correr(etiqueta, archivo);
  correr("Comprobando que la demo trae los casos", "scripts/casos-de-la-demo.ts");
  console.log("\n✔ Los sembradores corren desde cero y la demo trae sus casos.");
} finally {
  await eliminarBase(plantilla, nombreBase, PREFIJO_BASE_PRUEBAS);
  console.log(`[semillas] Base efímera ${nombreBase} eliminada.`);
}
