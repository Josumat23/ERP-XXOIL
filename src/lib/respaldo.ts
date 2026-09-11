import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Respaldo y restauración de la base SQLite.
//
// El respaldo usa `VACUUM INTO`, que es la primitiva correcta para esto: SQLite
// escribe una copia consistente y compactada en un archivo nuevo, sin bloquear
// escrituras ni modificar el origen, y falla si el destino ya existe. Copiar el
// archivo a mano mientras el servidor escribe puede producir una copia rota que
// solo se descubre el día que se necesita.
//
// Nada de esto corre solo: la tarea programada exige RESPALDO_DIR configurado.
// Sin esa variable el sistema no toca ningún archivo.
// ---------------------------------------------------------------------------

export const PREFIJO_RESPALDO = "erp-";
export const EXTENSION_RESPALDO = ".db";
const EXTENSION_MANIFIESTO = ".sha256";

/** Nombre ordenable cronológicamente: el orden alfabético es el orden temporal. */
export function nombreRespaldo(fecha: Date): string {
  const p = (valor: number, ancho = 2) => String(valor).padStart(ancho, "0");
  const marca =
    `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}` +
    `-${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
  return `${PREFIJO_RESPALDO}${marca}${EXTENSION_RESPALDO}`;
}

export function esNombreRespaldo(nombre: string): boolean {
  return nombre.startsWith(PREFIJO_RESPALDO) && nombre.endsWith(EXTENSION_RESPALDO);
}

/**
 * Cuáles sobran al aplicar la retención. Conserva los `retencion` más nuevos;
 * con retención 0 o negativa no borra nada, porque "no conservar ninguno" casi
 * siempre es un error de configuración y no una instrucción.
 */
export function respaldosAEliminar(nombres: readonly string[], retencion: number): string[] {
  if (!Number.isInteger(retencion) || retencion <= 0) return [];
  return nombres
    .filter(esNombreRespaldo)
    .sort()
    .slice(0, Math.max(0, nombres.filter(esNombreRespaldo).length - retencion));
}

/** Una ruta es segura si queda dentro del directorio permitido. */
export function rutaDentroDe(ruta: string, directorio: string): boolean {
  const relativa = relative(resolve(directorio), resolve(ruta));
  return relativa !== "" && !relativa.startsWith(".." + sep) && relativa !== ".." && !isAbsolute(relativa);
}

/** `file:C:/ruta/dev.db` → `C:/ruta/dev.db`. Devuelve null si no es un archivo. */
export function rutaDesdeUrlSqlite(url: string | undefined): string | null {
  if (!url || !url.startsWith("file:")) return null;
  const sinEsquema = url.slice("file:".length).split("?")[0];
  return sinEsquema.length > 0 ? sinEsquema : null;
}

export async function sha256DeArchivo(ruta: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const bloque of createReadStream(ruta)) hash.update(bloque as Buffer);
  return hash.digest("hex").toUpperCase();
}

async function conClienteSqlite<T>(ruta: string, accion: (cliente: PrismaClient) => Promise<T>) {
  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${ruta.replaceAll("\\", "/")}` }),
  });
  try {
    return await accion(cliente);
  } finally {
    await cliente.$disconnect();
  }
}

/**
 * `PRAGMA integrity_check` sobre un archivo suelto. Un archivo que ni siquiera
 * es una base SQLite hace fallar la consulta, y eso también es "no íntegro":
 * quien llama necesita un booleano, no un error del driver.
 */
export async function verificarIntegridad(ruta: string): Promise<boolean> {
  try {
    return await conClienteSqlite(ruta, async (cliente) => {
      const filas = await cliente.$queryRawUnsafe<{ integrity_check: string }[]>(
        "PRAGMA integrity_check"
      );
      return filas.length === 1 && filas[0]?.integrity_check === "ok";
    });
  } catch {
    return false;
  }
}

export type ResumenRespaldo = {
  archivo: string;
  bytes: number;
  sha256: string;
  eliminados: string[];
};

/**
 * Copia consistente del origen dentro de `directorio`, verificada y con
 * manifiesto SHA256. Si la verificación falla, el archivo se descarta: un
 * respaldo corrupto que queda en el directorio es peor que ninguno, porque
 * aparenta cobertura que no existe.
 */
export async function crearRespaldo(opciones: {
  origen: string;
  directorio: string;
  retencion?: number;
  ahora?: Date;
}): Promise<ResumenRespaldo> {
  const { origen, directorio, retencion = 7, ahora = new Date() } = opciones;
  await mkdir(directorio, { recursive: true });

  const destino = join(directorio, nombreRespaldo(ahora));
  const parcial = `${destino}.parcial`;
  // Se escribe con nombre temporal y recién al verificar se renombra, para que
  // el directorio nunca contenga un archivo con nombre de respaldo válido que
  // todavía no sirve.
  await conClienteSqlite(origen, (cliente) =>
    cliente.$executeRawUnsafe(`VACUUM INTO '${parcial.replaceAll("'", "''")}'`)
  );

  if (!(await verificarIntegridad(parcial))) {
    await unlink(parcial).catch(() => {});
    throw new Error("El respaldo recién creado no pasó la verificación de integridad.");
  }

  await rename(parcial, destino);
  const [{ size }, sha256] = await Promise.all([stat(destino), sha256DeArchivo(destino)]);
  await writeFile(`${destino}${EXTENSION_MANIFIESTO}`, `${sha256}  ${nombreRespaldo(ahora)}\n`, "utf8");

  const existentes = await readdir(directorio);
  const eliminados: string[] = [];
  for (const nombre of respaldosAEliminar(existentes, retencion)) {
    await unlink(join(directorio, nombre)).catch(() => {});
    await unlink(join(directorio, `${nombre}${EXTENSION_MANIFIESTO}`)).catch(() => {});
    eliminados.push(nombre);
  }

  return { archivo: destino, bytes: size, sha256, eliminados };
}

/**
 * Restaura un respaldo sobre `destino`. Verifica la integridad ANTES de tocar
 * nada y se niega a pisar un archivo existente salvo que se pida explícitamente
 * — restaurar sobre la base viva es justamente la operación que no debe poder
 * hacerse por accidente.
 */
export async function restaurarRespaldo(opciones: {
  respaldo: string;
  destino: string;
  forzar?: boolean;
}): Promise<{ destino: string; sha256: string }> {
  const { respaldo, destino, forzar = false } = opciones;
  if (resolve(respaldo) === resolve(destino)) {
    throw new Error("El origen y el destino de la restauración son el mismo archivo.");
  }
  if (!(await verificarIntegridad(respaldo))) {
    throw new Error("El respaldo no pasó la verificación de integridad: no se restauró nada.");
  }
  const existe = await stat(destino).then(
    () => true,
    () => false
  );
  if (existe && !forzar) {
    throw new Error(
      `Ya existe un archivo en ${destino}. Restaurar encima exige confirmarlo explícitamente.`
    );
  }

  // Se copia con VACUUM INTO en vez de copiar bytes: el resultado es una base
  // válida aunque el respaldo traiga páginas libres, y falla si el destino
  // existe, así que el borrado previo es explícito y no implícito.
  if (existe) await unlink(destino);
  await conClienteSqlite(respaldo, (cliente) =>
    cliente.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
  );

  return { destino, sha256: await sha256DeArchivo(destino) };
}
