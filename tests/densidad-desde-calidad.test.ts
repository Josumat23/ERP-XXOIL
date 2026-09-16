import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { densidadMedida, normalizarCaracteristicasPlan } from "@/lib/planesCalidad";

// ---------------------------------------------------------------------------
// La densidad que mide el laboratorio es la que gobierna el lote.
//
// Antes de esto el dato existía dos veces. El plan de inspección hace medir la
// densidad y el valor quedaba en `ResultadoCaracteristicaCalidad`, donde nadie
// lo leía. La densidad que de verdad convierte kg en litros en cada comprobante
// —`LoteGranel.densidadKgL`— se tecleaba a mano al **finalizar** el lote, que
// ocurre ANTES de que el laboratorio mida: el lote pasa a PENDIENTE_CALIDAD y
// recién ahí se ensaya.
//
// Así que el número provisional de producción gobernaba la facturación y la
// medición real del laboratorio no se usaba para nada. Ningún error aparecía:
// las dos cifras son plausibles y nada las compara.
//
// Es la clase de desconexión que los ERP genéricos dejan abierta porque su
// módulo de calidad guarda resultados como documentación, no como datos que
// alimenten al material. SAP mide en QM y el factor de conversión vive en MARM
// sin que uno hable con el otro.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const plan = (...filas: Record<string, unknown>[]) => JSON.stringify(filas);
const fila = (extra: Record<string, unknown> = {}) => ({
  nombre: "Densidad a 15 °C",
  unidadMedida: "kg/L",
  limiteInferior: 0.86,
  limiteSuperior: 0.9,
  metodoEnsayo: "ASTM D4052",
  esDensidad: true,
  ...extra,
});

// --- La marca en el plan ----------------------------------------------------

test("una característica puede declararse como la densidad del lote", () => {
  const [caracteristica] = normalizarCaracteristicasPlan(plan(fila()));
  assert.equal(caracteristica.esDensidad, true);
  assert.equal(caracteristica.obligatoria, true);
});

test("sin la marca, el plan se comporta como siempre", () => {
  // Es aditivo: los planes que ya existen no cambian de conducta.
  const [caracteristica] = normalizarCaracteristicasPlan(
    plan({ nombre: "Viscosidad", unidadMedida: "cSt", limiteInferior: 95, limiteSuperior: 110 })
  );
  assert.equal(caracteristica.esDensidad, false);
});

test("dos densidades en un plan se rechazan", () => {
  // Elegir la primera sería inventar un criterio que nadie declaró.
  assert.throws(
    () => normalizarCaracteristicasPlan(plan(fila(), fila({ nombre: "Densidad a 20 °C" }))),
    /Solo una característica puede alimentar la densidad/
  );
});

test("la densidad del lote no puede ser una medición opcional", () => {
  // «A veces» deja lotes sin densidad, y esos no se pueden convertir a litros.
  assert.throws(
    () => normalizarCaracteristicasPlan(plan(fila({ obligatoria: false }))),
    /no puede ser opcional/
  );
});

test("la unidad tiene que ser de densidad, y g/cm³ es la misma cifra", () => {
  // 1 g/cm³ = 1 g/mL = 1 kg/L exactamente: aceptarlas no convierte nada.
  for (const unidadMedida of ["kg/L", "kg/l", "KG/L", "g/cm3", "g/cm³", "g/mL", " kg / L "]) {
    assert.equal(
      normalizarCaracteristicasPlan(plan(fila({ unidadMedida })))[0].esDensidad,
      true,
      `${unidadMedida} debería aceptarse`
    );
  }
  // La densidad relativa es adimensional —un cociente contra el agua— y
  // tomarla por densidad metería ~0,1 % de error en cada litro declarado.
  for (const unidadMedida of ["", "—", "adimensional", "cSt", "°API"]) {
    assert.throws(
      () => normalizarCaracteristicasPlan(plan(fila({ unidadMedida }))),
      /unidad debe ser kg\/L|Complete nombre y unidad/,
      `${unidadMedida} no debería aceptarse`
    );
  }
});

// --- De la lectura al lote --------------------------------------------------

test("la lectura de la característica marcada es la densidad del lote", () => {
  const caracteristicas = [
    { id: "c1", esDensidad: false },
    { id: "c2", esDensidad: true },
  ];
  const lecturas = [
    { caracteristicaId: "c1", valorMedido: 102.4 },
    { caracteristicaId: "c2", valorMedido: 0.8814 },
  ];
  assert.equal(densidadMedida(caracteristicas, lecturas), 0.8814);
});

