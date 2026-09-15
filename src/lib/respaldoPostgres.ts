// El controlador de respaldo de PostgreSQL.
//
// Estuvo declarado y **rechazado** desde el 2026-09-12, con un mensaje que
// nombraba lo que faltaba. La negativa era deliberada: un respaldo que nunca
// corrió contra una base real no es un respaldo, es una creencia — y creer que
// hay copias cuando no las hay es peor que saber que no las hay, porque el
// error se descubre el día que ya es tarde.
//
// Ahora corre. Todo lo que hay acá se ejerce en la suite **contra un
// PostgreSQL de verdad**: se vuelca una base con datos, se verifica el
// artefacto, se restaura en otra base y se comprueba que los datos llegaron.
//
// Las tres operaciones son las que el documento anticipaba:
//
//   copiar     pg_dump -Fc
//   verificar  pg_restore --list
//   restaurar  pg_restore
//
// El núcleo —nombre, orden, retención, manifiesto SHA256, escribir en
// `.parcial` y renombrar recién al verificar— no cambió ni una línea.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { Client } from "pg";
import type { ControladorRespaldo, DestinoRestauracion, OrigenRespaldo } from "@/lib/respaldo";

/** Extensión del artefacto de PostgreSQL: el formato propio de `pg_dump -Fc`. */
export const EXTENSION_POSTGRES = ".dump";

/**
 * Variable que dice dónde están `pg_dump` y `pg_restore`.
 *
 * Hace falta porque una instalación portable —la de esta máquina— no pone nada
 * en el PATH. Si no está definida se confía en el PATH, que es lo normal en un
 * servidor; y si tampoco está ahí, el error dice esta variable por su nombre en
 * vez de un «ENOENT» que no le sirve a nadie.
 */
export const VARIABLE_BIN = "PG_BIN_DIR";

function ejecutable(nombre: string): string {
  const dir = process.env[VARIABLE_BIN]?.trim();
  if (!dir) return nombre;
  return join(dir, process.platform === "win32" ? `${nombre}.exe` : nombre);
}

type Resultado = { codigo: number; salida: string; error: string };

/**
 * Corre una herramienta de PostgreSQL y devuelve su resultado.
 *
 * La URL va por **argumento y no por variable de entorno**: `PGPASSWORD` deja
 * la contraseña visible en el entorno del proceso, y armar la línea a mano con
 * `-h -p -U` obliga a re-parsear la URL en cada llamada. `spawn` sin shell no
 * interpreta nada de lo que lleve dentro.
 */
function correr(nombre: string, argumentos: string[]): Promise<Resultado> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(ejecutable(nombre), argumentos, { shell: false });
    let salida = "";
    let error = "";
    proceso.stdout.on("data", (b) => (salida += b.toString()));
    proceso.stderr.on("data", (b) => (error += b.toString()));
    proceso.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        rechazar(
          new Error(
            `No se encontró ${nombre}. Es parte de las herramientas cliente de PostgreSQL: ` +
              `póngalas en el PATH o defina ${VARIABLE_BIN} con el directorio que las contiene ` +
              "(por ejemplo el `bin` de la instalación). Sin ellas no hay respaldo ni restauración."
          )
        );
        return;
      }
      rechazar(e);
    });
    proceso.on("close", (codigo) => resolver({ codigo: codigo ?? -1, salida, error }));
  });
}

function urlDelOrigen(origen: OrigenRespaldo): string {
  if (origen.motor !== "POSTGRES") {
    throw new Error(`El controlador de PostgreSQL recibió un origen de ${origen.motor}.`);
  }
  return origen.url;
}

function urlDelDestino(destino: DestinoRestauracion): string {
  if (destino.motor !== "POSTGRES") {
    throw new Error(`El controlador de PostgreSQL recibió un destino de ${destino.motor}.`);
  }
  return destino.url;
}

/**
 * Una URL de conexión sin la contraseña.
 *
 * Los mensajes de esta librería terminan en el registro de tareas programadas,
 * que se lee desde una pantalla: una credencial ahí dentro queda guardada en la
 * base y a la vista de cualquiera que abra esa pantalla.
 */
export function urlSinCredenciales(url: string): string {
  try {
    const u = new URL(url);
    u.password = "";
    u.username = "";
    return u.toString();
  } catch {
    return "la base configurada";
  }
}

