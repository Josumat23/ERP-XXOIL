import { isAbsolute, relative, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const urlBase = process.env.DATABASE_URL ?? "file:./dev.db";

/** ¿La base vive dentro del repositorio? */
function baseDentroDelRepositorio(url: string): boolean {
  if (!url.startsWith("file:")) return false;
  const archivo = resolve(url.slice("file:".length).split("?")[0]);
  const relativa = relative(process.cwd(), archivo);
  return relativa !== "" && !relativa.startsWith("..") && !isAbsolute(relativa);
}

// ---------------------------------------------------------------------------
// Ninguna prueba se conecta a una base del repositorio.
//
// `dev.db` y sus respaldos están protegidos: no se abren, ni se migran, ni se
// modifican. El runner (`scripts/run-tests.mjs`) apunta siempre a una base
// efímera en el temporal del sistema, así que bajo él esta comprobación no
// hace nada. Lo que sí ataja es ejecutar `npx tsx --test <archivo>` a mano:
// ese proceso hereda la `DATABASE_URL` del `.env`, que es `dev.db`.
//
// Y no alcanza con que la prueba limpie lo que creó. SQLite reutiliza páginas,
// así que insertar y borrar deja el archivo con otros bytes —otro SHA256— que
// ya no vuelve al original. Por eso la negativa es a conectarse, y no a
// escribir.
//
// Se comprueba antes de construir el adaptador, para no abrir el archivo ni
// siquiera un instante.
// ---------------------------------------------------------------------------
if (process.env.NODE_TEST_CONTEXT && baseDentroDelRepositorio(urlBase)) {
  throw new Error(
    `Una prueba intentó conectarse a ${urlBase}, que está dentro del repositorio. ` +
      "Las bases del repositorio están protegidas y conectarse ya cambia el archivo. " +
      "Ejecute la suite con `node scripts/run-tests.mjs` (o `npm test`), que crea una " +
      "base efímera en el temporal del sistema y le aplica las migraciones."
  );
}

const adapter = new PrismaBetterSqlite3({ url: urlBase });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
