import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cantidadDeclarada,
  contenidoLitrosCoherente,
  densidadAplicable,
  densidadFueraDeRangoTipico,
  esUnidadDeContenido,
  kgALitros,
  litrosAGalones,
  litrosAKg,
  LITROS_POR_GALON,
  type Densidad,
} from "@/lib/densidad";

// ---------------------------------------------------------------------------
// El granel se produce y se cuesta en kilogramos; el producto se vende y se
// declara a SUNAT en litros o galones. El puente es la densidad, y hasta el
// 2026-09-16 no existía en el sistema: `Presentacion.contenidoLitros` era un
// número escrito a mano que el propio esquema documentaba como «informativo».
// ---------------------------------------------------------------------------

const DENSIDAD_TIPICA: Densidad = {
  kgPorLitro: 0.88,
  temperaturaC: 15,
  origen: "ESPECIFICACION_PRODUCTO",
};

test("la densidad del lote manda sobre la del producto", () => {
  // La especificación dice a qué se apunta; la medición dice qué salió. Lo que
  // se envasó es lo que salió.
  const d = densidadAplicable({ densidadLoteKgL: 0.891, densidadProductoKgL: 0.88 });
  assert.notEqual(typeof d, "string");
  assert.equal((d as Densidad).kgPorLitro, 0.891);
  assert.equal((d as Densidad).origen, "LOTE_MEDIDO");
});

test("sin densidad no se convierte, en vez de suponer un factor", () => {
  // Es la diferencia con SAP/Epicor: ahí un factor fijo por material convierte
  // igual y se equivoca en silencio. Acá falta el dato y se dice.
  assert.equal(densidadAplicable({}), "SIN_DENSIDAD");
  assert.equal(densidadAplicable({ densidadProductoKgL: 0 }), "DENSIDAD_INVALIDA");
  assert.equal(densidadAplicable({ densidadProductoKgL: -1 }), "DENSIDAD_INVALIDA");
});

test("la conversión dice con qué densidad se hizo", () => {
  // Una cantidad declarada en un comprobante fiscal tiene que poder auditarse
  // hasta su origen: no alcanza con el número.
  const { litros, densidad } = kgALitros(176, DENSIDAD_TIPICA);
  assert.equal(Math.round(litros * 100) / 100, 200);
  assert.equal(densidad.origen, "ESPECIFICACION_PRODUCTO");
  assert.equal(densidad.temperaturaC, 15);

  // Y la vuelta cierra.
  assert.equal(Math.round(litrosAKg(litros, DENSIDAD_TIPICA).kg * 1e6) / 1e6, 176);
});

test("el galón es el estadounidense, que es el del Catálogo 03", () => {
  assert.equal(LITROS_POR_GALON, 3.785411784);
  assert.equal(Math.round(litrosAGalones(3.785411784) * 1e6) / 1e6, 1);
});

test("una densidad con la coma corrida se detecta", () => {
  // 8,7 en vez de 0,87 daría un volumen diez veces menor y una factura
  // equivocada. Se avisa, no se prohíbe.
  assert.equal(densidadFueraDeRangoTipico(0.87), false);
  assert.equal(densidadFueraDeRangoTipico(8.7), true);
  assert.equal(densidadFueraDeRangoTipico(0.087), true);
  // Los extremos del rubro siguen siendo válidos.
  assert.equal(densidadFueraDeRangoTipico(0.8), false);
  assert.equal(densidadFueraDeRangoTipico(1.05), false);
});

test("el contenido en litros se contrasta con el peso y la densidad", () => {
  // Un balde de 20 kg a 0,88 kg/L son 22,7 L. Si alguien escribe 20, el error
  // viaja hasta la factura — y hasta hoy nadie lo comparaba con nada.
  const malo = contenidoLitrosCoherente({
    contenidoKg: 20,
    contenidoLitros: 20,
    densidad: DENSIDAD_TIPICA,
  });
  assert.equal(malo.coherente, false);
  assert.equal(Math.round(malo.litrosEsperados * 10) / 10, 22.7);

  const bueno = contenidoLitrosCoherente({
    contenidoKg: 20,
    contenidoLitros: 22.7,
    densidad: DENSIDAD_TIPICA,
  });
  assert.equal(bueno.coherente, true);

  // La tolerancia existe porque el contenido nominal de un envase es un número
  // comercial redondeado: 22,5 sigue siendo aceptable.
  assert.equal(
    contenidoLitrosCoherente({
      contenidoKg: 20,
      contenidoLitros: 22.5,
      densidad: DENSIDAD_TIPICA,
    }).coherente,
    true
  );
});

