import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Respaldo y restauración de la base.
//
// El módulo está partido en dos: un **núcleo agnóstico del motor** —nombre,
// retención, hash, manifiesto, escribir en temporal y renombrar recién al
// verificar— y un **controlador por motor**, que sabe copiar y verificar esa
// base en concreto.
//
// El núcleo era el mismo desde el principio; lo que estaba entrelazado eran las
// dos primitivas de SQLite (`VACUUM INTO` y `PRAGMA integrity_check`) metidas
// en medio. Separarlas es lo que hace que migrar a PostgreSQL no obligue a
// reescribir la retención ni el manifiesto.
//
// Nada de esto corre solo: la tarea programada exige RESPALDO_DIR configurado.
// Sin esa variable el sistema no toca ningún archivo.
// ---------------------------------------------------------------------------

export const PREFIJO_RESPALDO = "erp-";
/** Extensión del artefacto de SQLite. Cada motor declara la suya. */
export const EXTENSION_RESPALDO = ".db";
const EXTENSION_MANIFIESTO = ".sha256";

export type MotorRespaldo = "SQLITE" | "POSTGRES";

/**
 * De dónde sale el respaldo. Para SQLite es un archivo; para PostgreSQL es una
 * conexión, y esa diferencia es justamente la que el núcleo no debe conocer.
 */
export type OrigenRespaldo =
  | { motor: "SQLITE"; archivo: string }
  | { motor: "POSTGRES"; url: string };

/**
 * Qué sabe hacer un motor con su propia base. Todo lo demás —cómo se llama el
 * archivo, cuántos se conservan, el manifiesto— vive en el núcleo y no se
 * reimplementa por motor.
 */
export type ControladorRespaldo = {
  motor: MotorRespaldo;
  /** Extensión del artefacto que produce este motor. */
  extension: string;
  /** Copia consistente del origen en `destino`. */
  copiar: (origen: OrigenRespaldo, destino: string) => Promise<void>;
  /** ¿El artefacto de `ruta` está íntegro y es restaurable? */
  verificar: (ruta: string) => Promise<boolean>;
  /** Deja el contenido de `respaldo` en `destino`. */
  restaurar: (respaldo: string, destino: string) => Promise<void>;
};

