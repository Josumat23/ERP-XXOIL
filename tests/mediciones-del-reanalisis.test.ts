import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { resultadosDelEnsayo, type CaracteristicaDelPlan } from "@/lib/planesCalidad";
import {
  CONSECUENCIA_ENSAYO,
  MENSAJE_TIPO_ENSAYO,
  lotesPorReensayar,
  type MedicionParaRevisar,
} from "@/lib/reensayos";
import { revisarReensayos } from "@/lib/reensayosConsulta";

// ---------------------------------------------------------------------------
// Qué se midió en el re-análisis.
//
// El re-análisis ya registraba que se ensayó —contra qué plan, con qué versión,
// quién y cuándo— pero no QUÉ DIO. Extender una vigencia 333 días con eso es
// una afirmación sin evidencia: el mismo defecto que este proyecto corrigió en
// homologaciones, equivalencias y calibraciones.
//
// Las lecturas van a la MISMA tabla que las del lote granel. Son la misma cosa
// medida en dos momentos, y partirlas obligaría a unir dos tablas cada vez que
// se pregunta «¿qué midió este instrumento?» — con una consulta que se olvide
// de una devolviendo una respuesta incompleta sin avisar.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const dia = 24 * 60 * 60 * 1000;
const F = (diasDesdeCero: number) => new Date(2026, 0, 1 + diasDesdeCero);
const caracteristica = (parcial: Partial<CaracteristicaDelPlan> = {}): CaracteristicaDelPlan => ({
  id: "c1",
  secuencia: 1,
  nombre: "Viscosidad a 100 °C",
  unidadMedida: "cSt",
  limiteInferior: 13.5,
  limiteSuperior: 16.3,
  metodoEnsayo: "ASTM D445",
  obligatoria: true,
  instrumentoId: null,
  ...parcial,
});

// --- Construir los resultados del ensayo ------------------------------------

test("una lectura dentro de especificación queda conforme", () => {
  const [r] = resultadosDelEnsayo(
    [caracteristica()],
    [{ caracteristicaId: "c1", valorMedido: 14.8, instrumentoId: null }]
  );
  assert.equal(r.conforme, true);
  assert.equal(r.valorMedido, 14.8);
});

test("una lectura fuera de especificación queda no conforme", () => {
  const [r] = resultadosDelEnsayo(
    [caracteristica()],
    [{ caracteristicaId: "c1", valorMedido: 12, instrumentoId: null }]
  );
  assert.equal(r.conforme, false);
});

test("el resultado copia la especificación con la que se ensayó", () => {
  // El plan puede cambiar mañana. Si el resultado no llevara sus propios
  // límites, el ensayo se leería contra una especificación que no es la que
  // rigió.
  const [r] = resultadosDelEnsayo(
    [caracteristica({ limiteInferior: 13.5, limiteSuperior: 16.3, metodoEnsayo: "ASTM D445" })],
    [{ caracteristicaId: "c1", valorMedido: 14.8, instrumentoId: null }]
  );
  assert.equal(r.limiteInferior, 13.5);
  assert.equal(r.limiteSuperior, 16.3);
  assert.equal(r.metodoEnsayo, "ASTM D445");
});

test("si el ensayo no dice con qué se midió, rige el instrumento del plan", () => {
  const [r] = resultadosDelEnsayo(
    [caracteristica({ instrumentoId: "del-plan" })],
    [{ caracteristicaId: "c1", valorMedido: 14, instrumentoId: null }]
  );
  assert.equal(r.instrumentoId, "del-plan");
});

test("el instrumento que declara el ensayo le gana al del plan", () => {
  // Es el hecho contra la expectativa: lo que importa es con cuál se midió.
  const [r] = resultadosDelEnsayo(
    [caracteristica({ instrumentoId: "del-plan" })],
    [{ caracteristicaId: "c1", valorMedido: 14, instrumentoId: "el-que-use" }]
  );
  assert.equal(r.instrumentoId, "el-que-use");
});

test("sin instrumento por ningún lado queda en null, no inventado", () => {
  const [r] = resultadosDelEnsayo(
    [caracteristica()],
    [{ caracteristicaId: "c1", valorMedido: 14, instrumentoId: null }]
  );
  assert.equal(r.instrumentoId, null);
});

test("falta una medición obligatoria y el ensayo no se arma", () => {
  assert.throws(
    () => resultadosDelEnsayo([caracteristica({ obligatoria: true })], []),
    /no corresponden exactamente al plan/
  );
});

test("una característica opcional sin medir simplemente no aparece", () => {
  const resultados = resultadosDelEnsayo(
    [caracteristica({ obligatoria: false }), caracteristica({ id: "c2", secuencia: 2 })],
    [{ caracteristicaId: "c2", valorMedido: 14, instrumentoId: null }]
  );
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].secuencia, 2);
});

test("una lectura que no está en el plan se rechaza", () => {
  // Llega del navegador: es un campo que la pantalla no dibuja y alguien podría
  // agregar a mano.
  assert.throws(
    () =>
      resultadosDelEnsayo(
        [caracteristica()],
        [
          { caracteristicaId: "c1", valorMedido: 14, instrumentoId: null },
          { caracteristicaId: "inventada", valorMedido: 1, instrumentoId: null },
        ]
      ),
    /no corresponden exactamente al plan/
  );
});

