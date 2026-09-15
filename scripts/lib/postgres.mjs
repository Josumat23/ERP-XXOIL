// Crear y destruir bases de PostgreSQL desde los scripts de Node.
//
// Existe por el mismo motivo que `src/lib/databaseUrl.ts`: hasta hoy, cada
// script resolvía la base por su cuenta y con SQLite eso significaba una ruta
// de archivo que se podía comprobar con `path.relative`. Con una URL de
// conexión no hay ruta que mirar, y la pregunta «¿esta base es mía como para
// borrarla?» pasa a ser una pregunta sobre el NOMBRE.
//
// Así que el nombre es lo único que autoriza a destruir: `eliminarBase` exige
// un prefijo declarado por quien llama, y `identificador()` rechaza cualquier
// cosa que no sea `[a-z0-9_]`. Sin eso, un `DROP DATABASE` con el nombre
// equivocado —o con comillas dentro— borra la base de desarrollo sin aviso.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

/** Prefijo de las bases efímeras que crea y destruye el runner de pruebas. */
export const PREFIJO_BASE_PRUEBAS = "erp_test_";

/** Prefijo de la base desechable de `npm run dev:demo`. */
export const PREFIJO_BASE_DEMO = "erp_demo";

export function esUrlPostgres(url) {
  return typeof url === "string" && /^postgres(ql)?:\/\//.test(url);
}

/**
 * El nombre de la base que lleva una URL de conexión, o `null`.
 *
 * Es el mismo criterio que `nombreBasePostgres()` en `src/lib/prisma.ts`; se
 * repite acá porque aquel módulo es TypeScript con alias `@/` y estos scripts
 * corren con `node` a secas, sin tsx.
 */
export function nombreDeUrl(url) {
  if (!esUrlPostgres(url)) return null;
  try {
    const ruta = new URL(url).pathname.replace(/^\//, "");
    return ruta.length > 0 ? ruta : null;
  } catch {
    return null;
  }
}

/** La misma conexión, apuntando a otra base. */
export function urlConBase(plantilla, nombre) {
  const url = new URL(plantilla);
  url.pathname = "/" + identificador(nombre);
  return url.toString();
}

/**
 * Un identificador SQL seguro, o un error.
 *
 * No escapa: rechaza. Un nombre de base no tiene por qué llevar comillas,
 * espacios ni mayúsculas, y aceptar lo que sea para después entrecomillarlo es
 * la forma habitual de que un `DROP DATABASE` termine en el lugar equivocado.
 */
export function identificador(nombre) {
  if (typeof nombre !== "string" || !/^[a-z0-9_]{1,63}$/.test(nombre)) {
    throw new Error(`Nombre de base no admitido: ${JSON.stringify(nombre)}`);
  }
  return nombre;
}

/**
 * La conexión de mantenimiento: la misma máquina y credenciales, pero contra
 * `postgres`, porque no se puede crear ni borrar una base estando conectado a
 * ella.
 */
export function urlMantenimiento(plantilla) {
  return urlConBase(plantilla, "postgres");
}

async function conCliente(url, accion) {
  const { Client } = require("pg");
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await accion(cliente);
  } finally {
    await cliente.end();
  }
}

export async function existeBase(plantilla, nombre) {
  return conCliente(urlMantenimiento(plantilla), async (cliente) => {
    const { rows } = await cliente.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      identificador(nombre),
    ]);
    return rows.length > 0;
  });
}

export async function crearBase(plantilla, nombre) {
  await conCliente(urlMantenimiento(plantilla), (cliente) =>
    cliente.query(`CREATE DATABASE "${identificador(nombre)}"`)
  );
  return urlConBase(plantilla, nombre);
}

/**
 * Destruye una base, y solo si su nombre empieza por `prefijoExigido`.
 *
 * El prefijo no es decorativo: es la única barrera entre la limpieza del
 * runner y la base de desarrollo. Con SQLite el equivalente era comprobar que
 * el archivo estuviera en el directorio temporal y no en el repositorio.
 */
export async function eliminarBase(plantilla, nombre, prefijoExigido) {
  identificador(nombre);
  if (!prefijoExigido || !nombre.startsWith(prefijoExigido)) {
    throw new Error(
      `Se rechazó eliminar la base «${nombre}»: solo se destruyen las que empiezan por ` +
        `«${prefijoExigido}», que son las que estos scripts crean.`
    );
  }
  await conCliente(urlMantenimiento(plantilla), async (cliente) => {
    // Una conexión abierta —un proceso de prueba que no cerró, el propio
    // servidor de desarrollo— hace fallar el DROP. La base es desechable y
    // acaba de terminar su trabajo, así que se cortan.
    await cliente.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [nombre]
    );
    await cliente.query(`DROP DATABASE IF EXISTS "${nombre}"`);
  });
}

/**
 * Otras bases de pruebas que quedaron dando vueltas, sin la de esta corrida.
 *
 * Se **informa** y no se borra, a propósito. Una limpieza automática parece la
 * respuesta obvia hasta que dos corridas se pisan: no hay forma de distinguir
 * «quedó de una corrida que se murió» de «es de la corrida que está pasando
 * ahora mismo en la otra ventana», y borrarla la haría fallar con un error
 * incomprensible. Un aviso deja el rastro sin correr ese riesgo.
 */
export async function otrasBasesDePruebas(plantilla, propia) {
  return conCliente(urlMantenimiento(plantilla), async (cliente) => {
    const { rows } = await cliente.query(
      "SELECT datname FROM pg_database WHERE datname LIKE $1 AND datname <> $2 ORDER BY datname",
      [PREFIJO_BASE_PRUEBAS + "%", propia]
    );
    return rows.map((r) => r.datname);
  });
}

/**
 * Aplica las migraciones versionadas con Prisma.
 *
 * Antes la suite ejecutaba los `migration.sql` a mano con better-sqlite3, para
 * mantener la base efímera fuera del repositorio incluso en Windows. Con
 * PostgreSQL la base ya no es un archivo, así que ese motivo desapareció y
 * queda la ventaja de usar Prisma: las pruebas corren contra el mismo
 * procedimiento que un entorno real, y una migración que no aplica falla acá y
 * no el día del despliegue.
 */
export function aplicarMigraciones(url, raiz = process.cwd()) {
  const resultado = spawnSync(
    process.execPath,
    [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
    {
      cwd: resolve(raiz),
      env: { ...process.env, DATABASE_URL: url },
      stdio: "inherit",
    }
  );
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(
      "`prisma migrate deploy` terminó con código " + (resultado.status ?? "desconocido") + "."
    );
  }
}
