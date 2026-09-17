import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  MENSAJE_ERROR_DECLARACION,
  declaracionesParaDocumento,
  etiquetaEspecificacion,
  homologacionesPorVencer,
  textoDeclaracion,
  validarDeclaracion,
} from "@/lib/especificaciones";

// ---------------------------------------------------------------------------
// Qué declara un producto de lubricante sobre las normas del rubro.
//
// Un distribuidor no pregunta "¿qué aceite es?": pregunta "¿cumple API CK-4?",
// "¿sirve donde piden ACEA E9?". Esa respuesta vive en el maestro o no existe.
// Hasta ahora vivía en `notasTecnicas`, texto libre: se podía leer y nada más.
//
// Lo que estas pruebas cuidan es la distinción que el texto libre borra:
// **cumplir** no es lo mismo que estar **homologado**. Cumplir es una
// declaración propia del fabricante; una homologación la otorgó un tercero, con
// número y vigencia que quien recibe el documento puede ir a verificar.
//
// Aplanar las dos —que es lo que pasa cuando no hay estructura— deja que un
// certificado afirme una aprobación que nadie otorgó.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const HOY = new Date(2026, 8, 16);
const enDias = (n: number) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);

// --- La declaración no se puede contradecir --------------------------------

test("cumplir es una declaración propia y no lleva número", () => {
  assert.equal(
    validarDeclaracion({ tipo: "CUMPLE", numeroAprobacion: null, vigenteHasta: null }, HOY),
    null
  );
});

test("un «cumple» con número de aprobación se rechaza, no se limpia en silencio", () => {
  // Si alguien cargó un número, lo más probable es que se haya equivocado de
  // tipo, no de campo. Borrarlo callado perdería el dato y la intención.
  assert.equal(
    validarDeclaracion({ tipo: "CUMPLE", numeroAprobacion: "MB-12345", vigenteHasta: null }, HOY),
    "CUMPLE_CON_NUMERO"
  );
});

test("una homologación sin número no se puede verificar", () => {
  // LA regla. Sin número, el documento pide que le crean.
  assert.equal(
    validarDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: null, vigenteHasta: enDias(365) }, HOY),
    "APROBACION_SIN_NUMERO"
  );
  // Un número en blanco es no tener número.
  assert.equal(
    validarDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: "   ", vigenteHasta: enDias(365) }, HOY),
    "APROBACION_SIN_NUMERO"
  );
});

test("una homologación sin vigencia tampoco se sostiene", () => {
  assert.equal(
    validarDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: "MB-12345", vigenteHasta: null }, HOY),
    "APROBACION_SIN_VIGENCIA"
  );
});

test("no se carga una homologación que ya venció", () => {
  assert.equal(
    validarDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: "MB-12345", vigenteHasta: enDias(-1) }, HOY),
    "VIGENCIA_VENCIDA"
  );
  // Hoy mismo sí: rige hoy.
  assert.equal(
    validarDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: "MB-12345", vigenteHasta: HOY }, HOY),
    null
  );
});

test("cada error dice qué hacer, no solo que está mal", () => {
  // Un mensaje que solo niega deja a quien lo lee sin salida.
  assert.match(MENSAJE_ERROR_DECLARACION.APROBACION_SIN_NUMERO, /declárela como «cumple»/);
  assert.match(MENSAJE_ERROR_DECLARACION.VIGENCIA_VENCIDA, /renovación/);
  assert.match(MENSAJE_ERROR_DECLARACION.CUMPLE_CON_NUMERO, /homologación/);
});

// --- Cómo se nombra e imprime ----------------------------------------------

test("un código OEM no se lee sin su emisor", () => {
  // «228.31» no dice nada; «API CK-4» sí.
  assert.equal(
    etiquetaEspecificacion({ organismo: "OEM", codigo: "228.31", emisor: "Mercedes-Benz" }),
    "Mercedes-Benz 228.31"
  );
  assert.equal(etiquetaEspecificacion({ organismo: "API", codigo: "CK-4", emisor: null }), "API CK-4");
  // Sin emisor no se inventa uno ni se antepone «OEM», que no es nadie.
  assert.equal(etiquetaEspecificacion({ organismo: "OEM", codigo: "228.31", emisor: null }), "228.31");
});

