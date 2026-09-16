import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// La migración a PostgreSQL del 2026-09-15, fijada.
//
// Estas guardias no comprueban que PostgreSQL funcione —eso lo hacen las otras
// quinientas y pico de pruebas, que corren contra él— sino las decisiones que
// son fáciles de deshacer sin querer: que la carpeta de migraciones tenga UNA
// línea base y no 124, que el historial de SQLite siga archivado donde Prisma
// no lo lea, y que el runner destruya la base que crea.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const VIVAS = resolve(RAIZ, "prisma/migrations");
const ARCHIVO = resolve(RAIZ, "prisma/migraciones-sqlite-historico");

test("la carpeta viva arranca en la línea base de PostgreSQL", async () => {
  // Lo que se fija es que la PRIMERA migración sea la línea base, no que sea
  // la única: agregar migraciones es lo normal. La versión anterior de esta
  // guardia exigía exactamente una carpeta y se rompió con la primera
  // migración nueva — una guardia que estorba al trabajo legítimo se termina
  // borrando, y con ella la protección que sí importaba.
  const entradas = (await readdir(VIVAS, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.ok(entradas.length >= 1, "no hay ninguna migración");
  assert.equal(entradas[0], "00000000000000_baseline_postgres", "la línea base dejó de ser la primera");

  const lock = await readFile(resolve(VIVAS, "migration_lock.toml"), "utf8");
  assert.match(lock, /provider = "postgresql"/);

  const sql = await readFile(resolve(VIVAS, entradas[0], "migration.sql"), "utf8");
  // Si alguien regenerara la línea base contra SQLite, esto lo dice. Los tres
  // son sintaxis que SQLite no produce.
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS "public"/, "no parece una línea base de PostgreSQL");
  assert.ok(sql.split("CREATE TYPE").length - 1 >= 100, "faltan enums en la línea base");
  assert.ok(sql.split("CREATE TABLE").length - 1 > 150, "faltan tablas en la línea base");
  assert.doesNotMatch(sql, /PRAGMA/, "quedó sintaxis de SQLite en la línea base");
});

test("las 123 migraciones de SQLite siguen archivadas, fuera de lo que Prisma lee", async () => {
  // Se conservan porque varias llevan decisiones anotadas que no están en
  // ningún otro lado —cómo se tradujo un booleano a un enum, por qué un relleno
  // va antes de crear un índice— y seis guardias de la suite las siguen
  // leyendo. Lo que se perdió es poder EJECUTARLAS, y eso fue a propósito.
  const entradas = (await readdir(ARCHIVO, { withFileTypes: true })).filter((e) => e.isDirectory());
  assert.ok(entradas.length >= 123, `solo ${entradas.length} migraciones archivadas`);

  // Prisma lee `prisma/migrations` y nada más: si el archivo volviera ahí
  // dentro, `migrate deploy` intentaría aplicar SQL de SQLite a PostgreSQL.
  const dentro = (await readdir(VIVAS)).some((n) => n.includes("sqlite"));
  assert.equal(dentro, false, "el historial de SQLite volvió a la carpeta que Prisma aplica");
});

test("el esquema declara PostgreSQL", async () => {
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const datasource = esquema.slice(
    esquema.indexOf("datasource db"),
    esquema.indexOf("}", esquema.indexOf("datasource db"))
  );
  assert.ok(datasource.length > 20, "el corte quedó vacío");
  assert.match(datasource, /provider\s*=\s*"postgresql"/);
});

test("el adaptador se declara en un solo lugar", async () => {
  // Había cinco copias de `new PrismaBetterSqlite3(...)` —`prisma.ts` y los
  // cuatro sembradores— y es la forma del error que ya costó caro una vez:
  // cuando cinco lugares repiten cómo se abre la base, basta que uno quede
  // atrás. El día del cambio de motor fue un import y una línea.
  const sospechosos = [
    "src/lib/prisma.ts",
    "prisma/seed.ts",
    "prisma/seed-demo.ts",
    "prisma/seed-ubigeos.ts",
    "prisma/seed-segunda-empresa.ts",
  ];
  for (const ruta of sospechosos) {
    const fuente = (await readFile(resolve(RAIZ, ruta), "utf8")).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(fuente, /new Prisma(Pg|BetterSqlite3)\(/, `${ruta} arma su propio adaptador`);
    assert.match(fuente, /crearAdaptador\(/, `${ruta} no usa el ayudante compartido`);
  }
  // Y el ayudante sí lo arma: la guardia no pasa por haberlo borrado.
  const ayudante = await readFile(resolve(RAIZ, "src/lib/adaptadorBase.ts"), "utf8");
  assert.match(ayudante, /new PrismaPg\(/);
});

test("las dependencias dicen la verdad sobre qué motores se usan", async () => {
  const paquete = JSON.parse(await readFile(resolve(RAIZ, "package.json"), "utf8"));
  const prod: Record<string, string> = paquete.dependencies;
  const dev: Record<string, string> = paquete.devDependencies;

  assert.ok(prod["@prisma/adapter-pg"], "falta el adaptador de PostgreSQL");
  assert.ok(prod["pg"], "falta el driver de PostgreSQL");

  // El adaptador de SQLite ya no lo importa nadie. Una dependencia que sobra
  // no rompe nada hoy, pero mañana alguien la usa creyendo que sigue en pie.
  assert.equal(
    prod["@prisma/adapter-better-sqlite3"] ?? dev["@prisma/adapter-better-sqlite3"],
    undefined,
    "el adaptador de SQLite quedó declarado y ya no se importa en ningún lado"
  );

  // Pero `better-sqlite3` SÍ sigue en uso, y en código de producción: el
  // controlador de respaldo abre los `.db` existentes con él. Estaba en
  // devDependencies de cuando lo usaban solo los scripts, así que una
  // instalación con `--omit=dev` habría desplegado un respaldo que no arranca.
  assert.ok(prod["better-sqlite3"], "`better-sqlite3` es de producción: lo usa src/lib/respaldo.ts");
  const respaldo = await readFile(resolve(RAIZ, "src/lib/respaldo.ts"), "utf8");
  assert.match(respaldo, /from "better-sqlite3"/, "la guardia anterior dejó de tener sentido");
});

test("el runner destruye la base aunque las pruebas fallen", async () => {
  // Una base huérfana por corrida fallida llenaría el servidor de `erp_test_…`
  // en una tarde. Lo que lo garantiza es que el borrado esté en un `finally`,
  // y eso se lee en el código porque no hay forma de ejercerlo desde adentro
  // de la propia corrida.
  const fuente = await readFile(resolve(RAIZ, "scripts/run-tests.mjs"), "utf8");
  const finally_ = fuente.slice(fuente.indexOf("} finally {"));
  assert.ok(finally_.length > 0, "el runner ya no tiene un finally");
  assert.match(finally_, /eliminarBase\(/, "el borrado de la base salió del finally");
  // Y la base es de esta corrida, no la configurada: el nombre se inventa.
  assert.match(fuente, /randomBytes\(\d+\)/);
  assert.match(fuente, /PREFIJO_BASE_PRUEBAS \+ randomBytes/);
});

test("nadie destruye una base que no creó", async () => {
  // `eliminarBase` exige el prefijo y `identificador()` rechaza en vez de
  // escapar. Aceptar cualquier nombre para después entrecomillarlo es la forma
  // habitual de que un DROP DATABASE termine en el lugar equivocado.
  const { eliminarBase, identificador, nombreDeUrl, urlConBase } = await import(
    "../scripts/lib/postgres.mjs"
  );

  assert.equal(identificador("erp_test_ab12"), "erp_test_ab12");
  for (const malo of ['erp"; DROP DATABASE erp_dev; --', "erp-dev", "ERP_DEV", "", "a b"]) {
    assert.throws(() => identificador(malo), /no admitido/, `aceptó «${malo}»`);
  }

  // La plantilla aporta máquina y credenciales; el nombre lo pone quien llama.
  assert.equal(
    nombreDeUrl(urlConBase("postgresql://usuario@maquina:5433/erp_dev", "erp_test_x")),
    "erp_test_x"
  );
  assert.equal(nombreDeUrl("file:./local.db"), null);

  // Y el rechazo ocurre antes de conectarse: no hace falta que haya servidor.
  await assert.rejects(
    eliminarBase("postgresql://postgres@localhost:59999/postgres", "erp_dev", "erp_test_"),
    /Se rechazó eliminar la base/
  );
});
