import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  MENSAJE_RESPALDO,
  medicionesSinRespaldo,
  respaldoDeMedicion,
} from "@/lib/calibracion";
import { normalizarLecturasCalidad } from "@/lib/planesCalidad";

// ---------------------------------------------------------------------------
// Con qué instrumento se midió cada cosa.
//
// Era la mitad que faltaba del laboratorio. El sistema sabía que un instrumento
// estaba vencido y sabía qué densidad se había medido, pero no los unía: no
// podía contestar «¿qué lotes se liberaron con este instrumento?», que es la
// pregunta del día que una calibración vuelve fuera de tolerancia.
//
// El respaldo NO se congela en el resultado del ensayo: se deriva del historial
// de calibraciones. Guardarlo fijaría una respuesta que mejora sola a medida
// que se carga el historial —justo lo que va a pasar mientras el laboratorio se
// pone en marcha— y que además podría discrepar del ledger sin que nada lo
// avise.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const dia = 24 * 60 * 60 * 1000;
const F = (diasDesdeCero: number) => new Date(2026, 0, 1 + diasDesdeCero);
const cal = (
  desde: number,
  hasta: number,
  resultado: "CONFORME" | "CONFORME_CON_AJUSTE" | "NO_CONFORME" = "CONFORME"
) => ({ fecha: F(desde), vigenteHasta: F(hasta), resultado }) as const;

// --- Qué respaldo tenía una medición ---------------------------------------

test("una medición dentro de una calibración conforme está respaldada", () => {
  assert.equal(respaldoDeMedicion([cal(0, 365)], F(100)), "CALIBRADO");
});

test("fuera de la vigencia no hay respaldo, antes o después", () => {
  assert.equal(respaldoDeMedicion([cal(100, 200)], F(50)), "SIN_RESPALDO");
  assert.equal(respaldoDeMedicion([cal(100, 200)], F(250)), "SIN_RESPALDO");
  // En los bordes sí: la vigencia incluye sus dos extremos.
  assert.equal(respaldoDeMedicion([cal(100, 200)], F(100)), "CALIBRADO");
  assert.equal(respaldoDeMedicion([cal(100, 200)], F(200)), "CALIBRADO");
});

test("sin calibraciones cargadas, nada está respaldado", () => {
  // Es la verdad, no una acusación: todavía no se sabe.
  assert.equal(respaldoDeMedicion([], F(100)), "SIN_RESPALDO");
});

test("si la verificación siguiente salió fuera de tolerancia, lo medido queda en duda", () => {
  // LA regla del ciclo. El instrumento se encontró mal en el chequeo siguiente,
  // así que todo lo medido desde la última calibración buena queda en cuestión.
  const historial = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  assert.equal(respaldoDeMedicion(historial, F(100)), "EN_DUDA");
});

test("lo medido DESPUÉS de la verificación fallida no tiene respaldo, no queda en duda", () => {
  // Distinto caso: ahí ya se sabía que el instrumento estaba mal.
  const historial = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  assert.equal(respaldoDeMedicion(historial, F(300)), "SIN_RESPALDO");
});

test("una calibración posterior conforme deja de poner en duda lo anterior", () => {
  const historial = [cal(0, 365), cal(200, 560)];
  assert.equal(respaldoDeMedicion(historial, F(100)), "CALIBRADO");
});

test("conforme con ajuste respalda igual", () => {
  assert.equal(
    respaldoDeMedicion([cal(0, 365, "CONFORME_CON_AJUSTE")], F(100)),
    "CALIBRADO"
  );
});

test("una calibración NO_CONFORME no respalda nada por sí misma", () => {
  // Aunque sus fechas cubran la medición: el instrumento estaba fuera de
  // tolerancia cuando se lo verificó.
  assert.equal(respaldoDeMedicion([cal(0, 365, "NO_CONFORME")], F(100)), "SIN_RESPALDO");
});

test("cada estado se explica, no se muestra la sigla", () => {
  assert.match(MENSAJE_RESPALDO.EN_DUDA, /fuera de tolerancia/);
  assert.match(MENSAJE_RESPALDO.SIN_RESPALDO, /Sin calibración vigente/);
});

