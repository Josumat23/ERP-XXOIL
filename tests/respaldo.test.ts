import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import {
  CONTROLADOR_SQLITE,
  controladorDeArtefacto,
  controladorPara,
  crearRespaldo,
  detectarMotor,
  fechaDeRespaldo,
  esNombreRespaldo,
  nombreRespaldo,
  resolverOrigen,
  respaldoPendiente,
  respaldosAEliminar,
  restaurarRespaldo,
  rutaDentroDe,
  rutaDesdeUrlSqlite,
  sha256DeArchivo,
  verificarIntegridad,
  type ControladorRespaldo,
} from "@/lib/respaldo";

// El respaldo se ejerce SIEMPRE contra bases efímeras en el temporal del
// sistema. Ninguna prueba abre ni copia la base de desarrollo.
async function baseTemporal() {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-"));
  const archivo = join(directorio, "origen.db");
  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
  });
  await cliente.$executeRawUnsafe("CREATE TABLE prueba (id INTEGER PRIMARY KEY, valor TEXT)");
  await cliente.$executeRawUnsafe("INSERT INTO prueba (id, valor) VALUES (1, 'antes')");
  await cliente.$disconnect();
  return { directorio, archivo };
}

async function leerValor(archivo: string): Promise<string | undefined> {
  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
  });
  try {
    const filas = await cliente.$queryRawUnsafe<{ valor: string }[]>(
      "SELECT valor FROM prueba WHERE id = 1"
    );
    return filas[0]?.valor;
  } finally {
    await cliente.$disconnect();
  }
}

test("el nombre del respaldo ordena alfabéticamente en orden cronológico", () => {
  const enero = nombreRespaldo(new Date(2026, 0, 5, 3, 7, 9));
  const marzo = nombreRespaldo(new Date(2026, 2, 5, 3, 7, 9));
  assert.equal(enero, "erp-20260105-030709.db");
  assert.ok(enero < marzo);
  assert.equal(esNombreRespaldo(enero), true);
  assert.equal(esNombreRespaldo("otra-cosa.db"), false);
  assert.equal(esNombreRespaldo("erp-20260105-030709.db.parcial"), false);
});

test("la retención conserva los más nuevos y nunca borra todo por error", () => {
  const nombres = [
    "erp-20260101-000000.db",
    "erp-20260102-000000.db",
    "erp-20260103-000000.db",
    "ruido.txt",
  ];
  assert.deepEqual(respaldosAEliminar(nombres, 2), ["erp-20260101-000000.db"]);
  assert.deepEqual(respaldosAEliminar(nombres, 5), []);
  // Retención inválida o cero: no se borra nada. "No conservar ninguno" casi
  // siempre es un error de configuración, no una instrucción.
  assert.deepEqual(respaldosAEliminar(nombres, 0), []);
  assert.deepEqual(respaldosAEliminar(nombres, -1), []);
  assert.deepEqual(respaldosAEliminar(nombres, 1.5), []);
});

test("la ruta de respaldo se valida contra el escape de directorio", () => {
  assert.equal(rutaDentroDe("/respaldos/erp.db", "/respaldos"), true);
  assert.equal(rutaDentroDe("/respaldos/../otro/erp.db", "/respaldos"), false);
  assert.equal(rutaDentroDe("/respaldos", "/respaldos"), false);
});

test("la ruta del archivo se extrae de la URL de SQLite", () => {
  assert.equal(rutaDesdeUrlSqlite("file:./dev.db"), "./dev.db");
  assert.equal(rutaDesdeUrlSqlite("file:C:/datos/erp.db?mode=rwc"), "C:/datos/erp.db");
  assert.equal(rutaDesdeUrlSqlite("postgresql://host/db"), null);
  assert.equal(rutaDesdeUrlSqlite(undefined), null);
  assert.equal(rutaDesdeUrlSqlite("file:"), null);
});