async function conConexion<T>(url: string, accion: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await accion(cliente);
  } finally {
    await cliente.end();
  }
}

/** Cuántas tablas tiene el esquema `public`. Es la medida de «acá hay algo». */
async function tablasEn(url: string): Promise<number> {
  return conConexion(url, async (cliente) => {
    const { rows } = await cliente.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    return Number(rows[0]?.n ?? 0);
  });
}

export const CONTROLADOR_POSTGRES: ControladorRespaldo = {
  motor: "POSTGRES",
  extension: EXTENSION_POSTGRES,

  /**
   * `pg_dump -Fc` es la primitiva correcta, por el mismo motivo que
   * `VACUUM INTO` lo es en SQLite: vuelca dentro de una transacción, así que la
   * copia es consistente aunque el sistema esté escribiendo, y no bloquea a
   * nadie. El formato propio (`-Fc`) además se puede inspeccionar y restaurar
   * selectivamente, que es lo que hace posible verificarlo sin restaurarlo.
   *
   * `--no-owner --no-acl` porque el dueño y los permisos son del servidor donde
   * se hizo la copia: conservarlos haría fallar la restauración en cualquier
   * otro, que es justamente el día en que se necesita.
   */
  copiar: async (origen, destino) => {
    const { codigo, error } = await correr("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--file=${destino}`,
      urlDelOrigen(origen),
    ]);
    if (codigo !== 0) {
      throw new Error(`pg_dump terminó con código ${codigo}: ${error.trim() || "sin detalle"}`);
    }
  },

  /**
   * `pg_restore --list` lee el índice del volcado sin restaurar nada. Un
   * archivo truncado, corrupto, o que sencillamente no es un volcado, falla
   * acá.
   *
   * También se exige que el índice **no esté vacío**: un volcado de cero
   * objetos es sintácticamente válido y no sirve para nada, y es exactamente lo
   * que produciría respaldar la base equivocada.
   */
  verificar: async (ruta) => {
    try {
      const { codigo, salida } = await correr("pg_restore", ["--list", ruta]);
      if (codigo !== 0) return false;
      return salida.split("\n").some((l) => l.trim() !== "" && !l.trimStart().startsWith(";"));
    } catch {
      return false;
    }
  },

  destinoDesde: (texto) => ({ motor: "POSTGRES", url: texto }),
  describirDestino: (destino) => urlSinCredenciales(urlDelDestino(destino)),

  // Un volcado es un archivo y un destino es una base: no pueden ser lo mismo.
  // La pregunta igual se contesta, porque el núcleo la hace para todos los
  // motores y un `false` mentiroso es peor que uno explicado.
  esElMismo: () => false,

  destinoOcupado: async (destino) => (await tablasEn(urlDelDestino(destino))) > 0,

  /**
   * Vaciar es `DROP SCHEMA public CASCADE` y volver a crearlo.
   *
   * No se borra la base entera a propósito: eso exigiría conectarse a `postgres`
   * como superusuario, y quien restaura no tiene por qué serlo. Esto deja la
   * base sin un solo objeto de la aplicación usando solo la conexión que ya
   * tiene, y es lo que hace que la restauración parta de cero en vez de
   * mezclarse con lo que hubiera antes.
   */
  vaciarDestino: async (destino) => {
    await conConexion(urlDelDestino(destino), async (cliente) => {
      await cliente.query("DROP SCHEMA IF EXISTS public CASCADE");
      await cliente.query("CREATE SCHEMA public");
    });
  },

  /**
   * `--exit-on-error` es lo que separa una restauración de una ilusión. Por
   * omisión `pg_restore` informa los errores y **sigue**, terminando con código
   * 0: la base quedaría a medias y el operador leería que salió bien.
   */
  restaurar: async (respaldo, destino) => {
    const { codigo, error } = await correr("pg_restore", [
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      `--dbname=${urlDelDestino(destino)}`,
      respaldo,
    ]);
    if (codigo !== 0) {
      throw new Error(`pg_restore terminó con código ${codigo}: ${error.trim() || "sin detalle"}`);
    }
  },

  comprobarDestino: async (destino) => `${await tablasEn(urlDelDestino(destino))} tablas`,
};