test("se puede listar lo que no se puede dar por respaldado", () => {
  const historial = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  const mediciones = [
    { id: "a", fecha: F(100), calibraciones: historial },
    { id: "b", fecha: F(300), calibraciones: historial },
    { id: "c", fecha: F(100), calibraciones: [cal(0, 365)] },
  ];
  assert.deepEqual(medicionesSinRespaldo(mediciones).map((m) => m.id), ["a", "b"]);
});

// --- La lectura lleva su instrumento ---------------------------------------

test("la lectura del ensayo transporta con qué instrumento se midió", () => {
  const [lectura] = normalizarLecturasCalidad(
    '[{"caracteristicaId":"c1","valorMedido":"0.8814","instrumentoId":"dm-01"}]'
  );
  assert.equal(lectura.instrumentoId, "dm-01");
});

test("sin instrumento declarado queda en null, no en cadena vacía", () => {
  // `null` es «no se sabe»; una cadena vacía se guardaría como un id inválido.
  assert.equal(
    normalizarLecturasCalidad('[{"caracteristicaId":"c1","valorMedido":"1"}]')[0].instrumentoId,
    null
  );
  assert.equal(
    normalizarLecturasCalidad('[{"caracteristicaId":"c1","valorMedido":"1","instrumentoId":"  "}]')[0]
      .instrumentoId,
    null
  );
});

// --- Guardias estructurales -------------------------------------------------

test("el estado de calibración no se congela en el resultado del ensayo", async () => {
  // Si se guardara, la respuesta quedaría fija el día del ensayo y no mejoraría
  // cuando se cargue una calibración que faltaba — que es lo que va a pasar
  // mientras el laboratorio se pone en marcha.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model ResultadoCaracteristicaCalidad {"),
    esquema.indexOf("\n}", esquema.indexOf("model ResultadoCaracteristicaCalidad {"))
  );
  assert.ok(modelo.length > 200, "el corte quedó vacío");
  assert.match(modelo, /instrumentoId\s+String\?/, "el resultado no registra el instrumento");
  assert.doesNotMatch(modelo, /estadoCalibracion|respaldo/i, "el respaldo se está congelando");
});

test("el ensayo registra el instrumento y lo valida contra la compañía", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /instrumentoPorId/, "no lee el instrumento de cada lectura");
  // Si el ensayo no lo dice, rige el del plan.
  assert.match(acciones, /instrumentoPorId\.get\(c\.id\) \?\? c\.instrumentoId/);
  // Los ids llegan del navegador: se comprueban.
  assert.match(acciones, /instrumentoMedicion\.count\(\{[\s\S]{0,120}empresaId/);
});

test("el plan valida los instrumentos que declara", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/planes/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /instrumentoMedicion\.count\(\{[\s\S]{0,120}empresaId/);
});

test("la ficha del instrumento contesta qué lotes midió", async () => {
  // Es el pago del ciclo: sin esta pantalla, el campo sería un dato que nadie
  // consulta.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /Lotes medidos con este instrumento/);
  assert.match(pagina, /respaldoDeMedicion\(/, "no calcula el respaldo de cada medición");
  assert.match(pagina, /mediciones:/, "no trae las mediciones");
});

test("se puede elegir el instrumento en el plan y en el ensayo", async () => {
  const plan = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/planes/PlanFormulario.tsx"),
    "utf8"
  );
  assert.match(plan, /cambiar\(i, "instrumentoId"/, "el plan no deja elegir instrumento");
  const ensayo = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/CalidadFormulario.tsx"),
    "utf8"
  );
  assert.match(ensayo, /setInstrumentos/, "el ensayo no deja cambiar el instrumento");
  assert.match(ensayo, /instrumentoId: instrumentos\[c\.id\]/, "no viaja en las lecturas");
  // Sin instrumentos cargados el selector no aparece, en vez de ofrecer vacío.
  assert.match(ensayo, /instrumentosDisponibles\.length > 0 &&/);
});

// --- Contra la base ---------------------------------------------------------