test("un plan que no mide densidad devuelve null, no cero", () => {
  // Cero sería una densidad, y una densidad cero rompe toda conversión.
  // `null` significa «este plan no la mide» y deja regir la del producto.
  assert.equal(densidadMedida([{ id: "c1", esDensidad: false }], [{ caracteristicaId: "c1", valorMedido: 5 }]), null);
  // Marcada pero sin lectura —no debería pasar, porque es obligatoria— también
  // es null: mejor no escribir nada que escribir un valor inventado.
  assert.equal(densidadMedida([{ id: "c1", esDensidad: true }], []), null);
});

// --- Guardias estructurales -------------------------------------------------

test("el registro de calidad escribe la densidad en el lote", async () => {
  // Una marca que nadie lee no conecta nada: el punto entero del ciclo es que
  // la medición llegue a `LoteGranel.densidadKgL`.
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /densidadMedida\(/, "la acción no usa la función compartida");
  assert.match(
    acciones,
    /densidadKgL: densidadDelEnsayo/,
    "la densidad medida no se escribe en el lote"
  );
});

test("finalizar el lote rechaza la densidad a mano cuando el plan la mide", async () => {
  // Los dos caminos abiertos a la vez devolverían el problema entero: el
  // tecleado ocurre antes, así que gobernaría hasta que alguien ensaye.
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /esDensidad: true/, "no consulta si el plan mide la densidad");
  assert.match(acciones, /no se ingresa al finalizar el lote/, "no rechaza el valor manual");

  // Y la pantalla tampoco lo ofrece: un campo que el servidor rechaza pero el
  // formulario muestra es una trampa para quien lo llena.
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/[id]/FinalizarLoteFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /\{!planMideDensidad && \(/, "el campo no es condicional");
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/[id]/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /planMideDensidad=\{planMideDensidad\}/, "la página no pasa el dato");
});

test("el plan se puede marcar desde la pantalla", async () => {
  // Un campo sin captura es un campo muerto.
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/planes/PlanFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /esDensidad: false/, "la fila nueva no trae el campo");
  assert.match(formulario, /cambiar\(i, "esDensidad"/, "no hay casilla para marcarla");
});

// --- Contra la base ---------------------------------------------------------

test("la marca viaja a la base y la lectura del ensayo se resuelve con filas reales", async () => {
  // Las guardias de arriba leen código. Esta comprueba que la columna existe,
  // que los planes que ya estaban quedaron en false —la migración es aditiva—
  // y que el buscador resuelve contra filas persistidas y no contra literales.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `DEN-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });

  try {
    const plan = await prisma.planInspeccionCalidad.create({
      data: {
        empresaId,
        productoId: producto.id,
        version: 1,
        nombre: `Liberación ${sufijo}`,
        usuarioId: "u",
        usuarioNombre: "u",
        caracteristicas: {
          create: [
            { secuencia: 1, nombre: "Viscosidad", unidadMedida: "cSt", limiteInferior: 95, limiteSuperior: 110 },
            { secuencia: 2, nombre: "Densidad a 15 °C", unidadMedida: "kg/L", limiteInferior: 0.86, limiteSuperior: 0.9, esDensidad: true },
          ],
        },
      },
      include: { caracteristicas: { orderBy: { secuencia: "asc" } } },
    });

    const [viscosidad, densidad] = plan.caracteristicas;
    // La que no se marcó quedó en false sin que nadie lo pidiera: eso es lo
    // que hace que los planes anteriores a la migración sigan igual.
    assert.equal(viscosidad.esDensidad, false);
    assert.equal(densidad.esDensidad, true);

    const lecturas = [
      { caracteristicaId: viscosidad.id, valorMedido: 102.4 },
      { caracteristicaId: densidad.id, valorMedido: 0.8814 },
    ];
    assert.equal(densidadMedida(plan.caracteristicas, lecturas), 0.8814);

    // Y solo una por plan: la pantalla lo impide y el normalizador lo rechaza,
    // pero conviene dejar dicho qué pasa si alguien marca dos en base.
    assert.equal(plan.caracteristicas.filter((c) => c.esDensidad).length, 1);
  } finally {
    await prisma.caracteristicaPlanCalidad.deleteMany({ where: { plan: { productoId: producto.id } } });
    await prisma.planInspeccionCalidad.deleteMany({ where: { productoId: producto.id } });
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
  }
});
