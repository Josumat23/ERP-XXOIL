// Mueve los datos de una base SQLite a la base PostgreSQL configurada.
//
//   node scripts/migrar-datos.mjs --desde local.db --simular
//   node scripts/migrar-datos.mjs --desde local.db
//
// Existe para una sola cosa: traer los datos que quedaron en `local.db` cuando
// el proyecto cambió de motor el 2026-09-15. No es una herramienta de
// sincronización ni corre sola.
//
// ---------------------------------------------------------------------------
// Por qué esto no es un `INSERT ... SELECT`
//
// Los dos esquemas son el mismo —173 tablas, las mismas columnas— pero los
// motores guardan los valores distinto, y **ninguna de esas diferencias falla
// al escribir**. Salen bien y quedan mal:
//
//   · Los booleanos en SQLite son 0 y 1. En PostgreSQL, `false` y `true`.
//   · Los decimales viajan como texto y no como número de JS, para que
//     29.5 no se convierta en otra cosa por el camino.
//   · Las fechas son la trampa de verdad. SQLite guarda
//     "2026-09-14T14:19:36.992+00:00" y las columnas de PostgreSQL son
//     `timestamp without time zone`. Si se pasa un `Date` de JS, el driver lo
//     serializa **en la zona horaria de la máquina** —acá UTC−5— y las 761
//     fechas del sistema quedarían corridas cinco horas. Sin un error, sin un
//     aviso: facturas emitidas cinco horas antes, asientos en otro día.
//
// Por eso cada fecha se escribe como hora UTC explícita, y por eso al final se
// comparan **todos los valores de todas las filas** contra el origen. No una
// muestra: los 2.752.
//
// ---------------------------------------------------------------------------
// Todo pasa dentro de UNA transacción
//
// `--simular` hace exactamente el mismo trabajo —inserta, comprueba las claves
// foráneas, valida los enums, verifica— y termina con ROLLBACK. Un ensayo que
// no ejerce las mismas escrituras no ensaya nada.
//
// Y si la verificación encuentra una sola diferencia, se deshace todo. Una
// migración a medias es peor que ninguna: deja la base con datos que parecen
// completos.
// ---------------------------------------------------------------------------
import "dotenv/config";
import Database from "better-sqlite3";
import pg from "pg";
import {
  convertirParaPostgres,
  normalizarDePostgres,
  normalizarDeSqlite,
} from "./lib/conversion.mjs";

// `timestamp without time zone` (OID 1114) llega como texto crudo y no como
// `Date`, para compararlo tal como quedó guardado en vez de reinterpretarlo en
// la zona horaria de esta máquina.
pg.types.setTypeParser(1114, (valor) => valor);

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const simular = process.argv.includes("--simular");
const forzar = process.argv.includes("--forzar");
const origen = argumento("desde");
const destinoUrl = argumento("hacia") ?? process.env.DATABASE_URL;