// --- El defecto que motivó todo esto ---------------------------------------

test("un envase declarado en litros ya no declara la cantidad de envases", () => {
  // ESTE es el defecto. Antes: `unidadMedida: "LTR"` con `cantidad: 10`, siendo
  // 10 la cantidad de baldes. La factura decía «10 LTR» por 200 litros.
  const r = cantidadDeclarada({
    unidadMedidaSunat: "LTR",
    unidades: 10,
    contenidoKg: 17.6,
    contenidoLitros: 20,
  });
  assert.ok(!("error" in r));
  assert.equal(r.cantidad, 200);
  assert.equal(r.unidad, "LTR");
});

test("en unidades se sigue declarando la cantidad de envases", () => {
  // NIU es lo correcto para un producto envasado y es el comportamiento que ya
  // había: esto no puede cambiar bajo los pies de nadie.
  const r = cantidadDeclarada({ unidadMedidaSunat: "NIU", unidades: 10, contenidoKg: 17.6 });
  assert.ok(!("error" in r));
  assert.equal(r.cantidad, 10);
  assert.equal(r.densidadUsada, null, "NIU no necesita densidad");
});

test("en kilogramos no hace falta densidad", () => {
  const r = cantidadDeclarada({ unidadMedidaSunat: "KGM", unidades: 10, contenidoKg: 17.6 });
  assert.ok(!("error" in r));
  assert.equal(r.cantidad, 176);
});

test("en litros sin volumen cargado se deriva del peso, y se dice", () => {
  const r = cantidadDeclarada({
    unidadMedidaSunat: "LTR",
    unidades: 10,
    contenidoKg: 17.6,
    contenidoLitros: null,
    densidad: DENSIDAD_TIPICA,
  });
  assert.ok(!("error" in r));
  assert.equal(Math.round(r.cantidad * 100) / 100, 200);
  // La densidad usada viaja con el resultado: es lo que permite auditar la
  // cifra declarada.
  assert.equal(r.densidadUsada?.kgPorLitro, 0.88);
});

test("sin datos para convertir, el comprobante no se arma", () => {
  // Emitir una cantidad inventada en un documento fiscal es peor que no
  // emitirlo.
  assert.deepEqual(
    cantidadDeclarada({ unidadMedidaSunat: "LTR", unidades: 10, contenidoKg: 17.6 }),
    { error: "SIN_DENSIDAD" }
  );
  assert.deepEqual(cantidadDeclarada({ unidadMedidaSunat: "KGM", unidades: 10 }), {
    error: "FALTA_CONTENIDO",
  });
});

test("los galones se convierten desde litros, no desde kilos", () => {
  const r = cantidadDeclarada({
    unidadMedidaSunat: "GLL",
    unidades: 1,
    contenidoKg: 17.6,
    contenidoLitros: 20,
  });
  assert.ok(!("error" in r));
  assert.equal(Math.round(r.cantidad * 1e4) / 1e4, Math.round((20 / LITROS_POR_GALON) * 1e4) / 1e4);
});

test("solo tres códigos cuentan contenido", () => {
  assert.equal(esUnidadDeContenido("LTR"), true);
  assert.equal(esUnidadDeContenido("GLL"), true);
  assert.equal(esUnidadDeContenido("KGM"), true);
  assert.equal(esUnidadDeContenido("NIU"), false);
  assert.equal(esUnidadDeContenido("BLL"), false, "BLL no está contemplado: declararía mal");
  assert.equal(esUnidadDeContenido("ZZ"), false);
});

// --- Guardias estructurales -------------------------------------------------