test("la misma característica medida dos veces se rechaza", () => {
  assert.throws(
    () =>
      resultadosDelEnsayo(
        [caracteristica()],
        [
          { caracteristicaId: "c1", valorMedido: 14, instrumentoId: null },
          { caracteristicaId: "c1", valorMedido: 15, instrumentoId: null },
        ]
      ),
    /no corresponden exactamente al plan/
  );
});

// --- Los dos ensayos en la lista de reensayo --------------------------------

const medicion = (parcial: Partial<MedicionParaRevisar> = {}): MedicionParaRevisar => ({
  ensayo: "LIBERACION",
  itemId: "L1",
  itemCodigo: "LG-0001",
  loteGranelId: "L1",
  productoNombre: "Grasa EP-2",
  disponibleEnAlmacen: true,
  unidadesDespachadas: 0,
  clientesAfectados: 0,
  fechaEnsayo: F(100),
  caracteristica: "Densidad a 15 °C",
  instrumentoId: "I1",
  instrumentoCodigo: "DM-01",
  calibraciones: [],
  ...parcial,
});

test("cada clase de ensayo se nombra y dice qué queda en cuestión", () => {
  assert.equal(MENSAJE_TIPO_ENSAYO.LIBERACION, "Liberación del lote");
  assert.equal(MENSAJE_TIPO_ENSAYO.REANALISIS, "Re-análisis de vigencia");
  assert.match(CONSECUENCIA_ENSAYO.LIBERACION, /cumpliera al liberarlo/);
  assert.match(CONSECUENCIA_ENSAYO.REANALISIS, /vigencia/);
});