test("el documento dice el número de la homologación y no finge uno para el cumplimiento", () => {
  assert.equal(
    textoDeclaracion({ tipo: "HOMOLOGADO", numeroAprobacion: "MB-12345" }),
    "Homologado n.º MB-12345"
  );
  assert.equal(textoDeclaracion({ tipo: "CUMPLE", numeroAprobacion: null }), "Cumple");
});

// --- Lo que un certificado puede afirmar hoy -------------------------------

test("una homologación vencida no se imprime, pero no se borra", () => {
  // El certificado se emite hoy: afirmar hoy una aprobación que dejó de regir
  // es afirmar algo que no es cierto, y quien lo reciba no la encontrará en la
  // lista del organismo.
  const declaraciones = [
    { id: "a", tipo: "CUMPLE" as const, vigenteHasta: null },
    { id: "b", tipo: "HOMOLOGADO" as const, vigenteHasta: enDias(200) },
    { id: "c", tipo: "HOMOLOGADO" as const, vigenteHasta: enDias(-1) },
  ];
  assert.deepEqual(
    declaracionesParaDocumento(declaraciones, HOY).map((d) => d.id),
    ["a", "b"]
  );
  // El dato sigue en la lista de origen: el filtro es del documento, no del
  // maestro.
  assert.equal(declaraciones.length, 3);
});

test("un «cumple» nunca caduca, porque no tiene de qué caducar", () => {
  const solo = [{ id: "a", tipo: "CUMPLE" as const, vigenteHasta: null }];
  assert.equal(declaracionesParaDocumento(solo, enDias(9999)).length, 1);
});

test("avisar antes de que venza es la mitad útil", () => {
  const declaraciones = [
    { tipo: "HOMOLOGADO" as const, vigenteHasta: enDias(20) },
    { tipo: "HOMOLOGADO" as const, vigenteHasta: enDias(200) },
    { tipo: "CUMPLE" as const, vigenteHasta: null },
  ];
  assert.equal(homologacionesPorVencer(declaraciones, 30, HOY).length, 1);
  assert.equal(homologacionesPorVencer(declaraciones, 365, HOY).length, 2);
});

// --- Guardias estructurales -------------------------------------------------

test("el catálogo no se siembra: cuáles maneja la empresa lo decide la empresa", async () => {
  // Qué códigos existen y cuáles siguen vigentes es conocimiento del rubro que
  // cambia —API CK-4 reemplazó a CJ-4—, y sembrar una lista sería declarar por
  // XXOIL qué dice cumplir. Mismo criterio que el checklist de cierre.
  for (const archivo of ["prisma/seed.ts", "prisma/seed-demo.ts"]) {
    const texto = await readFile(resolve(RAIZ, archivo), "utf8");
    assert.doesNotMatch(
      texto,
      /especificacionTecnica\.(create|createMany|upsert)/,
      `${archivo} está sembrando el catálogo de especificaciones`
    );
    assert.doesNotMatch(
      texto,
      /especificacionProducto\.(create|createMany|upsert)/,
      `${archivo} está declarando especificaciones por el negocio`
    );
  }
});