/** Nombre ordenable cronológicamente: el orden alfabético es el orden temporal. */
export function nombreRespaldo(fecha: Date, extension: string = EXTENSION_RESPALDO): string {
  const p = (valor: number, ancho = 2) => String(valor).padStart(ancho, "0");
  const marca =
    `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}` +
    `-${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
  return `${PREFIJO_RESPALDO}${marca}${extension}`;
}

export function esNombreRespaldo(
  nombre: string,
  extension: string = EXTENSION_RESPALDO
): boolean {
  return nombre.startsWith(PREFIJO_RESPALDO) && nombre.endsWith(extension);
}

/**
 * Cuáles sobran al aplicar la retención. Conserva los `retencion` más nuevos;
 * con retención 0 o negativa no borra nada, porque "no conservar ninguno" casi
 * siempre es un error de configuración y no una instrucción.
 */
export function respaldosAEliminar(
  nombres: readonly string[],
  retencion: number,
  extension: string = EXTENSION_RESPALDO
): string[] {
  if (!Number.isInteger(retencion) || retencion <= 0) return [];
  const propios = nombres.filter((n) => esNombreRespaldo(n, extension));
  return propios.sort().slice(0, Math.max(0, propios.length - retencion));
}

/**
 * La fecha que lleva el nombre de un respaldo, o `null` si no es uno.
 *
 * El nombre es la única fuente de verdad sobre cuándo se hizo cada copia: la
 * fecha de modificación del archivo la cambia cualquier cosa que lo toque, y
 * una tabla en la base diría que hay respaldos que quizá ya no están.
 */
export function fechaDeRespaldo(
  nombre: string,
  extension: string = EXTENSION_RESPALDO
): Date | null {
  if (!esNombreRespaldo(nombre, extension)) return null;
  const marca = nombre.slice(PREFIJO_RESPALDO.length, nombre.length - extension.length);
  const partes = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(marca);
  if (!partes) return null;
  const [, anio, mes, dia, hora, minuto, segundo] = partes.map(Number);
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);
  // `new Date(2026, 12, 40)` no falla: se desborda al mes siguiente. Una marca
  // imposible tiene que quedar fuera, no convertirse en otra fecha.
  return fecha.getMonth() === mes - 1 && fecha.getDate() === dia ? fecha : null;
}

/**
 * ¿Corresponde respaldar ahora, o ya hay una copia suficientemente reciente?
 *
 * La tarea programada corre cada hora y en cada arranque del servidor. Sin esta
 * pregunta, cada corrida crea un respaldo **y elimina uno viejo por retención**:
 * con retención 7 se conservarían las últimas 7 horas en vez de la última
 * semana, y reiniciar el servidor siete veces borraría el historial entero.
 *
 * Un intervalo que no sea un número positivo se ignora y vale el de por
 * defecto: "respaldar en cada corrida" casi siempre es un error de
 * configuración y no una instrucción, igual que una retención de cero.
 */
export function respaldoPendiente(params: {
  nombres: readonly string[];
  ahora: Date;
  intervaloHoras: number;
  extension?: string;
}): boolean {
  const { nombres, ahora, intervaloHoras, extension = EXTENSION_RESPALDO } = params;
  const horas = Number.isFinite(intervaloHoras) && intervaloHoras > 0 ? intervaloHoras : 24;
  const fechas = nombres
    .map((n) => fechaDeRespaldo(n, extension))
    .filter((f): f is Date => f !== null);
  if (fechas.length === 0) return true;

  const ultimo = Math.max(...fechas.map((f) => f.getTime()));
  const transcurridas = (ahora.getTime() - ultimo) / (60 * 60 * 1000);
  // Una marca en el futuro —reloj corregido hacia atrás, copia traída de otra
  // máquina— no puede dejar el respaldo bloqueado a la espera de que el tiempo
  // la alcance: ante la duda se respalda, que es el lado barato del error.
  if (transcurridas < 0) return true;
  return transcurridas >= horas;
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

/**
 * Qué motor hay detrás de una `DATABASE_URL`.
 *
 * Antes esta pregunta no existía: `rutaDesdeUrlSqlite` devolvía `null` tanto
 * para una URL de PostgreSQL como para una cadena sin sentido, y el mensaje que
 * llegaba al operador era «DATABASE_URL no apunta a un archivo SQLite». Cierto,
 * pero inútil el día de la migración: lo que hace falta saber es que el motor
 * se reconoce y que **falta su controlador**.
 */
export function detectarMotor(url: string | undefined): MotorRespaldo | null {
  if (!url) return null;
  if (url.startsWith("file:")) return "SQLITE";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "POSTGRES";
  return null;
}

/** El origen para el motor detectado, o `null` si la URL no se reconoce. */
export function resolverOrigen(url: string | undefined): OrigenRespaldo | null {
  const motor = detectarMotor(url);
  if (motor === "SQLITE") {
    const archivo = rutaDesdeUrlSqlite(url);
    return archivo ? { motor, archivo } : null;
  }
  if (motor === "POSTGRES") return { motor, url: url! };
  return null;
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

/**
 * Controlador de SQLite.
 *
 * `VACUUM INTO` es la primitiva correcta: SQLite escribe una copia consistente
 * y compactada en un archivo nuevo, sin bloquear escrituras ni modificar el
 * origen, y falla si el destino ya existe. Copiar el archivo a mano mientras el
 * servidor escribe puede producir una copia rota que solo se descubre el día
 * que se necesita.
 */
export const CONTROLADOR_SQLITE: ControladorRespaldo = {
  motor: "SQLITE",
  extension: EXTENSION_RESPALDO,
  copiar: async (origen, destino) => {
    if (origen.motor !== "SQLITE") throw new Error("Origen que no es SQLite.");
    await conClienteSqlite(origen.archivo, (cliente) =>
      cliente.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
    );
  },
  verificar: verificarIntegridad,
  // Se copia con VACUUM INTO en vez de copiar bytes: el resultado es una base
  // válida aunque el respaldo traiga páginas libres, y falla si el destino
  // existe, así que el borrado previo es explícito y no implícito.
  restaurar: async (respaldo, destino) => {
    await conClienteSqlite(respaldo, (cliente) =>
      cliente.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
    );
  },
};

/**
 * El controlador del motor, o un error que dice exactamente qué falta.
 *
 * **PostgreSQL se reconoce pero no tiene controlador.** No es un olvido: un
 * respaldo que nunca se ejecutó contra una base real no es un respaldo, es una
 * creencia. Y creer que hay copias cuando no las hay es peor que saber que no
 * las hay — el día que se necesiten, ya es tarde para descubrirlo.
 *
 * Lo que falta para escribirlo está acotado a este objeto: `copiar` con
 * `pg_dump -Fc`, `verificar` con `pg_restore --list`, `restaurar` con
 * `pg_restore`, y `.dump` como extensión. El núcleo no cambia.
 */
export function controladorPara(origen: OrigenRespaldo): ControladorRespaldo {
  if (origen.motor === "SQLITE") return CONTROLADOR_SQLITE;
  throw new Error(
    "DATABASE_URL apunta a PostgreSQL y el respaldo todavía no tiene controlador para ese motor. " +
      "Hace falta implementarlo con pg_dump/pg_restore y probarlo contra una base real antes de confiar en él."
  );
}

/**
 * El controlador que corresponde a un artefacto ya escrito, por su extensión.
 *
 * Restaurar un volcado de otro motor con el driver de SQLite fallaría diciendo
 * «no pasó la verificación de integridad», que manda a buscar el problema donde
 * no está: el archivo puede estar perfecto y ser, simplemente, de otro motor.
 */
export function controladorDeArtefacto(archivo: string): ControladorRespaldo {
  if (archivo.endsWith(CONTROLADOR_SQLITE.extension)) return CONTROLADOR_SQLITE;
  throw new Error(
    `No hay controlador para restaurar ${archivo}: la extensión no corresponde a ningún motor con soporte.`
  );
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
  /** Ruta de archivo (SQLite) o el origen ya resuelto de cualquier motor. */
  origen: string | OrigenRespaldo;
  directorio: string;
  retencion?: number;
  ahora?: Date;
  /** Por defecto, el controlador del motor del origen. */
  controlador?: ControladorRespaldo;
}): Promise<ResumenRespaldo> {
  const { directorio, retencion = 7, ahora = new Date() } = opciones;
  // Una ruta suelta sigue significando SQLite: es como llamaban los dos
  // scripts y la tarea programada desde antes de que existieran los motores.
  const origen: OrigenRespaldo =
    typeof opciones.origen === "string"
      ? { motor: "SQLITE", archivo: opciones.origen }
      : opciones.origen;
  const controlador = opciones.controlador ?? controladorPara(origen);
  // Un controlador de otro motor respaldaría algo que no es este origen.
  if (controlador.motor !== origen.motor) {
    throw new Error(
      `El controlador es de ${controlador.motor} y el origen es de ${origen.motor}.`
    );
  }

  await mkdir(directorio, { recursive: true });

  const nombre = nombreRespaldo(ahora, controlador.extension);
  const destino = join(directorio, nombre);
  const parcial = `${destino}.parcial`;
  // Se escribe con nombre temporal y recién al verificar se renombra, para que
  // el directorio nunca contenga un archivo con nombre de respaldo válido que
  // todavía no sirve.
  await controlador.copiar(origen, parcial);

  if (!(await controlador.verificar(parcial))) {
    await unlink(parcial).catch(() => {});
    throw new Error("El respaldo recién creado no pasó la verificación de integridad.");
  }

  await rename(parcial, destino);
  const [{ size }, sha256] = await Promise.all([stat(destino), sha256DeArchivo(destino)]);
  await writeFile(`${destino}${EXTENSION_MANIFIESTO}`, `${sha256}  ${nombre}\n`, "utf8");

  const existentes = await readdir(directorio);
  const eliminados: string[] = [];
  for (const nombre of respaldosAEliminar(existentes, retencion, controlador.extension)) {
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
  /** Por defecto SQLite: es el motor del artefacto `.db`. */
  controlador?: ControladorRespaldo;
}): Promise<{ destino: string; sha256: string }> {
  const { respaldo, destino, forzar = false, controlador = CONTROLADOR_SQLITE } = opciones;
  if (resolve(respaldo) === resolve(destino)) {
    throw new Error("El origen y el destino de la restauración son el mismo archivo.");
  }
  if (!(await controlador.verificar(respaldo))) {
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

  // El borrado previo es explícito y no implícito: el controlador de SQLite
  // usa VACUUM INTO, que falla si el destino existe.
  if (existe) await unlink(destino);
  await controlador.restaurar(respaldo, destino);

  return { destino, sha256: await sha256DeArchivo(destino) };
}