test("un re-análisis sin respaldo aparece en la lista de reensayo", () => {
  const items = lotesPorReensayar([
    medicion({ ensayo: "REANALISIS", itemId: "E1", itemCodigo: "EV-00001", loteGranelId: "L1" }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].ensayo, "REANALISIS");
  assert.equal(items[0].itemCodigo, "EV-00001");
  // El recall sigue siendo por lote granel aunque lo medido sea un envasado.
  assert.equal(items[0].loteGranelId, "L1");
});

test("la liberación del lote y el re-análisis de su envasado son dos trabajos", () => {
  // Agruparlos escondería uno de los dos: reensayar el granel no arregla la
  // vigencia que se le dio al envase, ni al revés.
  const items = lotesPorReensayar([
    medicion({ ensayo: "LIBERACION", itemId: "L1", itemCodigo: "LG-0001" }),
    medicion({ ensayo: "REANALISIS", itemId: "E1", itemCodigo: "EV-00001", loteGranelId: "L1" }),
  ]);
  assert.equal(items.length, 2);
});

test("dos mediciones del mismo re-análisis siguen siendo una fila", () => {
  const items = lotesPorReensayar([
    medicion({ ensayo: "REANALISIS", itemId: "E1", itemCodigo: "EV-1", caracteristica: "Densidad" }),
    medicion({ ensayo: "REANALISIS", itemId: "E1", itemCodigo: "EV-1", caracteristica: "Viscosidad" }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].mediciones.length, 2);
});

test("un envasado sin saldo y sin despacho no urge", () => {
  const items = lotesPorReensayar([
    medicion({ ensayo: "REANALISIS", itemId: "E1", itemCodigo: "EV-1", disponibleEnAlmacen: false }),
  ]);
  assert.equal(items[0].destino, "SIN_SALIDA");
});

// --- Que esté conectado -----------------------------------------------------

test("la consulta recorre los dos ensayos, no solo la liberación", async () => {
  // Si se olvidara del re-análisis, la pantalla diría «no hay nada que
  // reensayar» habiendo trabajo — peor que no tenerla.
  const consulta = await readFile(resolve(RAIZ, "src/lib/reensayosConsulta.ts"), "utf8");
  assert.match(consulta, /reanalisis: \{/, "la consulta no mira los re-análisis");
  assert.match(consulta, /REANALISIS/, "no clasifica el ensayo");
});

test("el formulario de re-análisis captura mediciones e instrumento", async () => {
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/envasados/[id]/ReanalisisFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /name="lecturas"/, "no envía las mediciones");
  assert.match(formulario, /instrumentosDisponibles/, "no deja declarar el instrumento");
});

test("la acción no confía en el resultado que manda el formulario", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/envasados/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /resultadosDelEnsayo\(/, "no arma los resultados con la librería común");
  assert.match(
    acciones,
    /resultado = resultados\.every\(\(r\) => r\.conforme\)/,
    "el resultado no sale de las mediciones"
  );
  assert.match(acciones, /instrumentoMedicion\.count\([\s\S]{0,120}empresaId/);
});

test("la base garantiza que una lectura tenga exactamente un ensayo", async () => {
  // En la base y no solo en el código: una lectura huérfana no la ve nadie
  // —todas las pantallas entran por su padre— y sería un dato que existe y no
  // se puede encontrar.
  const migracion = await readFile(
    resolve(RAIZ, "prisma/migrations/20260917210000_mediciones_del_reanalisis/migration.sql"),
    "utf8"
  );
  assert.match(migracion, /CHECK \(num_nonnulls\("controlCalidadId", "reanalisisId"\) = 1\)/);
});

// --- Contra la base ---------------------------------------------------------

test("el re-análisis guarda lo que midió y la base rechaza una lectura huérfana", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `RAN-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });
  const presentacion = await prisma.presentacion.create({
    data: {
      empresaId,
      productoId: producto.id,
      sku: `SKU-${sufijo}`,
      nombre: "Balde 20 kg",
      contenidoKg: 20,
      precio: 100,
    },
  });
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `VIS-${sufijo}`, nombre: "Viscosímetro" },
  });
  const formula = await prisma.formula.create({
    data: { empresaId, productoId: producto.id, version: 1, rendimientoKg: 100, usuarioId: "u", usuarioNombre: "u" },
  });
  const lote = await prisma.loteGranel.create({
    data: {
      empresaId,
      codigo: `LG-RAN-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      kgProducidos: 100,
      estado: "APROBADO",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const envasado = await prisma.envasado.create({
    data: {
      empresaId,
      codigo: `EV-RAN-${sufijo}`,
      loteGranelId: lote.id,
      presentacionId: presentacion.id,
      unidades: 10,
      unidadesDisponibles: 10,
      kgConsumidos: 200,
      fechaVencimiento: new Date(Date.now() + 10 * dia),
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  try {
    const reanalisis = await prisma.reanalisisEnvasado.create({
      data: {
        empresaId,
        envasadoId: envasado.id,
        vencimientoAnterior: new Date(Date.now() + 10 * dia),
        vencimientoNuevo: new Date(Date.now() + 300 * dia),
        resultado: "APROBADO",
        usuarioId: "u",
        usuarioNombre: "u",
        resultadosCaracteristica: {
          create: [
            {
              secuencia: 1,
              nombre: "Viscosidad a 100 °C",
              unidadMedida: "cSt",
              limiteInferior: 13.5,
              limiteSuperior: 16.3,
              valorMedido: 14.8,
              conforme: true,
              instrumentoId: instrumento.id,
            },
          ],
        },
      },
      include: { resultadosCaracteristica: true },
    });
    assert.equal(reanalisis.resultadosCaracteristica.length, 1);
    assert.equal(reanalisis.resultadosCaracteristica[0].controlCalidadId, null);

    // Una lectura sin ningún ensayo padre no entra: lo impide la base.
    await assert.rejects(
      prisma.resultadoCaracteristicaCalidad.create({
        data: {
          secuencia: 9,
          nombre: "Huérfana",
          unidadMedida: "cSt",
          valorMedido: 1,
          conforme: true,
        },
      }),
      /un_solo_ensayo|constraint|check/i
    );

    // Y el instrumento sin calibrar arrastra al envasado a la lista de
    // reensayo: la vigencia que se le dio no se sostiene.
    const revision = await revisarReensayos(empresaId);
    const enLista = revision.items.find((i) => i.itemId === envasado.id);
    assert.ok(enLista, "el re-análisis medido con un instrumento sin calibrar no apareció");
    assert.equal(enLista.ensayo, "REANALISIS");
    assert.equal(enLista.itemCodigo, envasado.codigo);
    assert.equal(enLista.loteGranelId, lote.id);
    assert.equal(enLista.destino, "EN_ALMACEN", "tiene saldo y no se despachó");

    // Se carga la calibración que faltaba y sale solo de la lista, sin tocar
    // el re-análisis.
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(Date.now() - 30 * dia),
        vigenteHasta: new Date(Date.now() + 300 * dia),
        resultado: "CONFORME",
        numeroCertificado: `CAL-${sufijo}`,
        entidad: "Lab externo",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const despues = await revisarReensayos(empresaId);
    assert.equal(
      despues.items.find((i) => i.itemId === envasado.id),
      undefined,
      "cargar la calibración que faltaba no sacó al envasado de la lista"
    );
  } finally {
    await prisma.resultadoCaracteristicaCalidad.deleteMany({
      where: { reanalisis: { envasadoId: envasado.id } },
    });
    await prisma.reanalisisEnvasado.deleteMany({ where: { envasadoId: envasado.id } });
    await prisma.envasado.delete({ where: { id: envasado.id } }).catch(() => {});
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
    await prisma.presentacion.delete({ where: { id: presentacion.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
  }
});

test("las lecturas del lote granel siguen exigiendo su control", async () => {
  // La columna pasó a admitir NULL para que quepa el re-análisis. Eso NO puede
  // convertirse en «una lectura de liberación sin control»: el CHECK exige
  // exactamente un padre, así que poner los dos también se rechaza.
  await assert.rejects(
    prisma.resultadoCaracteristicaCalidad.create({
      data: {
        controlCalidadId: "no-existe",
        reanalisisId: "tampoco",
        secuencia: 1,
        nombre: "Dos padres",
        unidadMedida: "cSt",
        valorMedido: 1,
        conforme: true,
      },
    })
  );
});