test("la acción valida con la librería y no confía en los ids del formulario", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/productos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /export async function declararEspecificacion/);
  assert.match(acciones, /validarDeclaracion\(/, "no usa la validación compartida");
  // El producto y la especificación se comprueban contra la compañía activa
  // antes de escribir: los dos llegan del navegador.
  assert.match(acciones, /producto\.findFirst\(\{ where: \{ id: productoId, empresaId \}/);
  assert.match(acciones, /especificacionTecnica\.findFirst/);
  assert.match(acciones, /activo: true/, "una especificación inactiva no debería declararse");
});

test("el certificado las imprime separadas de los ensayos del lote", async () => {
  // Mezclarlas con la tabla de mediciones haría creer que el lote se ensayó
  // contra API CK-4, cuando lo medido es lo que el plan de inspección dice.
  const certificado = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/certificados/[loteId]/page.tsx"),
    "utf8"
  );
  assert.match(certificado, /declaracionesParaDocumento\(/, "imprimiría homologaciones vencidas");
  assert.match(certificado, /Especificaciones del producto/);
  assert.match(certificado, /no a los ensayos de este lote/, "falta la leyenda que las separa");
});

test("se pueden cargar y declarar desde pantalla", async () => {
  // Un modelo sin captura es un modelo muerto.
  const catalogo = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/especificaciones/EspecificacionFormulario.tsx"),
    "utf8"
  );
  for (const campo of ["organismo", "codigo", "emisor", "descripcion"]) {
    assert.match(catalogo, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
  const ficha = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/productos/[id]/EspecificacionesProducto.tsx"),
    "utf8"
  );
  for (const campo of ["especificacionId", "tipo", "numeroAprobacion", "vigenteHasta"]) {
    assert.match(ficha, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
  // Y llega al menú: una pantalla sin enlace no existe para quien la usa.
  const navegacion = await readFile(resolve(RAIZ, "src/lib/navegacion.ts"), "utf8");
  assert.match(navegacion, /\/catalogo\/especificaciones/);
});

test("la pantalla del catálogo existe donde el menú la manda", async () => {
  const archivos = await readdir(resolve(RAIZ, "src/app/(app)/catalogo/especificaciones"));
  assert.ok(archivos.includes("page.tsx"), "no hay pantalla en la ruta del menú");
  assert.ok(archivos.includes("actions.ts"));
});

// --- Contra la base ---------------------------------------------------------

test("una especificación no se repite en la compañía ni un producto la declara dos veces", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `ESP-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });

  try {
    const espec = await prisma.especificacionTecnica.create({
      data: { empresaId, organismo: "API", codigo: `CK-${sufijo}` },
    });

    // El mismo organismo y código en la misma compañía se rechaza: dos filas
    // «API CK-4» dejarían al producto declarando contra cuál de las dos.
    await assert.rejects(
      prisma.especificacionTecnica.create({
        data: { empresaId, organismo: "API", codigo: `CK-${sufijo}` },
      })
    );

    await prisma.especificacionProducto.create({
      data: {
        empresaId,
        productoId: producto.id,
        especificacionId: espec.id,
        tipo: "CUMPLE",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    // Y el producto no la declara dos veces: la segunda contradiría a la
    // primera sin que nada dijera cuál rige.
    await assert.rejects(
      prisma.especificacionProducto.create({
        data: {
          empresaId,
          productoId: producto.id,
          especificacionId: espec.id,
          tipo: "HOMOLOGADO",
          numeroAprobacion: "X",
          vigenteHasta: new Date(2030, 0, 1),
          usuarioId: "u",
          usuarioNombre: "u",
        },
      })
    );

    // Borrar el producto se lleva sus declaraciones; la especificación del
    // catálogo sobrevive, porque otros productos la usan.
    await prisma.producto.delete({ where: { id: producto.id } });
    assert.equal(
      await prisma.especificacionProducto.count({ where: { productoId: producto.id } }),
      0
    );
    assert.equal(await prisma.especificacionTecnica.count({ where: { id: espec.id } }), 1);
    await prisma.especificacionTecnica.delete({ where: { id: espec.id } });
  } finally {
    await prisma.especificacionProducto.deleteMany({ where: { productoId: producto.id } });
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
  }
});

test("el catálogo es por compañía: una especificación de otra no se puede declarar", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const otraEmpresa = `empresa-esp-${sufijo}`;
  await prisma.empresa.create({ data: { id: otraEmpresa, razonSocial: otraEmpresa } });
  try {
    const ajena = await prisma.especificacionTecnica.create({
      data: { empresaId: otraEmpresa, organismo: "ACEA", codigo: `E9-${sufijo}` },
    });
    // La acción lo impide leyendo por `empresaId`; acá se deja constancia de
    // que el catálogo está particionado y no es una lista global.
    assert.equal(
      await prisma.especificacionTecnica.count({ where: { id: ajena.id, empresaId: "1" } }),
      0
    );
    await prisma.especificacionTecnica.delete({ where: { id: ajena.id } });
  } finally {
    await prisma.empresa.delete({ where: { id: otraEmpresa } }).catch(() => {});
  }
});


test("el aviso de vencimiento tiene consumidor: no es una función muerta", async () => {
  // `homologacionesPorVencer` se escribió en este mismo ciclo y estuvo a punto
  // de quedar sin llamador — el defecto que ya apareció antes en el proyecto:
  // esquema, captura, uso y guardia son cuatro cosas, no una.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/productos/[id]/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /homologacionesPorVencer\(/, "la función no la usa ninguna pantalla");
  assert.match(pagina, /vence en menos de/, "el aviso no se muestra");
});
