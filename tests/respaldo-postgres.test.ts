import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import {
  CONTROLADOR_POSTGRES,
  urlSinCredenciales,
  VARIABLE_BIN,
} from "@/lib/respaldoPostgres";
import {
  controladorDeArtefacto,
  controladorPara,
  crearRespaldo,
  esNombreRespaldo,
  restaurarRespaldo,
  sha256DeArchivo,
} from "@/lib/respaldo";
import { PREFIJO_BASE_PRUEBAS } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// El respaldo de PostgreSQL, contra un PostgreSQL de verdad.
//
// Esto es lo que faltaba para que el controlador existiera. Estuvo declarado y
// **rechazado** desde el 2026-09-12 con un mensaje que nombraba `pg_dump` y
// `pg_restore`, y la negativa era deliberada: un respaldo que nunca corrió
// contra una base real no es un respaldo, es una creencia. Y creer que hay
// copias cuando no las hay es peor que saber que no las hay, porque el error se
// descubre el día que ya es tarde.
//
// Así que acá no se simula nada. Se vuelca una base con datos, se verifica el
// artefacto, se restaura en OTRA base y se comprueba que los datos llegaron.
// Si `pg_dump` no estuviera, estas pruebas fallarían en vez de pasar en vacío.
// ---------------------------------------------------------------------------

const URL_PRUEBAS = process.env.DATABASE_URL ?? "";

/** Una base hermana de la de esta corrida, con el mismo prefijo protegido. */
function urlHermana(sufijo: string): { url: string; nombre: string } {
  const u = new URL(URL_PRUEBAS);
  const nombre = `${PREFIJO_BASE_PRUEBAS}${sufijo}_${randomBytes(4).toString("hex")}`;
  u.pathname = `/${nombre}`;
  return { url: u.toString(), nombre };
}

function urlMantenimiento(): string {
  const u = new URL(URL_PRUEBAS);
  u.pathname = "/postgres";
  return u.toString();
}

async function conCliente<T>(url: string, accion: (c: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await accion(cliente);
  } finally {
    await cliente.end();
  }
}

/**
 * Crea una base hermana, la entrega, y la destruye pase lo que pase.
 *
 * El nombre lleva el prefijo `erp_test_` a propósito: es el único que
 * `run-tests.mjs` reconoce como suyo, así que si esta prueba muriera de la peor
 * manera, la corrida siguiente la barre en vez de dejarla ahí para siempre.
 */
async function conBaseHermana<T>(
  sufijo: string,
  accion: (url: string, nombre: string) => Promise<T>
): Promise<T> {
  const { url, nombre } = urlHermana(sufijo);
  assert.ok(nombre.startsWith(PREFIJO_BASE_PRUEBAS), "la base auxiliar tiene que ser de pruebas");
  await conCliente(urlMantenimiento(), (c) => c.query(`CREATE DATABASE "${nombre}"`));
  try {
    return await accion(url, nombre);
  } finally {
    await conCliente(urlMantenimiento(), async (c) => {
      await c.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [nombre]
      );
      await c.query(`DROP DATABASE IF EXISTS "${nombre}"`);
    });
  }
}

test("el motor ya tiene controlador: PostgreSQL deja de rechazarse", () => {
  // Durante tres días `controladorPara` lanzaba un error que decía qué faltaba.
  // Esta prueba fija que ya no, y que el que devuelve es el de PostgreSQL.
  const controlador = controladorPara({ motor: "POSTGRES", url: URL_PRUEBAS });
  assert.equal(controlador.motor, "POSTGRES");
  assert.equal(controlador.extension, ".dump");
  // Y un `.dump` ya se sabe restaurar: antes la extensión no correspondía a
  // ningún motor con soporte.
  assert.equal(controladorDeArtefacto("erp-20260101-010000.dump"), CONTROLADOR_POSTGRES);
});

