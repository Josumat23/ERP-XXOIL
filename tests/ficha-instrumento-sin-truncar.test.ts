import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// La ficha del instrumento decía menos de lo que sabía, y no lo decía.
//
// «Qué se midió con este instrumento» traía sus filas con un tope de 300
// COMPARTIDO entre todos los instrumentos, ordenado por fecha descendente. Con
// los datos de hoy —seis mediciones— funciona. Con volumen real, el
// instrumento que más se usa se lleva el tope entero y uno poco usado aparece
// SIN NINGUNA medición.
//
// No «con menos»: con ninguna. Y en pantalla eso se lee exactamente igual que
// «nunca midió nada». La columna que se estaba ocultando es la del RESPALDO de
// calibración, o sea justo la evidencia que esta pantalla existe para dar: un
// jefe de calidad revisando qué quedó sin respaldo concluiría que no hay nada.
//
// Es el mismo defecto que el recall por lote del proveedor: una respuesta
// incompleta con cara de completa. Acá se arregla separando las dos preguntas:
// CUÁNTO midió cada instrumento —conteo exacto, agrupado en la base— y QUÉ
// midió, que se consulta de a un instrumento y por eso no comparte tope con
// nadie.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const PAGINA = "src/app/(app)/produccion/calidad/instrumentos/page.tsx";

const leerPagina = () => readFile(resolve(RAIZ, PAGINA), "utf8");

// --- La pantalla ------------------------------------------------------------

test("ningún instrumento comparte tope con otro", async () => {
  // La guarda central. `{ in: idsInstrumento }` en las consultas de detalle es
  // exactamente la forma que producía la inanición.
  const pagina = await leerPagina();
  const detalle = pagina.slice(pagina.indexOf("const [deLiberacion"));
  assert.doesNotMatch(
    detalle,
    /instrumentoId: \{ in: idsInstrumento \}/,
    "las mediciones volvieron a traerse de todos los instrumentos con un tope común"
  );
  const porUno = detalle.match(/instrumentoId: instrumentoAbierto/g) ?? [];
  assert.equal(porUno.length, 3, "alguna de las tres clases de ensayo no se acota al instrumento");
});

