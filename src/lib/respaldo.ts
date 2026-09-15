import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import Database, { type Database as DatabaseSqlite } from "better-sqlite3";
import { CONTROLADOR_POSTGRES } from "@/lib/respaldoPostgres";

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
 * Adónde va una restauración.
 *
 * Existe desde el 2026-09-15 y es el motivo por el que el controlador de
 * PostgreSQL no se pudo escribir antes: el núcleo trataba el destino como una
 * **ruta de archivo** —lo consultaba con `stat`, lo borraba con `unlink`, le
 * calculaba el SHA256— y el destino de un `pg_restore` es una **base**. Copiar
 * ya estaba resuelto (un volcado siempre es un archivo); restaurar no.
 */
export type DestinoRestauracion =
  | { motor: "SQLITE"; archivo: string }
  | { motor: "POSTGRES"; url: string };

/**
 * Qué sabe hacer un motor con su propia base. Todo lo demás —cómo se llama el
 * archivo, cuántos se conservan, el manifiesto, el orden de las comprobaciones
 * antes de destruir nada— vive en el núcleo y no se reimplementa por motor.
 */
export type ControladorRespaldo = {
  motor: MotorRespaldo;
  /** Extensión del artefacto que produce este motor. */
  extension: string;
  /** Copia consistente del origen en `destino`. */
  copiar: (origen: OrigenRespaldo, destino: string) => Promise<void>;
  /** ¿El artefacto de `ruta` está íntegro y es restaurable? */
  verificar: (ruta: string) => Promise<boolean>;

  // --- El destino de una restauración -------------------------------------
  // Cinco preguntas que el núcleo hace SIEMPRE en el mismo orden y que cada
  // motor contesta a su manera. El orden es la garantía: nada se destruye
  // hasta que el respaldo está verificado y la confirmación es explícita.

  /** Interpreta lo que escribió quien opera: una ruta, una URL. */
  destinoDesde: (texto: string) => DestinoRestauracion;
  /** Cómo nombrar ese destino en un mensaje. Nunca con credenciales dentro. */
  describirDestino: (destino: DestinoRestauracion) => string;
  /** ¿El respaldo y el destino son la misma cosa? */
  esElMismo: (respaldo: string, destino: DestinoRestauracion) => boolean;
  /** ¿El destino ya tiene contenido que una restauración perdería? */
  destinoOcupado: (destino: DestinoRestauracion) => Promise<boolean>;
  /** Deja el destino vacío. El núcleo solo lo llama tras la confirmación. */
  vaciarDestino: (destino: DestinoRestauracion) => Promise<void>;
  /** Deja el contenido de `respaldo` en `destino`. */
  restaurar: (respaldo: string, destino: DestinoRestauracion) => Promise<void>;
  /** Prueba legible de qué quedó en el destino, para que no haya que creer. */
  comprobarDestino: (destino: DestinoRestauracion) => Promise<string>;
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

/**
 * Abre un archivo SQLite suelto, **sin pasar por Prisma**.
 *
 * Hasta el 2026-09-15 esto era un `PrismaClient` con el adaptador de
 * better-sqlite3, y el día de migrar a PostgreSQL dejó de construirse: Prisma
 * rechaza un adaptador de SQLite cuando el `provider` del esquema es
 * `postgresql`, así que el respaldo se quedó sin ningún controlador capaz de
 * correr. Y esa dependencia nunca aportó nada: acá no hay modelos ni consultas
 * generadas, solo dos sentencias de SQLite contra un archivo que ni siquiera
 * tiene el esquema de la aplicación.
 *
 * Importa: los respaldos `.db` que ya existen tienen que seguir siendo
 * verificables y restaurables aunque la base viva sea otra cosa.
 *
 * Se abre en **solo lectura y exigiendo que el archivo exista**. Las tres
 * operaciones solo leen el origen —`VACUUM INTO` escribe en un archivo nuevo—,
 * y sin esas dos opciones SQLite crearía la base que se le pide abrir: una
 * verificación de integridad sobre una ruta inexistente fabricaría un archivo
 * vacío y respondería que está «ok».
 */
function conBaseSqlite<T>(ruta: string, accion: (db: DatabaseSqlite) => T): T {
  const db = new Database(ruta, { readonly: true, fileMustExist: true });
  try {
    return accion(db);
  } finally {
    db.close();
  }
}

/**
 * `PRAGMA integrity_check` sobre un archivo suelto. Un archivo que ni siquiera
 * es una base SQLite hace fallar la consulta, y eso también es "no íntegro":
 * quien llama necesita un booleano, no un error del driver.
 */
export async function verificarIntegridad(ruta: string): Promise<boolean> {
  try {
    return conBaseSqlite(ruta, (db) => {
      const filas = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
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
    conBaseSqlite(origen.archivo, (db) =>
      db.exec(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
    );
  },
  verificar: verificarIntegridad,

  destinoDesde: (texto) => ({ motor: "SQLITE", archivo: texto }),
  describirDestino: (destino) => rutaDelDestino(destino),
  esElMismo: (respaldo, destino) => resolve(respaldo) === resolve(rutaDelDestino(destino)),
  destinoOcupado: (destino) =>
    stat(rutaDelDestino(destino)).then(
      () => true,
      () => false
    ),
  // El borrado es explícito y no implícito: `VACUUM INTO` falla si el destino
  // existe, así que el archivo se quita acá, después de la confirmación.
  vaciarDestino: (destino) => unlink(rutaDelDestino(destino)),
  // Se copia con VACUUM INTO en vez de copiar bytes: el resultado es una base
  // válida aunque el respaldo traiga páginas libres.
  restaurar: async (respaldo, destino) => {
    const ruta = rutaDelDestino(destino).replaceAll("'", "''");
    conBaseSqlite(respaldo, (db) => db.exec(`VACUUM INTO '${ruta}'`));
  },
  comprobarDestino: async (destino) => `SHA256 ${await sha256DeArchivo(rutaDelDestino(destino))}`,
};

/** El archivo de un destino de SQLite, o un error si le llega el de otro motor. */
function rutaDelDestino(destino: DestinoRestauracion): string {
  if (destino.motor !== "SQLITE") {
    throw new Error(`El controlador de SQLite recibió un destino de ${destino.motor}.`);
  }
  return destino.archivo;
}

/**
 * El controlador del motor, o un error que dice exactamente qué falta.
 *
 * PostgreSQL estuvo **reconocido y rechazado** desde el 2026-09-12 hasta el
 * 2026-09-15, con un mensaje que nombraba `pg_dump`/`pg_restore`. La negativa
 * era deliberada mientras el controlador no se hubiera ejecutado nunca contra
 * una base real; ahora se ejecuta, y la suite lo ejerce de punta a punta.
 */
export function controladorPara(origen: OrigenRespaldo): ControladorRespaldo {
  return origen.motor === "SQLITE" ? CONTROLADOR_SQLITE : CONTROLADOR_POSTGRES;
}

/**
 * El controlador que corresponde a un artefacto ya escrito, por su extensión.
 *
 * Restaurar un volcado de otro motor con el driver equivocado fallaría diciendo
 * «no pasó la verificación de integridad», que manda a buscar el problema donde
 * no está: el archivo puede estar perfecto y ser, simplemente, de otro motor.
 */
export function controladorDeArtefacto(archivo: string): ControladorRespaldo {
  if (archivo.endsWith(CONTROLADOR_SQLITE.extension)) return CONTROLADOR_SQLITE;
  if (archivo.endsWith(CONTROLADOR_POSTGRES.extension)) return CONTROLADOR_POSTGRES;
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
  // Si `copiar` falla a mitad de camino, lo escrito hasta ahí se descarta. Sin
  // esto quedaba un `.parcial` por cada intento fallido: no tiene nombre de
  // respaldo válido, así que no engaña a la retención ni a nadie, pero se
  // acumula en el directorio sin que nadie lo limpie nunca. Lo destapó un
  // `pg_dump` que creó el archivo y recién después no pudo conectarse.
  try {
    await controlador.copiar(origen, parcial);
  } catch (e) {
    await unlink(parcial).catch(() => {});
    throw e;
  }

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
 * Restaura un respaldo sobre `destino`. Verifica la integridad **antes de tocar
 * nada** y se niega a pisar un destino con contenido salvo que se pida
 * explícitamente — restaurar sobre la base viva es justamente la operación que
 * no debe poder hacerse por accidente.
 *
 * El orden importa más que cualquiera de los pasos y por eso vive acá y no en
 * los controladores: si la verificación fuera después de vaciar, un respaldo
 * corrupto dejaría la base destruida **y** sin nada con qué reemplazarla.
 *
 * `destino` sigue siendo texto —una ruta para SQLite, una URL para PostgreSQL—
 * y es el controlador quien lo interpreta.
 */
export async function restaurarRespaldo(opciones: {
  respaldo: string;
  destino: string;
  forzar?: boolean;
  /** Por defecto, el del motor que corresponde a la extensión del artefacto. */
  controlador?: ControladorRespaldo;
}): Promise<{ destino: string; comprobacion: string }> {
  const { respaldo, forzar = false } = opciones;
  const controlador = opciones.controlador ?? controladorDeArtefacto(respaldo);
  const destino = controlador.destinoDesde(opciones.destino);

  if (controlador.esElMismo(respaldo, destino)) {
    throw new Error("El origen y el destino de la restauración son el mismo.");
  }
  if (!(await controlador.verificar(respaldo))) {
    throw new Error("El respaldo no pasó la verificación de integridad: no se restauró nada.");
  }

  const ocupado = await controlador.destinoOcupado(destino);
  if (ocupado && !forzar) {
    throw new Error(
      `Ya hay contenido en ${controlador.describirDestino(destino)}. ` +
        "Restaurar encima exige confirmarlo explícitamente."
    );
  }
  if (ocupado) await controlador.vaciarDestino(destino);

  await controlador.restaurar(respaldo, destino);

  return {
    destino: controlador.describirDestino(destino),
    comprobacion: await controlador.comprobarDestino(destino),
  };
}