test("volcar, verificar y restaurar en otra base: los datos llegan", async () => {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-pg-"));
  try {
    await conBaseHermana("origen", async (urlOrigen) => {
      // Una base testigo propia, no la de la suite: así el contenido que se
      // busca después es exactamente el que se puso, y no algo del seed que
      // podría cambiar.
      await conCliente(urlOrigen, async (c) => {
        await c.query("CREATE TABLE testigo (id int primary key, valor text)");
        await c.query("INSERT INTO testigo VALUES (1, 'antes del respaldo')");
      });

      const resumen = await crearRespaldo({
        origen: { motor: "POSTGRES", url: urlOrigen },
        directorio,
        retencion: 5,
      });

      // El artefacto es el que el motor declara, con manifiesto del núcleo.
      assert.ok(resumen.archivo.endsWith(".dump"), resumen.archivo);
      assert.ok(esNombreRespaldo(resumen.archivo.split(/[\\/]/).pop()!, ".dump"));
      assert.ok(resumen.bytes > 0);
      assert.equal(resumen.sha256, await sha256DeArchivo(resumen.archivo));
      assert.match(await readFile(`${resumen.archivo}.sha256`, "utf8"), new RegExp(resumen.sha256));
      // Nada a medio escribir: se verifica antes de renombrar.
      assert.equal(
        (await readdir(directorio)).some((n) => n.endsWith(".parcial")),
        false
      );

      // La base viva cambia DESPUÉS del respaldo: es lo que hace que la
      // restauración se pueda distinguir de «no pasó nada».
      await conCliente(urlOrigen, (c) =>
        c.query("UPDATE testigo SET valor = 'despues del respaldo' WHERE id = 1")
      );

      await conBaseHermana("destino", async (urlDestino) => {
        const resultado = await restaurarRespaldo({ respaldo: resumen.archivo, destino: urlDestino });

        const filas = await conCliente(urlDestino, async (c) =>
          (await c.query<{ valor: string }>("SELECT valor FROM testigo WHERE id = 1")).rows
        );
        assert.equal(filas[0]?.valor, "antes del respaldo", "el dato no volvió del respaldo");

        // La comprobación mide el destino después de escribir; no es una
        // promesa de que salió bien.
        assert.match(resultado.comprobacion, /^1 tablas?$/);
        // Y el mensaje no lleva credenciales: termina en el registro de tareas,
        // que se lee desde una pantalla.
        assert.doesNotMatch(resultado.destino, /:[^/@]*@/);
      });

      // El origen no se tocó: respaldar no modifica lo que respalda.
      const vivo = await conCliente(urlOrigen, async (c) =>
        (await c.query<{ valor: string }>("SELECT valor FROM testigo WHERE id = 1")).rows
      );
      assert.equal(vivo[0]?.valor, "despues del respaldo");
    });
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("restaurar sobre una base con contenido exige confirmarlo", async () => {
  // Restaurar encima de la base viva es justamente la operación que no debe
  // poder hacerse por accidente. Con SQLite la pregunta era «¿existe el
  // archivo?»; acá es «¿esta base tiene tablas?».
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-pg-pisar-"));
  try {
    await conBaseHermana("lleno", async (url) => {
      await conCliente(url, async (c) => {
        await c.query("CREATE TABLE testigo (id int primary key, valor text)");
        await c.query("INSERT INTO testigo VALUES (1, 'lo que ya estaba')");
      });

      const resumen = await crearRespaldo({
        origen: { motor: "POSTGRES", url },
        directorio,
        retencion: 5,
      });

      await conBaseHermana("ocupado", async (urlOcupado) => {
        await conCliente(urlOcupado, (c) => c.query("CREATE TABLE ajena (id int)"));

        await assert.rejects(
          restaurarRespaldo({ respaldo: resumen.archivo, destino: urlOcupado }),
          /exige confirmarlo explícitamente/
        );
        // Y lo que había sigue ahí: la negativa ocurre antes de vaciar nada.
        const ajena = await conCliente(urlOcupado, async (c) =>
          (await c.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'ajena'")).rows
        );
        assert.equal(ajena.length, 1, "se vació el destino pese a haberse negado");

        // Con confirmación explícita sí, y el destino queda SOLO con lo del
        // respaldo: la tabla ajena desaparece, no se mezcla.
        await restaurarRespaldo({ respaldo: resumen.archivo, destino: urlOcupado, forzar: true });
        const tablas = await conCliente(urlOcupado, async (c) =>
          (
            await c.query<{ table_name: string }>(
              "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            )
          ).rows.map((r) => r.table_name)
        );
        assert.deepEqual(tablas, ["testigo"]);
      });
    });
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("un volcado corrupto no se restaura, y no destruye el destino", async () => {
  // El orden es lo que importa: si la verificación fuera después de vaciar, un
  // respaldo roto dejaría la base destruida Y sin nada con qué reemplazarla.
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-pg-roto-"));
  try {
    const corrupto = join(directorio, "erp-20260101-010000.dump");
    await (await import("node:fs/promises")).writeFile(corrupto, "esto no es un volcado", "utf8");
    assert.equal(await CONTROLADOR_POSTGRES.verificar(corrupto), false);

    await conBaseHermana("intacto", async (url) => {
      await conCliente(url, (c) => c.query("CREATE TABLE no_se_toca (id int)"));
      await assert.rejects(
        restaurarRespaldo({ respaldo: corrupto, destino: url, forzar: true }),
        /no se restauró nada/
      );
      const tablas = await conCliente(url, async (c) =>
        (
          await c.query<{ table_name: string }>(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
          )
        ).rows.map((r) => r.table_name)
      );
      assert.deepEqual(tablas, ["no_se_toca"], "el destino se vació pese a que el respaldo era malo");
    });
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("un volcado vacío no cuenta como respaldo", async () => {
  // Un volcado de cero objetos es sintácticamente válido y no sirve para nada,
  // y es exactamente lo que produciría respaldar la base equivocada. Si
  // `verificar` solo mirara el código de salida, esto pasaría por bueno.
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-pg-vacio-"));
  try {
    await conBaseHermana("vacia", async (url) => {
      const dump = join(directorio, "vacio.dump");
      await CONTROLADOR_POSTGRES.copiar({ motor: "POSTGRES", url }, dump);
      // pg_dump termina bien: la base existe, simplemente no tiene nada.
      assert.equal(await CONTROLADOR_POSTGRES.verificar(dump), false);
    });
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("el respaldo no deja credenciales en los mensajes", () => {
  // Los errores y resúmenes terminan en el registro de tareas programadas, que
  // se lee desde una pantalla: una contraseña ahí queda guardada en la base y a
  // la vista de cualquiera que abra esa pantalla.
  const limpia = urlSinCredenciales("postgresql://erp:secreta@maquina:5432/produccion");
  assert.doesNotMatch(limpia, /secreta/);
  assert.match(limpia, /maquina:5432\/produccion/);
  // Una cadena que no es una URL no se devuelve tal cual: podría serlo a medias.
  assert.equal(urlSinCredenciales("no es una url"), "la base configurada");
});

test("si faltan las herramientas, el error dice qué configurar", async () => {
  // Un `ENOENT` suelto manda a buscar el problema donde no está. El mensaje
  // tiene que nombrar la variable.
  const anterior = process.env[VARIABLE_BIN];
  process.env[VARIABLE_BIN] = join(tmpdir(), "no-existe-este-directorio-de-postgres");
  try {
    await assert.rejects(
      CONTROLADOR_POSTGRES.copiar(
        { motor: "POSTGRES", url: URL_PRUEBAS },
        join(tmpdir(), "no-se-va-a-escribir.dump")
      ),
      new RegExp(VARIABLE_BIN)
    );
  } finally {
    if (anterior === undefined) delete process.env[VARIABLE_BIN];
    else process.env[VARIABLE_BIN] = anterior;
  }
});

test("CI comprueba la versión del cliente, no solo la imprime", async () => {
  // Un cliente de versión menor que el servidor se niega a volcar, y en CI eso
  // no se ve: `postgresql-client-17` se instala, pero `/usr/bin/pg_dump` es el
  // wrapper de Debian y sigue eligiendo la 16.
  //
  // Pasó el 2026-09-15. El paso imprimía `pg_dump --version` y nadie lo
  // comparaba: quedó en verde, y la suite falló seis minutos más tarde. Un
  // `--version` que nadie mira es la misma clase de guardia que pasa sin
  // comprobar nada, así que esto fija que la comprobación sea una aserción.
  const flujo = await readFile(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  assert.match(flujo, /postgresql-client-17/, "CI no instala el cliente 17");
  assert.match(flujo, /PG_BIN_DIR=/, "CI no apunta a los binarios de la 17");
  assert.match(flujo, /::error::/, "CI imprime la versión pero no falla si no es la que toca");
});

test("un controlador no acepta el origen ni el destino de otro motor", async () => {
  // Cruzarlos produciría un `pg_dump` contra una ruta de archivo, o un
  // `VACUUM INTO` contra una URL: falla, pero con un mensaje del sistema
  // operativo en vez de uno que diga qué pasó.
  await assert.rejects(
    CONTROLADOR_POSTGRES.copiar({ motor: "SQLITE", archivo: "x.db" }, "y.dump"),
    /recibió un origen de SQLITE/
  );
  await assert.rejects(
    CONTROLADOR_POSTGRES.restaurar("x.dump", { motor: "SQLITE", archivo: "y.db" }),
    /recibió un destino de SQLITE/
  );
});