test("el conteo se hace en la base, no contando filas traídas", async () => {
  // Traer las filas para contarlas es lo que obliga a poner un tope, y el tope
  // es lo que hace mentir al conteo.
  const pagina = await leerPagina();
  assert.match(pagina, /groupBy\(\{/, "no se agrupa en la base");
  assert.match(pagina, /by: \["instrumentoId"\]/);
  assert.match(pagina, /medidasPorInstrumento/);
});

test("el conteo y la lista excluyen lo mismo", async () => {
  // Una inspección pendiente no tiene fecha: no se ensayó nada, no se lista, y
  // por lo tanto tampoco se cuenta. Si una sola de las dos la incluyera, la
  // pantalla diría «3 de 4» teniendo las 3 que hay.
  const pagina = await leerPagina();
  assert.match(pagina, /const deRecepcionDeLaCompania = \{/);
  assert.match(pagina, /fecha: \{ not: null \}/, "el conteo incluiría inspecciones pendientes");
  // La misma condición sirve a las dos: se declara una vez y se reutiliza.
  const usos = pagina.match(/\.\.\.deRecepcionDeLaCompania/g) ?? [];
  assert.equal(usos.length, 2, "el conteo y la lista dejaron de compartir la condición");
});

test("cuánto midió se dice siempre, incluso si es cero", async () => {
  // Que no apareciera nada era lo que hacía indistinguible «no midió nunca» de
  // «su tope se lo llevó otro instrumento».
  const pagina = await leerPagina();
  assert.match(pagina, /Todavía no se registró ninguna medición con este instrumento/);
  assert.match(pagina, /medici\{medidas === 1 \? "ón" : "ones"\} registrada/);
});

test("si la lista está recortada, la pantalla lo dice", async () => {
  const pagina = await leerPagina();
  assert.match(pagina, /medidas > medicionesDelAbierto\.length &&/);
  assert.match(pagina, /Se muestran las \{medicionesDelAbierto\.length\} más recientes de \{medidas\}/);
  // Y manda a donde sí está la respuesta completa y ordenada por urgencia.
  assert.match(pagina, /\/produccion\/calidad\/reensayos/);
});

test("el instrumento que se pide ver se comprueba contra la compañía", async () => {
  // El id llega del navegador. Sin la comprobación, `?mediciones=<id ajeno>`
  // mostraría las mediciones de otra empresa.
  const pagina = await leerPagina();
  assert.match(
    pagina,
    /medicionesPedidas && idsInstrumento\.includes\(medicionesPedidas\) \? medicionesPedidas : null/,
    "el id del navegador se usa sin comprobarlo"
  );
  // Y esa lista sale de una consulta acotada por empresa.
  assert.match(pagina, /const idsInstrumento = instrumentos\.map\(\(i\) => i\.id\)/);
  assert.match(pagina, /prisma\.instrumentoMedicion\.findMany\(\{\s*where: \{ empresaId \}/);
});

test("no se consulta el detalle si nadie lo pidió", async () => {
  // La pantalla lista todos los instrumentos; traer las mediciones de todos
  // para no mostrarlas sería pagar el costo sin el beneficio.
  const pagina = await leerPagina();
  assert.match(pagina, /instrumentoAbierto === null\s*\?\s*\[\[\], \[\], \[\]\]/);
});

// --- Contra la base ---------------------------------------------------------

type Montaje = {
  empresaId: string;
  instrumentoA: string;
  instrumentoB: string;
  limpiar: () => Promise<void>;
};

/**
 * Dos instrumentos, uno muy usado y otro poco.
 *
 * `medicionesA` lecturas recientes del primero y una sola, más antigua, del
 * segundo: la forma exacta en la que el tope compartido dejaba al segundo sin
 * nada.
 */
async function montar(sufijo: string, medicionesA: number): Promise<Montaje> {
  const empresaId = `empresa-fi-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const proveedor = await prisma.proveedor.create({
    data: { empresaId, razonSocial: `Proveedor ${sufijo}` },
  });
  const insumo = await prisma.insumo.create({
    data: {
      empresaId,
      codigo: `INS-${sufijo}`,
      nombre: "Aceite base",
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
    },
  });
  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-FI-${sufijo}`,
      proveedorId: proveedor.id,
      total: 10,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: {
      empresaId,
      ordenCompraId: orden.id,
      numero: `RC-FI-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  await prisma.recepcionCompraDetalle.create({
    data: { recepcionId: recepcion.id, insumoId: insumo.id, cantidad: 10, costoUnitario: 1 },
  });

  const crearInstrumento = (codigo: string, nombre: string) =>
    prisma.instrumentoMedicion.create({ data: { empresaId, codigo, nombre } });
  const instrumentoA = await crearInstrumento(`VIS-${sufijo}`, "Viscosímetro de planta");
  const instrumentoB = await crearInstrumento(`TER-${sufijo}`, "Termómetro de reserva");

  const dia = 24 * 60 * 60 * 1000;
  // Una inspección por medición: `fecha` vive en la inspección, y es el campo
  // por el que ordena la pantalla.
  const inspecciones: string[] = [];
  const crearMedicion = async (
    instrumentoId: string | null,
    diasAtras: number,
    secuencia: number
  ) => {
    // `recepcionCompraDetalleId` es único en InspeccionCompra, así que cada
    // inspección necesita su propio detalle de recepción.
    const suyo = await prisma.recepcionCompraDetalle.create({
      data: { recepcionId: recepcion.id, insumoId: insumo.id, cantidad: 1, costoUnitario: 1 },
    });
    const inspeccion = await prisma.inspeccionCompra.create({
      data: {
        recepcionCompraDetalleId: suyo.id,
        resultado: "APROBADO",
        fecha: new Date(Date.now() - diasAtras * dia),
      },
    });
    inspecciones.push(inspeccion.id);
    await prisma.medicionInspeccionCompra.create({
      data: {
        inspeccionCompraId: inspeccion.id,
        secuencia,
        nombre: "Viscosidad",
        unidadMedida: "cSt",
        valorMedido: 100 + secuencia,
        conforme: true,
        instrumentoId,
      },
    });
  };

  for (let i = 0; i < medicionesA; i += 1) await crearMedicion(instrumentoA.id, i, i + 1);
  // La única del segundo instrumento, más antigua que todas las del primero.
  await crearMedicion(instrumentoB.id, medicionesA + 10, 1);

  return {
    empresaId,
    instrumentoA: instrumentoA.id,
    instrumentoB: instrumentoB.id,
    limpiar: async () => {
      await prisma.medicionInspeccionCompra.deleteMany({
        where: { inspeccionCompraId: { in: inspecciones } },
      });
      await prisma.inspeccionCompra.deleteMany({ where: { id: { in: inspecciones } } });
      await prisma.recepcionCompraDetalle.deleteMany({ where: { recepcionId: recepcion.id } });
      await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
      await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
      await prisma.instrumentoMedicion.deleteMany({ where: { empresaId } });
      await prisma.insumo.delete({ where: { id: insumo.id } }).catch(() => {});
      await prisma.proveedor.delete({ where: { id: proveedor.id } }).catch(() => {});
      await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
    },
  };
}

test("el tope compartido dejaba a un instrumento sin ninguna medición", async () => {
  // El defecto, reproducido contra la base. El tope real era 300; acá se usa 3
  // con cuatro mediciones, que es la misma forma a escala de prueba.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const montaje = await montar(sufijo, 3);
  const TOPE_COMPARTIDO = 3;

  try {
    const ids = [montaje.instrumentoA, montaje.instrumentoB];

    // --- Como consultaba antes: un tope para todos, ordenado por fecha ------
    const compartido = await prisma.medicionInspeccionCompra.findMany({
      where: { instrumentoId: { in: ids }, inspeccion: { fecha: { not: null } } },
      select: { instrumentoId: true },
      orderBy: { inspeccion: { fecha: "desc" } },
      take: TOPE_COMPARTIDO,
    });
    const delB = compartido.filter((m) => m.instrumentoId === montaje.instrumentoB);
    assert.equal(
      delB.length,
      0,
      "la reproducción del defecto no falló: el tope compartido ya no deja fuera al instrumento poco usado"
    );

    // --- Como consulta ahora: de a un instrumento --------------------------
    const suyas = await prisma.medicionInspeccionCompra.findMany({
      where: { instrumentoId: montaje.instrumentoB, inspeccion: { fecha: { not: null } } },
      select: { instrumentoId: true },
      orderBy: { inspeccion: { fecha: "desc" } },
      take: TOPE_COMPARTIDO,
    });
    assert.equal(suyas.length, 1, "el instrumento poco usado sigue sin ver su medición");
  } finally {
    await montaje.limpiar();
  }
});

test("el conteo agrupado dice la verdad de cada instrumento", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const montaje = await montar(sufijo, 5);

  try {
    const ids = [montaje.instrumentoA, montaje.instrumentoB];
    const conteo = await prisma.medicionInspeccionCompra.groupBy({
      by: ["instrumentoId"],
      where: {
        instrumentoId: { in: ids },
        inspeccion: {
          fecha: { not: null },
          recepcionDetalle: { recepcion: { ordenCompra: { empresaId: montaje.empresaId } } },
        },
      },
      _count: { _all: true },
    });
    const porId = new Map(conteo.map((g) => [g.instrumentoId, g._count._all]));
    assert.equal(porId.get(montaje.instrumentoA), 5);
    // El que el tope compartido escondía: uno, no cero.
    assert.equal(porId.get(montaje.instrumentoB), 1);
  } finally {
    await montaje.limpiar();
  }
});

test("una inspección pendiente no se cuenta: no se ensayó nada", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const montaje = await montar(sufijo, 1);

  try {
    // Se deja pendiente la inspección del instrumento poco usado.
    await prisma.inspeccionCompra.updateMany({
      where: { mediciones: { some: { instrumentoId: montaje.instrumentoB } } },
      data: { fecha: null, resultado: "PENDIENTE" },
    });

    const conteo = await prisma.medicionInspeccionCompra.groupBy({
      by: ["instrumentoId"],
      where: {
        instrumentoId: { in: [montaje.instrumentoA, montaje.instrumentoB] },
        inspeccion: { fecha: { not: null } },
      },
      _count: { _all: true },
    });
    const porId = new Map(conteo.map((g) => [g.instrumentoId, g._count._all]));
    assert.equal(porId.get(montaje.instrumentoA), 1);
    assert.equal(porId.get(montaje.instrumentoB), undefined, "contó una inspección sin ensayar");
  } finally {
    await montaje.limpiar();
  }
});

test("el conteo no cruza empresas", async () => {
  // Dos compañías con un instrumento cada una y mediciones propias: el conteo
  // de una no puede incluir las de la otra.
  const a = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const b = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "z";
  const una = await montar(a, 2);
  const otra = await montar(b, 4);

  try {
    const conteo = await prisma.medicionInspeccionCompra.groupBy({
      by: ["instrumentoId"],
      where: {
        inspeccion: {
          fecha: { not: null },
          recepcionDetalle: { recepcion: { ordenCompra: { empresaId: una.empresaId } } },
        },
      },
      _count: { _all: true },
    });
    const ids = conteo.map((g) => g.instrumentoId);
    assert.ok(ids.includes(una.instrumentoA), "no vio sus propias mediciones");
    assert.ok(
      !ids.includes(otra.instrumentoA),
      "el conteo de una compañía incluyó instrumentos de otra"
    );
  } finally {
    await una.limpiar();
    await otra.limpiar();
  }
});