test("el respaldo produce una copia verificada, con manifiesto y retención", async () => {
  const { directorio, archivo } = await baseTemporal();
  const destino = join(directorio, "respaldos");
  try {
    const resumen = await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 1, 1, 0, 0),
    });

    assert.ok(resumen.bytes > 0);
    assert.equal(resumen.sha256, await sha256DeArchivo(resumen.archivo));
    assert.equal(await verificarIntegridad(resumen.archivo), true);
    // La copia trae los datos, no solo el esquema.
    assert.equal(await leerValor(resumen.archivo), "antes");

    const manifiesto = await readFile(`${resumen.archivo}.sha256`, "utf8");
    assert.match(manifiesto, new RegExp(resumen.sha256));

    // El origen queda intacto: VACUUM INTO no lo modifica.
    assert.equal(await leerValor(archivo), "antes");

    // Con retención 2, el tercer respaldo elimina el primero.
    await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 2, 1, 0, 0),
    });
    const tercero = await crearRespaldo({
      origen: archivo,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 3, 1, 0, 0),
    });
    assert.deepEqual(tercero.eliminados, ["erp-20260101-010000.db"]);

    const quedan = (await readdir(destino)).filter((n) => esNombreRespaldo(n)).sort();
    assert.deepEqual(quedan, ["erp-20260102-010000.db", "erp-20260103-010000.db"]);
    // El manifiesto del eliminado se va con él, no queda huérfano.
    assert.equal((await readdir(destino)).includes("erp-20260101-010000.db.sha256"), false);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("la restauración devuelve los datos del respaldo y respeta las protecciones", async () => {
  const { directorio, archivo } = await baseTemporal();
  const destino = join(directorio, "respaldos");
  try {
    const resumen = await crearRespaldo({ origen: archivo, directorio: destino, retencion: 5 });

    // La base viva cambia DESPUÉS del respaldo.
    const cliente = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${archivo.replaceAll("\\", "/")}` }),
    });
    await cliente.$executeRawUnsafe("UPDATE prueba SET valor = 'despues' WHERE id = 1");
    await cliente.$disconnect();
    assert.equal(await leerValor(archivo), "despues");

    // Restaurar sobre un archivo existente exige confirmación explícita.
    await assert.rejects(
      restaurarRespaldo({ respaldo: resumen.archivo, destino: archivo }),
      /exige confirmarlo explícitamente/
    );
    assert.equal(await leerValor(archivo), "despues");

    // Restaurar sobre sí mismo se rechaza antes de tocar nada.
    await assert.rejects(
      restaurarRespaldo({ respaldo: resumen.archivo, destino: resumen.archivo, forzar: true }),
      /el mismo archivo/
    );

    // En una ruta nueva no hace falta forzar, y el dato vuelve al estado del respaldo.
    const copia = join(directorio, "restaurado.db");
    await restaurarRespaldo({ respaldo: resumen.archivo, destino: copia });
    assert.equal(await leerValor(copia), "antes");

    // Y con confirmación explícita, la base viva vuelve al estado respaldado:
    // este es el procedimiento de recuperación, ejercido de punta a punta.
    await restaurarRespaldo({ respaldo: resumen.archivo, destino: archivo, forzar: true });
    assert.equal(await leerValor(archivo), "antes");
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("un respaldo corrupto no se restaura", async () => {
  const { directorio, archivo } = await baseTemporal();
  try {
    const corrupto = join(directorio, "corrupto.db");
    await writeFile(corrupto, "esto no es una base SQLite", "utf8");
    await assert.rejects(
      restaurarRespaldo({ respaldo: corrupto, destino: join(directorio, "nuevo.db") }),
      /no se restauró nada|integridad/
    );
    // El origen sigue intacto tras el intento fallido.
    assert.equal(await leerValor(archivo), "antes");
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("la tarea de respaldo no corre sin RESPALDO_DIR configurado", async () => {
  // Instalar una versión nueva no debe empezar a escribir copias en una ruta
  // que nadie eligió.
  const tareas = await readFile(resolve(process.cwd(), "src/lib/tareasProgramadas.ts"), "utf8");
  assert.match(tareas, /RESPALDO_DIR/);
  assert.match(tareas, /Respaldo no configurado/);
  assert.match(tareas, /RESPALDO_BASE: ejecutarRespaldoBase/);
});

// --- El seam entre el núcleo y el motor ------------------------------------
//
// El módulo está partido en dos: un núcleo agnóstico —nombre, retención, hash,
// manifiesto, escribir en temporal y renombrar recién al verificar— y un
// controlador por motor. Estas pruebas ejercen el núcleo SIN SQLite, que es lo
// único que demuestra que la parte portable es de verdad portable.

function controladorFalso(registro: string[], integro = true): ControladorRespaldo {
  return {
    motor: "POSTGRES",
    extension: ".dump",
    copiar: async (origen, destino) => {
      assert.equal(origen.motor, "POSTGRES");
      registro.push("copiar");
      await writeFile(destino, `volcado de ${origen.motor}`, "utf8");
    },
    verificar: async () => {
      registro.push("verificar");
      return integro;
    },
    restaurar: async (respaldo, destino) => {
      registro.push("restaurar");
      await writeFile(destino, await readFile(respaldo, "utf8"), "utf8");
    },
  };
}

const URL_POSTGRES = "postgresql://erp:clave@localhost:5432/erp";

test("el motor se deduce de DATABASE_URL y PostgreSQL se reconoce", () => {
  // Antes esta pregunta no existía: rutaDesdeUrlSqlite devolvía null tanto para
  // una URL de PostgreSQL como para una cadena sin sentido, y el operador leía
  // "no apunta a un archivo SQLite" — cierto, pero inútil el día de migrar.
  assert.equal(detectarMotor("file:./dev.db"), "SQLITE");
  assert.equal(detectarMotor("postgres://h/db"), "POSTGRES");
  assert.equal(detectarMotor(URL_POSTGRES), "POSTGRES");
  assert.equal(detectarMotor("mysql://h/db"), null);
  assert.equal(detectarMotor(undefined), null);

  assert.deepEqual(resolverOrigen("file:C:/datos/erp.db?mode=rwc"), {
    motor: "SQLITE",
    archivo: "C:/datos/erp.db",
  });
  assert.deepEqual(resolverOrigen(URL_POSTGRES), { motor: "POSTGRES", url: URL_POSTGRES });
  assert.equal(resolverOrigen("file:"), null);
  assert.equal(resolverOrigen("mysql://h/db"), null);
});

test("PostgreSQL se reconoce pero no tiene controlador, y lo dice", () => {
  // Un respaldo que nunca se ejecutó contra una base real no es un respaldo:
  // es una creencia. El error nombra las herramientas que faltan para que
  // escribirlo no sea una investigación.
  assert.equal(controladorPara({ motor: "SQLITE", archivo: "x.db" }), CONTROLADOR_SQLITE);
  assert.throws(
    () => controladorPara({ motor: "POSTGRES", url: URL_POSTGRES }),
    /todavía no tiene controlador/
  );
  assert.throws(
    () => controladorPara({ motor: "POSTGRES", url: URL_POSTGRES }),
    /pg_dump\/pg_restore/
  );
});

test("el respaldo de PostgreSQL se niega antes de crear nada", async () => {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-pg-"));
  const destino = join(directorio, "respaldos");
  try {
    await assert.rejects(
      crearRespaldo({ origen: { motor: "POSTGRES", url: URL_POSTGRES }, directorio: destino }),
      /pg_dump/
    );
    // Ni siquiera se crea el directorio: un directorio de respaldos vacío
    // aparenta una cobertura que no existe.
    await assert.rejects(readdir(destino));
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("el núcleo conduce un motor que no es SQLite sin cambiar una línea", async () => {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-nucleo-"));
  const destino = join(directorio, "respaldos");
  const registro: string[] = [];
  const controlador = controladorFalso(registro);
  const origen = { motor: "POSTGRES", url: URL_POSTGRES } as const;
  try {
    const primero = await crearRespaldo({
      origen,
      controlador,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 1, 1, 0, 0),
    });

    // Nombre y extensión los pone el motor; el orden cronológico, el núcleo.
    assert.equal(primero.archivo, join(destino, "erp-20260101-010000.dump"));
    assert.equal(primero.sha256, await sha256DeArchivo(primero.archivo));
    assert.ok(primero.bytes > 0);
    // Se verifica antes de renombrar: no queda ningún .parcial.
    assert.deepEqual(registro, ["copiar", "verificar"]);
    assert.equal(
      (await readdir(destino)).some((n) => n.endsWith(".parcial")),
      false
    );

    const manifiesto = await readFile(`${primero.archivo}.sha256`, "utf8");
    assert.match(manifiesto, new RegExp(primero.sha256));

    // La retención es del núcleo y respeta la extensión del motor: un respaldo
    // de otro motor en el mismo directorio no se borra por error.
    await writeFile(join(destino, "erp-20250101-010000.db"), "respaldo de otro motor", "utf8");
    await crearRespaldo({
      origen,
      controlador,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 2, 1, 0, 0),
    });
    const tercero = await crearRespaldo({
      origen,
      controlador,
      directorio: destino,
      retencion: 2,
      ahora: new Date(2026, 0, 3, 1, 0, 0),
    });
    assert.deepEqual(tercero.eliminados, ["erp-20260101-010000.dump"]);
    assert.deepEqual(
      (await readdir(destino)).filter((n) => esNombreRespaldo(n, ".dump")).sort(),
      ["erp-20260102-010000.dump", "erp-20260103-010000.dump"]
    );
    assert.ok((await readdir(destino)).includes("erp-20250101-010000.db"));

    // Y la restauración pasa por el mismo controlador.
    const copia = join(directorio, "restaurado.dump");
    await restaurarRespaldo({ respaldo: tercero.archivo, destino: copia, controlador });
    assert.equal(await readFile(copia, "utf8"), "volcado de POSTGRES");
    assert.ok(registro.includes("restaurar"));
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("si el motor no verifica su propia copia, no queda un respaldo aparente", async () => {
  // Un respaldo corrupto que queda con nombre válido es peor que ninguno:
  // aparenta cobertura. Vale para cualquier motor, no solo para SQLite.
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-falla-"));
  const destino = join(directorio, "respaldos");
  try {
    await assert.rejects(
      crearRespaldo({
        origen: { motor: "POSTGRES", url: URL_POSTGRES },
        controlador: controladorFalso([], false),
        directorio: destino,
      }),
      /integridad/
    );
    assert.deepEqual(await readdir(destino), []);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("un controlador de otro motor no respalda este origen", async () => {
  const directorio = await mkdtemp(join(tmpdir(), "erp-respaldo-cruce-"));
  try {
    await assert.rejects(
      crearRespaldo({
        origen: { motor: "SQLITE", archivo: join(directorio, "x.db") },
        controlador: controladorFalso([]),
        directorio,
      }),
      /controlador es de POSTGRES/
    );
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

// --- Guardias estructurales -------------------------------------------------

test("las primitivas de SQLite no se filtran al núcleo", async () => {
  // Si VACUUM INTO vuelve a meterse en crearRespaldo, el día de migrar hay que
  // reescribir la retención y el manifiesto junto con el driver.
  const fuente = (await readFile(resolve(process.cwd(), "src/lib/respaldo.ts"), "utf8")).replace(
    /^\s*\/\/.*$/gm,
    ""
  );
  const nucleo = fuente.slice(fuente.indexOf("export async function crearRespaldo"));
  assert.ok(nucleo.length > 0, "no se encontró el núcleo");
  for (const primitiva of ["VACUUM", "integrity_check", "conClienteSqlite", "PrismaClient"]) {
    assert.ok(!nucleo.includes(primitiva), `${primitiva} volvió a filtrarse al núcleo`);
  }
  // Y el controlador sí las tiene: la guardia no pasa por haberlas borrado.
  const controlador = fuente.slice(
    fuente.indexOf("export const CONTROLADOR_SQLITE"),
    fuente.indexOf("export function controladorPara")
  );
  assert.match(controlador, /VACUUM INTO/);
});

test("quien opera el respaldo ya no lee que la URL no es un archivo SQLite", async () => {
  // El mensaje viejo era cierto y a la vez inútil: lo que hace falta saber es
  // que el motor se reconoce y que falta su controlador.
  for (const ruta of ["src/lib/tareasProgramadas.ts", "scripts/respaldo.ts"]) {
    // Sin los comentarios: la guardia es sobre lo que se ejecuta, y el porqué
    // del cambio sí menciona el mensaje viejo.
    const fuente = (await readFile(resolve(process.cwd(), ruta), "utf8")).replace(
      /^\s*\/\/.*$/gm,
      ""
    );
    assert.ok(
      !fuente.includes("no apunta a un archivo SQLite"),
      `${ruta} sigue con el mensaje viejo`
    );
    assert.match(fuente, /resolverOrigen/, `${ruta} no resuelve el motor`);
  }
});

test("el artefacto se restaura con el controlador de su propia extensión", () => {
  assert.equal(controladorDeArtefacto("erp-20260101-010000.db"), CONTROLADOR_SQLITE);
  assert.throws(
    () => controladorDeArtefacto("erp-20260101-010000.dump"),
    /no corresponde a ningún motor con soporte/
  );
});

// --- Los comandos del operador arrancan de verdad ---------------------------
//
// `npm run respaldo` y `npm run restaurar` morían al importar TypeScript:
// definían NODE_OPTIONS dentro de un proceso que ya había arrancado, así que
// nadie registraba tsx y el alias `@/` no resolvía. Ninguna prueba lo notaba
// porque todas importaban la librería directamente. Estas dos ejecutan los
// comandos tal cual los corre una persona.

function correrComando(script: string, argumentos: string[], databaseUrl: string) {
  return spawnSync(process.execPath, [resolve(process.cwd(), script), ...argumentos], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

test("el comando de respaldo arranca y explica qué falta para PostgreSQL", () => {
  const resultado = correrComando("scripts/respaldo.mjs", ["--dir", "sin-usar"], URL_POSTGRES);
  assert.equal(resultado.status, 1);
  // El mensaje llega al operador entero: si el script no arrancara, aquí
  // habría un ERR_MODULE_NOT_FOUND en vez de esto.
  assert.match(resultado.stderr, /pg_dump\/pg_restore/);
  assert.ok(!resultado.stderr.includes("ERR_MODULE_NOT_FOUND"), resultado.stderr);
});

test("el comando de restauración arranca y explica su uso", () => {
  const resultado = correrComando("scripts/restaurar.mjs", [], "file:sin-usar.db");
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /npm run restaurar -- --respaldo/);
  assert.ok(!resultado.stderr.includes("ERR_MODULE_NOT_FOUND"), resultado.stderr);
});

// --- Cadencia: la tarea corre cada hora, el respaldo no ---------------------
//
// La pantalla de tareas programadas promete que cada tarea "revisa primero si
// ya hizo lo que tenía que hacer, así que Ejecutar ahora nunca duplica nada".
// El respaldo no lo revisaba: creaba una copia en cada corrida —cada hora y en
// cada arranque del servidor— y cada copia eliminaba una vieja por retención.
// Con retención 7 se conservaban las últimas 7 horas en vez de la última
// semana, y pulsar "Ejecutar ahora" siete veces borraba el historial entero.

test("la fecha sale del nombre, y un nombre imposible no se convierte en otra fecha", () => {
  assert.deepEqual(fechaDeRespaldo("erp-20260105-030709.db"), new Date(2026, 0, 5, 3, 7, 9));
  assert.equal(fechaDeRespaldo("erp-20260105-030709.dump", ".dump")?.getFullYear(), 2026);
  assert.equal(fechaDeRespaldo("otra-cosa.db"), null);
  assert.equal(fechaDeRespaldo("erp-20260105-030709.db.parcial"), null);
  assert.equal(fechaDeRespaldo("erp-sin-fecha.db"), null);
  // `new Date(2026, 12, 40)` no falla: se desborda al mes siguiente.
  assert.equal(fechaDeRespaldo("erp-20261340-030709.db"), null);
  assert.equal(fechaDeRespaldo("erp-20260230-030709.db"), null);
});

test("no se respalda otra vez antes de que pase el intervalo", () => {
  const ahora = new Date(2026, 0, 10, 12, 0, 0);
  const hace2h = ["erp-20260110-100000.db"];
  const hace30h = ["erp-20260109-060000.db"];

  // Un directorio vacío siempre corresponde: no hay respaldo que valga.
  assert.equal(respaldoPendiente({ nombres: [], ahora, intervaloHoras: 24 }), true);
  assert.equal(respaldoPendiente({ nombres: hace2h, ahora, intervaloHoras: 24 }), false);
  assert.equal(respaldoPendiente({ nombres: hace30h, ahora, intervaloHoras: 24 }), true);
  // El más reciente manda, no el primero de la lista.
  assert.equal(
    respaldoPendiente({ nombres: [...hace30h, ...hace2h], ahora, intervaloHoras: 24 }),
    false
  );
  // Quien quiera respaldos por hora lo configura; no se inventa la cadencia.
  assert.equal(respaldoPendiente({ nombres: hace2h, ahora, intervaloHoras: 1 }), true);
  // Justo al cumplirse el intervalo ya corresponde.
  assert.equal(
    respaldoPendiente({ nombres: ["erp-20260109-120000.db"], ahora, intervaloHoras: 24 }),
    true
  );
});

test("lo que no es un respaldo de este motor no cuenta como respaldo", () => {
  const ahora = new Date(2026, 0, 10, 12, 0, 0);
  // Un `.db` en el directorio no prueba que el volcado de PostgreSQL se hizo.
  assert.equal(
    respaldoPendiente({
      nombres: ["erp-20260110-100000.db", "ruido.txt"],
      ahora,
      intervaloHoras: 24,
      extension: ".dump",
    }),
    true
  );
  assert.equal(
    respaldoPendiente({
      nombres: ["erp-20260110-100000.dump"],
      ahora,
      intervaloHoras: 24,
      extension: ".dump",
    }),
    false
  );
});

test("un intervalo sin sentido no se obedece, y un reloj hacia atrás no bloquea", () => {
  const ahora = new Date(2026, 0, 10, 12, 0, 0);
  const hace2h = ["erp-20260110-100000.db"];
  // Igual que con la retención: "respaldar en cada corrida" casi siempre es un
  // error de configuración y no una instrucción. Vale el de por defecto, 24 h.
  for (const intervalo of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      respaldoPendiente({ nombres: hace2h, ahora, intervaloHoras: intervalo }),
      false,
      `intervalo ${intervalo}`
    );
  }
  // Una marca en el futuro —reloj corregido, copia traída de otra máquina— no
  // puede dejar el respaldo esperando a que el tiempo la alcance.
  assert.equal(
    respaldoPendiente({ nombres: ["erp-20260112-100000.db"], ahora, intervaloHoras: 24 }),
    true
  );
});

test("la cadencia protege la retención: siete corridas no borran la semana", async () => {
  // Reproduce lo que pasaba: siete corridas seguidas con retención 7 dejaban
  // siete copias de la misma hora y ningún día anterior.
  const { directorio, archivo } = await baseTemporal();
  const destino = join(directorio, "respaldos");
  try {
    // Historial de una semana, uno por día.
    for (let dia = 1; dia <= 7; dia++) {
      await crearRespaldo({
        origen: archivo,
        directorio: destino,
        retencion: 7,
        ahora: new Date(2026, 0, dia, 3, 0, 0),
      });
    }
    const semana = (await readdir(destino)).filter((n) => esNombreRespaldo(n)).sort();
    assert.equal(semana.length, 7);

    // Siete corridas de la tarea el día 7, una por hora, como el temporizador.
    // Sin la pregunta, cada una crearía un archivo distinto y la retención de 7
    // se llevaría los siete días anteriores.
    for (let hora = 12; hora < 19; hora++) {
      const ahora = new Date(2026, 0, 7, hora, 0, 0);
      const existentes = await readdir(destino);
      if (respaldoPendiente({ nombres: existentes, ahora, intervaloHoras: 24 })) {
        await crearRespaldo({ origen: archivo, directorio: destino, retencion: 7, ahora });
      }
    }

    const despues = (await readdir(destino)).filter((n) => esNombreRespaldo(n)).sort();
    // La semana sigue entera y no se creó ninguna copia nueva: la última es de
    // hace nueve horas.
    assert.deepEqual(despues, semana);
    const dias = new Set(despues.map((n) => n.slice(0, "erp-20260101".length)));
    assert.equal(dias.size, 7, `el historial se aplastó a ${dias.size} día(s)`);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("la tarea de respaldo no crea una copia en cada corrida", async () => {
  // Guardia estructural: la tarea corre cada hora y en cada arranque. Si vuelve
  // a llamar a crearRespaldo sin preguntar, la retención se consume en horas.
  const tareas = (
    await readFile(resolve(process.cwd(), "src/lib/tareasProgramadas.ts"), "utf8")
  ).replace(/^\s*\/\/.*$/gm, "");
  const bloque = tareas.slice(
    tareas.indexOf("async function ejecutarRespaldoBase"),
    tareas.indexOf("const EJECUTORES")
  );
  assert.ok(bloque.length > 0, "no se encontró la tarea de respaldo");
  assert.match(bloque, /respaldoPendiente\(/);
  assert.ok(
    bloque.indexOf("respaldoPendiente(") < bloque.indexOf("crearRespaldo("),
    "se pregunta después de respaldar, que es no preguntar"
  );
  assert.match(bloque, /RESPALDO_INTERVALO_HORAS|INTERVALO_RESPALDO_HORAS/);
});