// Tablas que no se copian ni se miran. Existe por un caso concreto:
// `tareas_programadas` es la bitácora de cuándo corrió el planificador, y el
// destino genera la suya desde que arranca. Mezclar dos bitácoras de dos bases
// distintas no aporta nada y enreda la cronología — y exigir que el destino la
// tenga vacía obligaría a borrar filas para copiar un registro que a nadie le
// importa. Saltearla no destruye nada.
const excepto = new Set(
  (argumento("excepto") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

if (!origen) {
  console.error(
    "Falta --desde <archivo.db>. No hay valor por defecto a propósito: adivinar qué base leer\n" +
      "es como se termina copiando la equivocada."
  );
  process.exit(1);
}
if (!destinoUrl || !/^postgres(ql)?:\/\//.test(destinoUrl)) {
  console.error("El destino tiene que ser una URL de PostgreSQL (--hacia, o DATABASE_URL).");
  process.exit(1);
}

const sinCredenciales = (url) => {
  try {
    const u = new URL(url);
    u.password = "";
    u.username = "";
    return u.toString();
  } catch {
    return "la base configurada";
  }
};

const sqlite = new Database(origen, { readonly: true, fileMustExist: true });
const cliente = new pg.Client({ connectionString: destinoUrl });
await cliente.connect();

const limpio = (s) => s.replace(/^public\./, "").replaceAll('"', "");
const comillas = (s) => `"${s.replaceAll('"', '""')}"`;

console.log(`\n[migrar] Origen : ${origen}`);
console.log(`[migrar] Destino: ${sinCredenciales(destinoUrl)}`);
if (simular) console.log("[migrar] SIMULACIÓN: al final se deshace todo.");

let salida = 0;
try {
  await cliente.query("BEGIN");

  // --- Qué tablas hay, y que sean las mismas -------------------------------
  const tablasSqlite = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
    )
    .all()
    .map((t) => t.name)
    .filter((t) => !excepto.has(t));

  if (excepto.size > 0) console.log(`[migrar] Sin copiar: ${[...excepto].join(", ")}`);

  const { rows: filasTablas } = await cliente.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations'"
  );
  const tablasPg = new Set(filasTablas.map((r) => r.table_name));

  const ausentes = tablasSqlite.filter((t) => !tablasPg.has(t));
  if (ausentes.length > 0) {
    throw new Error(
      `El destino no tiene estas tablas del origen: ${ausentes.join(", ")}. ` +
        "Los dos esquemas tienen que ser el mismo; aplique las migraciones antes de copiar datos."
    );
  }

  // --- Tipos de cada columna, que es lo que decide cómo se convierte -------
  const { rows: columnas } = await cliente.query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns WHERE table_schema='public'
     ORDER BY table_name, ordinal_position`
  );
  const tipoDe = new Map();
  for (const c of columnas) tipoDe.set(`${c.table_name}.${c.column_name}`, c.data_type);

  // --- Orden de carga: una fila no puede apuntar a otra que todavía no está
  const { rows: fks } = await cliente.query(`
    SELECT c.conrelid::regclass::text AS origen,
           c.confrelid::regclass::text AS destino,
           (SELECT array_agg(a.attname ORDER BY x.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum) AS columnas
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'`);

  const dependeDe = new Map(tablasSqlite.map((t) => [t, new Set()]));
  // Las auto-referencias (una ubicación con ubicación padre, un empleado con
  // jefe) no se pueden resolver con el orden de las tablas: se insertan en
  // NULL y se completan al final, cuando todas las filas ya existen.
  const autoReferencias = new Map();
  for (const f of fks) {
    const o = limpio(f.origen);
    const d = limpio(f.destino);
    if (!dependeDe.has(o)) continue;
    if (o === d) {
      if (!autoReferencias.has(o)) autoReferencias.set(o, new Set());
      for (const col of f.columnas ?? []) autoReferencias.get(o).add(col);
    } else {
      dependeDe.get(o).add(d);
    }
  }

  const orden = [];
  const estado = new Map();
  const ordenar = (t, pila) => {
    if (estado.get(t) === "listo") return;
    if (estado.get(t) === "visitando") {
      throw new Error(
        `Ciclo de claves foráneas: ${[...pila.slice(pila.indexOf(t)), t].join(" -> ")}. ` +
          "No hay un orden de carga posible; hay que romperlo a mano."
      );
    }
    estado.set(t, "visitando");
    for (const d of dependeDe.get(t) ?? []) if (dependeDe.has(d)) ordenar(d, [...pila, t]);
    estado.set(t, "listo");
    orden.push(t);
  };
  for (const t of tablasSqlite) ordenar(t, []);

  // --- El destino tiene que estar vacío ------------------------------------
  const conDatos = [];
  for (const t of orden) {
    const { rows } = await cliente.query(`SELECT 1 FROM ${comillas(t)} LIMIT 1`);
    if (rows.length > 0) conDatos.push(t);
  }
  if (conDatos.length > 0 && !forzar) {
    throw new Error(
      `El destino ya tiene datos en ${conDatos.length} tabla(s): ${conDatos.slice(0, 5).join(", ")}` +
        `${conDatos.length > 5 ? ", …" : ""}.\n` +
        "Copiar encima duplicaría filas o chocaría contra los índices únicos. " +
        "Si de verdad corresponde, repita con --forzar."
    );
  }

  // --- Conversión de valores ----------------------------------------------
  //
  // Viven en `scripts/lib/conversion.mjs` y son funciones puras porque las tres
  // diferencias entre los motores NO fallan al escribir: salen bien y quedan
  // mal. La única forma de saber que están bien es probarlas, y acá dentro no
  // se pueden.
  const convertir = convertirParaPostgres;
  const normalizarPg = normalizarDePostgres;
  const normalizarSqlite = normalizarDeSqlite;

  // --- Copiar ---------------------------------------------------------------
  const pendientes = [];
  let insertadas = 0;
  const movidas = [];

  for (const tabla of orden) {
    const columnasTabla = sqlite
      .prepare("SELECT name FROM pragma_table_info(?)")
      .all(tabla)
      .map((c) => c.name);
    const filas = sqlite.prepare(`SELECT * FROM ${comillas(tabla)}`).all();
    if (filas.length === 0) continue;

    const diferidas = autoReferencias.get(tabla) ?? new Set();
    const lista = columnasTabla.map(comillas).join(", ");
    const marcadores = columnasTabla.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${comillas(tabla)} (${lista}) VALUES (${marcadores})`;

    for (const fila of filas) {
      const valores = columnasTabla.map((col) => {
        const tipo = tipoDe.get(`${tabla}.${col}`) ?? "text";
        if (diferidas.has(col) && fila[col] !== null) return null;
        return convertir(fila[col], tipo);
      });
      await cliente.query(sql, valores);
      insertadas++;

      for (const col of diferidas) {
        if (fila[col] !== null && fila[col] !== undefined) {
          pendientes.push({ tabla, col, id: fila.id, valor: fila[col] });
        }
      }
    }
    movidas.push([tabla, filas.length]);
  }

  console.log(`\n[migrar] ${insertadas} filas insertadas en ${movidas.length} tablas.`);

  // --- Completar las auto-referencias --------------------------------------
  for (const p of pendientes) {
    await cliente.query(
      `UPDATE ${comillas(p.tabla)} SET ${comillas(p.col)} = $1 WHERE ${comillas("id")} = $2`,
      [p.valor, p.id]
    );
  }
  if (pendientes.length > 0) {
    console.log(`[migrar] ${pendientes.length} referencias internas completadas.`);
  }

  // --- Verificar TODO, no una muestra --------------------------------------
  //
  // Las diferencias que importan no fallan al escribir, así que la única forma
  // de saber que los datos llegaron bien es traerlos de vuelta y compararlos.
  console.log("[migrar] Verificando fila por fila…");
  const problemas = [];
  let comparadas = 0;

  for (const [tabla] of movidas) {
    const columnasTabla = sqlite
      .prepare("SELECT name FROM pragma_table_info(?)")
      .all(tabla)
      .map((c) => c.name);
    const original = sqlite.prepare(`SELECT * FROM ${comillas(tabla)}`).all();
    const { rows: copiadas } = await cliente.query(`SELECT * FROM ${comillas(tabla)}`);

    if (original.length !== copiadas.length) {
      problemas.push(`${tabla}: ${original.length} filas en el origen y ${copiadas.length} en el destino`);
      continue;
    }

    const porId = new Map(copiadas.map((r) => [r.id, r]));
    for (const fila of original) {
      const copia = porId.get(fila.id);
      if (!copia) {
        problemas.push(`${tabla}: falta la fila ${fila.id}`);
        continue;
      }
      for (const col of columnasTabla) {
        const tipo = tipoDe.get(`${tabla}.${col}`) ?? "text";
        const esperado = normalizarSqlite(fila[col], tipo);
        const obtenido = normalizarPg(copia[col], tipo);
        comparadas++;
        if (esperado !== obtenido) {
          problemas.push(
            `${tabla}.${col} (fila ${fila.id}): origen ${JSON.stringify(esperado)} · destino ${JSON.stringify(obtenido)}`
          );
        }
      }
    }
  }

  console.log(`[migrar] ${comparadas} valores comparados.`);

  if (problemas.length > 0) {
    console.error(`\n[migrar] ${problemas.length} diferencia(s). Las primeras:`);
    for (const p of problemas.slice(0, 20)) console.error(`  ${p}`);
    throw new Error("La verificación falló: no se guardó nada.");
  }

  if (simular) {
    await cliente.query("ROLLBACK");
    console.log("\n[migrar] SIMULACIÓN correcta: todo se deshizo. Repita sin --simular para aplicarla.");
  } else {
    await cliente.query("COMMIT");
    console.log("\n[migrar] Listo. Los datos están en el destino y verificados.");
  }
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error(`\n[migrar] ${e instanceof Error ? e.message : e}`);
  console.error("[migrar] No se guardó nada: la transacción se deshizo entera.");
  salida = 1;
} finally {
  sqlite.close();
  await cliente.end();
}

process.exit(salida);