test("la cadena completa: el ensayo queda atado al instrumento que lo midió", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `TRZ-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `DM-${sufijo}`, nombre: "Densímetro" },
  });
  const formula = await prisma.formula.create({
    data: {
      empresaId,
      productoId: producto.id,
      version: 1,
      rendimientoKg: 100,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const lote = await prisma.loteGranel.create({
    data: {
      empresaId,
      codigo: `LG-TRZ-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      kgProducidos: 98,
      estado: "APROBADO",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  try {
    // El ensayo se hace HOY; la calibración venció ayer.
    const control = await prisma.controlCalidad.create({
      data: {
        loteGranelId: lote.id,
        resultado: "APROBADO",
        usuarioId: "u",
        usuarioNombre: "u",
        resultadosCaracteristica: {
          create: [
            {
              secuencia: 1,
              nombre: "Densidad a 15 °C",
              unidadMedida: "kg/L",
              valorMedido: 0.8814,
              conforme: true,
              instrumentoId: instrumento.id,
            },
          ],
        },
      },
      include: { resultadosCaracteristica: true },
    });
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(Date.now() - 400 * dia),
        vigenteHasta: new Date(Date.now() - dia),
        resultado: "CONFORME",
        numeroCertificado: "CAL-VIEJA",
        entidad: "Lab",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    // Desde el instrumento se llega al lote: es la pregunta del ciclo.
    const leido = await prisma.instrumentoMedicion.findUniqueOrThrow({
      where: { id: instrumento.id },
      include: {
        calibraciones: true,
        mediciones: {
          include: { controlCalidad: { select: { fecha: true, loteGranel: { select: { codigo: true } } } } },
        },
      },
    });
    assert.equal(leido.mediciones.length, 1);
    assert.equal(leido.mediciones[0].controlCalidad.loteGranel.codigo, lote.codigo);
    // Y el respaldo se deriva: la calibración venció antes del ensayo.
    assert.equal(
      respaldoDeMedicion(leido.calibraciones, leido.mediciones[0].controlCalidad.fecha),
      "SIN_RESPALDO"
    );

    // Se carga la calibración que faltaba y la respuesta mejora sola, sin tocar
    // el ensayo. Eso es lo que se perdería si el estado estuviera congelado.
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(Date.now() - 30 * dia),
        vigenteHasta: new Date(Date.now() + 300 * dia),
        resultado: "CONFORME",
        numeroCertificado: "CAL-QUE-FALTABA",
        entidad: "Lab",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const despues = await prisma.instrumentoMedicion.findUniqueOrThrow({
      where: { id: instrumento.id },
      include: { calibraciones: true },
    });
    assert.equal(
      respaldoDeMedicion(despues.calibraciones, control.fecha),
      "CALIBRADO",
      "cargar la calibración que faltaba debería respaldar el ensayo"
    );

    // Borrar el instrumento no borra el ensayo: la medición es un hecho.
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } });
    const resultado = await prisma.resultadoCaracteristicaCalidad.findUniqueOrThrow({
      where: { id: control.resultadosCaracteristica[0].id },
    });
    assert.equal(resultado.instrumentoId, null, "debería quedar en null, no desaparecer");
    assert.equal(resultado.valorMedido.toString(), "0.8814");
  } finally {
    await prisma.controlCalidad.deleteMany({ where: { loteGranelId: lote.id } });
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});

test("el orden del historial no cambia la respuesta", () => {
  // La primera versión tomaba «la primera calibración que encajara», así que
  // dependía del orden en que la base devolviera las filas.
  const historial = [cal(0, 365), cal(200, 560, "NO_CONFORME"), cal(400, 760)];
  const alReves = [...historial].reverse();
  for (const dias of [100, 300, 500]) {
    assert.equal(
      respaldoDeMedicion(historial, F(dias)),
      respaldoDeMedicion(alReves, F(dias)),
      `difiere en el día ${dias}`
    );
  }
});

test("una calibración conforme posterior a la fallida sí respalda", () => {
  // El instrumento se arregló: lo medido después de esa nueva calibración está
  // respaldado, aunque en el medio haya habido una verificación fallida.
  const historial = [cal(0, 365), cal(200, 560, "NO_CONFORME"), cal(400, 760)];
  assert.equal(respaldoDeMedicion(historial, F(500)), "CALIBRADO");
});