test("las tres salidas de comprobante declaran con la misma regla", async () => {
  // Factura, nota de crédito y guía escribían `cantidad: d.cantidad` cada una
  // por su cuenta: por eso el defecto estaba en las tres a la vez. Si alguna
  // vuelve a resolverlo sola, las pruebas de arriba seguirían pasando mientras
  // el comprobante real declara mal.
  const salidas = [
    "src/app/(app)/comercial/facturas/actions.ts",
    "src/lib/guiasRemision.ts",
  ];
  for (const ruta of salidas) {
    const fuente = (await readFile(resolve(process.cwd(), ruta), "utf8")).replace(
      /^\s*\/\/.*$/gm,
      ""
    );
    assert.match(fuente, /itemComprobante\(/, `${ruta} no usa el ayudante compartido`);
    assert.doesNotMatch(
      fuente,
      /unidadMedida:\s*\w+\.presentacion\.unidadMedidaSunat/,
      `${ruta} volvió a armar el ítem por su cuenta`
    );
  }

  // Y el ayudante sí convierte: la guardia no pasa por haberlo vaciado.
  const ayudante = await readFile(resolve(process.cwd(), "src/lib/itemComprobante.ts"), "utf8");
  assert.match(ayudante, /cantidadDeclaradaDePresentacion/);
});

test("el producto deja cargar densidad, y no sin temperatura", async () => {
  // Un campo que no se puede llenar desde ninguna pantalla es un campo muerto.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/catalogo/productos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /densidadKgL/);
  assert.match(acciones, /temperaturaReferenciaC/);
  // Una densidad sin temperatura no significa nada y se rechaza.
  assert.match(acciones.replace(/^\s*\/\/.*$/gm, ""), /densidadKgL !== null && temperaturaReferenciaC === null/);

  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/catalogo/productos/ProductoFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /name="densidadKgL"/);
  assert.match(formulario, /name="temperaturaReferenciaC"/);
});

test("el lote captura su densidad medida, y avisa si la coma está corrida", async () => {
  // Una columna que nada escribe es un campo muerto — el mismo defecto que
  // esta tanda vino a corregir, así que no puede reintroducirse acá.
  const fuente = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/lotes/actions.ts"),
    "utf8"
  );
  assert.match(fuente, /formData\.get\("densidadKgL"\)/, "no se captura la densidad al finalizar");
  assert.match(fuente, /densidadKgL,/, "la densidad capturada no se guarda");
  assert.match(fuente, /densidadFueraDeRangoTipico/, "no se avisa de una densidad imposible");

  // Y el formulario tiene que mandarla: una acción que lee un campo que nadie
  // envía es la misma clase de camino muerto.
  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/lotes/[id]/FinalizarLoteFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /name="densidadKgL"/, "el formulario no envía la densidad que la acción lee");
});

test("el contenido en litros se contrasta al crear y al editar", async () => {
  // Validar solo en el alta deja la puerta abierta: se crea bien y se edita mal.
  const fuente = await readFile(
    resolve(process.cwd(), "src/app/(app)/catalogo/presentaciones/actions.ts"),
    "utf8"
  );
  assert.equal(
    fuente.split("await contenidoIncoherente(").length - 1,
    2,
    "la coherencia tiene que comprobarse en crear Y en actualizar"
  );
  // Y solo cuando hay densidad: los productos que aún no la tienen siguen
  // funcionando: la restricción se activa sola al cargar el dato.
  assert.match(fuente, /if \(typeof densidad === "string"\) return null;/);
});

test("la densidad es un campo del producto y del lote, no una constante", async () => {
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

  const producto = esquema.slice(
    esquema.indexOf("model Producto {"),
    esquema.indexOf("model ", esquema.indexOf("model Producto {") + 10)
  );
  assert.ok(producto.length > 300, "el corte quedó vacío");
  assert.match(producto, /densidadKgL\s+Decimal\?/);
  // Sin temperatura una densidad no significa nada.
  assert.match(producto, /temperaturaReferenciaC\s+Decimal\?/);

  const lote = esquema.slice(
    esquema.indexOf("model LoteGranel {"),
    esquema.indexOf("model ", esquema.indexOf("model LoteGranel {") + 10)
  );
  assert.ok(lote.length > 300, "el corte quedó vacío");
  assert.match(lote, /densidadKgL\s+Decimal\?/, "el lote tiene que poder llevar su densidad medida");
});

test("los dos campos son opcionales: no se inventa la densidad de lo que ya existe", async () => {
  // Hacerlos obligatorios exigiría rellenar los productos existentes con un
  // número inventado, que es precisamente el error que este módulo evita.
  const migracion = await readFile(
    resolve(process.cwd(), "prisma/migrations/20260916000000_densidad_producto_lote/migration.sql"),
    "utf8"
  ).catch(async () => {
    const { readdir } = await import("node:fs/promises");
    const dirs = await readdir(resolve(process.cwd(), "prisma/migrations"));
    const d = dirs.find((n) => n.includes("densidad"));
    assert.ok(d, "no se encontró la migración de densidad");
    return readFile(resolve(process.cwd(), "prisma/migrations", d, "migration.sql"), "utf8");
  });
  assert.match(migracion, /ADD COLUMN\s+"densidadKgL"/);
  assert.doesNotMatch(migracion, /NOT NULL/, "las columnas nuevas no pueden ser obligatorias");
  assert.doesNotMatch(migracion, /DEFAULT/, "un valor por defecto sería una densidad inventada");
});
