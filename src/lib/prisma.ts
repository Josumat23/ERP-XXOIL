import { isAbsolute, relative, resolve } from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { urlBaseRequerida } from "@/lib/databaseUrl";
import { crearAdaptador } from "@/lib/adaptadorBase";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Sin valor por defecto, a propósito: ver `src/lib/databaseUrl.ts`. Es
// exactamente lo que hacía `npm run dev` antes del 2026-09-14, porque
// `server.ts` no cargaba `.env` antes de importar este módulo.
const urlBase = urlBaseRequerida();

/** ¿La base vive dentro del repositorio? Solo tiene sentido para SQLite. */
function baseDentroDelRepositorio(url: string): boolean {
  if (!url.startsWith("file:")) return false;
  const archivo = resolve(url.slice("file:".length).split("?")[0]);
  const relativa = relative(process.cwd(), archivo);
  return relativa !== "" && !relativa.startsWith("..") && !isAbsolute(relativa);
}

/** El nombre de la base en una URL de PostgreSQL. */
export function nombreBasePostgres(url: string): string | null {
  if (!/^postgres(ql)?:\/\//.test(url)) return null;
  try {
    const ruta = new URL(url).pathname.replace(/^\//, "");
    return ruta.length > 0 ? ruta : null;
  } catch {
    return null;
  }
}

/** Prefijo obligatorio de las bases que crea y destruye el runner. */
export const PREFIJO_BASE_PRUEBAS = "erp_test_";

// ---------------------------------------------------------------------------
// Ninguna prueba se conecta a una base que no sea suya.
//
// El criterio cambió al migrar a PostgreSQL, y el motivo del cambio importa.
//
// Con SQLite la regla era «la base no puede estar dentro del repositorio»,
// porque las protegidas —`dev.db` y sus respaldos— son archivos que viven ahí.
// Con una URL de conexión no hay ruta que mirar, así que esa regla habría
// quedado siempre en falso: presente, verde, y sin proteger nada.
//
// La regla nueva es al revés y más estricta: bajo el runner, la base **tiene
// que llamarse** `erp_test_…`, que es lo único que `run-tests.mjs` crea y
// destruye. Cualquier otra cosa —`erp_dev`, la base de alguien más, una de
// producción por un `.env` mal puesto— se rechaza.
//
// Se comprueba antes de construir el adaptador, para no abrir la conexión ni
// siquiera un instante. Y se conserva la regla de SQLite porque el módulo de
// respaldo sigue trabajando con archivos.
// ---------------------------------------------------------------------------
if (process.env.NODE_TEST_CONTEXT) {
  const nombre = nombreBasePostgres(urlBase);

  if (baseDentroDelRepositorio(urlBase)) {
    throw new Error(
      `Una prueba intentó conectarse a ${urlBase}, que está dentro del repositorio. ` +
        "Las bases del repositorio están protegidas y conectarse ya cambia el archivo. " +
        "Ejecute la suite con `node scripts/run-tests.mjs` (o `npm test`)."
    );
  }

  if (nombre !== null && !nombre.startsWith(PREFIJO_BASE_PRUEBAS)) {
    throw new Error(
      `Una prueba intentó conectarse a la base «${nombre}», que no es una base de pruebas. ` +
        `Bajo el runner solo se admiten bases con el prefijo «${PREFIJO_BASE_PRUEBAS}», que son ` +
        "las que `scripts/run-tests.mjs` crea y destruye. Ejecute la suite con `npm test`."
    );
  }
}

const adapter = crearAdaptador(urlBase);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
