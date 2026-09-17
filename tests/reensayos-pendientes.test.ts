import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { destinosDeLote, resumenDespacho, type EnvasadoDespachado } from "@/lib/despachoLote";
import {
  MENSAJE_DESTINO,
  destinoDelProducto,
  lotesPorReensayar,
  resumenReensayos,
  type MedicionParaRevisar,
} from "@/lib/reensayos";
import { senalReensayos } from "@/lib/semaforo";
import { revisarReensayos } from "@/lib/reensayosConsulta";

// ---------------------------------------------------------------------------
// Qué hay que reensayar.
//
// El sistema ya contestaba, instrumento por instrumento, qué lotes había
// medido cada uno. Faltaba la pregunta al revés —la que se hace el día que una
// calibración vuelve fuera de tolerancia—: qué tengo que reensayar de todo el
// laboratorio, y por dónde empiezo.
//
// Lo que se prueba acá con más cuidado es el ORDEN, porque es la decisión del
// ciclo: manda dónde está el producto, no la gravedad del problema de
// medición. Un lote que el cliente ya tiene no se arregla reensayándolo.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const dia = 24 * 60 * 60 * 1000;
const F = (diasDesdeCero: number) => new Date(2026, 0, 1 + diasDesdeCero);
const cal = (
  desde: number,
  hasta: number,
  resultado: "CONFORME" | "CONFORME_CON_AJUSTE" | "NO_CONFORME" = "CONFORME"
) => ({ fecha: F(desde), vigenteHasta: F(hasta), resultado }) as const;

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
  calibraciones: [cal(0, 365)],
  ...parcial,
});

// --- Qué entra en la lista --------------------------------------------------

test("una medición respaldada no genera trabajo", () => {
  assert.deepEqual(lotesPorReensayar([medicion()]), []);
});

test("una medición sin calibración vigente pone al lote en la lista", () => {
  const lotes = lotesPorReensayar([medicion({ calibraciones: [] })]);
  assert.equal(lotes.length, 1);
  assert.equal(lotes[0].itemCodigo, "LG-0001");
  assert.equal(lotes[0].peorRespaldo, "SIN_RESPALDO");
});

test("sin mediciones, la lista está vacía y no rompe", () => {
  assert.deepEqual(lotesPorReensayar([]), []);
  assert.deepEqual(resumenReensayos([]), { total: 0, despachados: 0 });
});

test("varias mediciones del mismo lote son UNA fila, no tres", () => {
  // Con volumen real, un lote con cinco características caídas que ocupa cinco
  // filas hace parecer que hay cinco lotes con problemas.
  const lotes = lotesPorReensayar([
    medicion({ caracteristica: "Densidad", calibraciones: [] }),
    medicion({ caracteristica: "Viscosidad", calibraciones: [] }),
    medicion({ caracteristica: "Punto de goteo", calibraciones: [] }),
  ]);
  assert.equal(lotes.length, 1);
  assert.equal(lotes[0].mediciones.length, 3);
  assert.deepEqual(
    lotes[0].mediciones.map((m) => m.caracteristica),
    ["Densidad", "Viscosidad", "Punto de goteo"]
  );
});

test("solo entran las mediciones que no se sostienen, no todo el lote", () => {
  const lotes = lotesPorReensayar([
    medicion({ caracteristica: "Densidad", calibraciones: [] }),
    medicion({ caracteristica: "Viscosidad" }), // esta sí tiene respaldo
  ]);
  assert.equal(lotes[0].mediciones.length, 1);
  assert.equal(lotes[0].mediciones[0].caracteristica, "Densidad");
});

test("el peor respaldo del lote es el que lo describe", () => {
  // Una en duda y otra sin respaldo: el lote se describe por la confirmada.
  const enDuda = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  const lotes = lotesPorReensayar([
    medicion({ caracteristica: "Viscosidad", calibraciones: [] }),
    medicion({ caracteristica: "Densidad", calibraciones: enDuda }),
  ]);
  assert.equal(lotes[0].peorRespaldo, "EN_DUDA");
});

// --- Dónde está el producto -------------------------------------------------

test("el destino distingue lo despachado de lo que sigue en casa", () => {
  assert.equal(destinoDelProducto({ unidadesDespachadas: 5, disponibleEnAlmacen: true }), "DESPACHADO");
  assert.equal(destinoDelProducto({ unidadesDespachadas: 0, disponibleEnAlmacen: true }), "EN_ALMACEN");
  assert.equal(destinoDelProducto({ unidadesDespachadas: 0, disponibleEnAlmacen: false }), "SIN_SALIDA");
});

test("un lote despachado lo es aunque su estado no sea APROBADO", () => {
  // Si salió, salió: el estado posterior del lote no lo trae de vuelta.
  assert.equal(destinoDelProducto({ unidadesDespachadas: 3, disponibleEnAlmacen: false }), "DESPACHADO");
});

test("cada destino se explica en palabras, no con la sigla", () => {
  assert.equal(MENSAJE_DESTINO.DESPACHADO, "Ya está en poder del cliente");
  assert.equal(MENSAJE_DESTINO.EN_ALMACEN, "Todavía en almacén");
  assert.equal(MENSAJE_DESTINO.SIN_SALIDA, "Nunca salió");
});

// --- El orden: la decisión del ciclo ----------------------------------------

test("lo que ya está en el cliente va primero, aunque su problema sea menor", () => {
  // LA regla. El despachado solo tiene un hueco de datos; el de almacén tiene
  // un instrumento confirmado fuera de tolerancia. Igual va primero el
  // despachado: reensayar el de almacén es trabajo de laboratorio, el otro ya
  // es una conversación con el cliente.
  const enDuda = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  const lotes = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: enDuda }),
    medicion({
      itemId: "B",
      itemCodigo: "LG-B",
      calibraciones: [],
      unidadesDespachadas: 40,
      clientesAfectados: 2,
    }),
  ]);
  assert.deepEqual(
    lotes.map((l) => l.itemCodigo),
    ["LG-B", "LG-A"]
  );
});

test("entre dos lotes igual de expuestos, primero el problema confirmado", () => {
  // `EN_DUDA` es un instrumento que se verificó y estaba mal. `SIN_RESPALDO`
  // suele ser una calibración que existe en papel y nadie cargó todavía.
  const enDuda = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  const lotes = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [] }),
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: enDuda }),
  ]);
  assert.deepEqual(
    lotes.map((l) => l.itemCodigo),
    ["LG-B", "LG-A"]
  );
});

test("entre iguales, el ensayo más reciente primero", () => {
  const lotes = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [], fechaEnsayo: F(10) }),
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: [], fechaEnsayo: F(300) }),
  ]);
  assert.deepEqual(
    lotes.map((l) => l.itemCodigo),
    ["LG-B", "LG-A"]
  );
});

test("el lote que nunca salió queda al final", () => {
  const lotes = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [], disponibleEnAlmacen: false }),
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: [], disponibleEnAlmacen: true }),
    medicion({
      itemId: "C",
      itemCodigo: "LG-C",
      calibraciones: [],
      unidadesDespachadas: 1,
    }),
  ]);
  assert.deepEqual(
    lotes.map((l) => l.itemCodigo),
    ["LG-C", "LG-B", "LG-A"]
  );
});

test("el orden en que llegan las mediciones no cambia la lista", () => {
  // La guardia que faltó el ciclo pasado: `respaldoDeMedicion` tomaba «la
  // primera calibración que encajara» y dependía del orden de la base.
  const enDuda = [cal(0, 365), cal(200, 560, "NO_CONFORME")];
  const entrada = [
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [], fechaEnsayo: F(10) }),
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: enDuda, unidadesDespachadas: 4 }),
    medicion({ itemId: "C", itemCodigo: "LG-C", calibraciones: [], fechaEnsayo: F(300) }),
  ];
  const directo = lotesPorReensayar(entrada).map((l) => l.itemCodigo);
  const invertido = lotesPorReensayar([...entrada].reverse()).map((l) => l.itemCodigo);
  assert.deepEqual(directo, invertido);
  assert.deepEqual(directo, ["LG-B", "LG-C", "LG-A"]);
});

test("dos lotes idénticos en todo se ordenan por código, no al azar", () => {
  const lotes = lotesPorReensayar([
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: [] }),
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [] }),
  ]);
  assert.deepEqual(
    lotes.map((l) => l.itemCodigo),
    ["LG-A", "LG-B"]
  );
});

// --- El resumen para el panel -----------------------------------------------

test("el resumen separa el trabajo del laboratorio de la conversación con el cliente", () => {
  const lotes = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "LG-A", calibraciones: [] }),
    medicion({ itemId: "B", itemCodigo: "LG-B", calibraciones: [], unidadesDespachadas: 7 }),
  ]);
  assert.deepEqual(resumenReensayos(lotes), { total: 2, despachados: 1 });
});

test("un lote despachado es crítico; uno en casa, aviso", () => {
  assert.deepEqual(senalReensayos(3, 1), [
    { indicador: "1 lote despachado con mediciones sin respaldo", estado: "critico" },
    { indicador: "2 lotes por reensayar", estado: "atencion" },
  ]);
});

test("sin lotes en cuestión el semáforo no dice nada", () => {
  assert.deepEqual(senalReensayos(0, 0), []);
});

test("si todos los lotes ya salieron, no se inventa un aviso de cero", () => {
  assert.deepEqual(senalReensayos(2, 2), [
    { indicador: "2 lotes despachados con mediciones sin respaldo", estado: "critico" },
  ]);
});

// --- A dónde salió el lote --------------------------------------------------

const envasado = (
  codigo: string,
  asignaciones: EnvasadoDespachado["asignacionesLote"]
): EnvasadoDespachado => ({
  id: `e-${codigo}`,
  codigo,
  presentacion: { nombre: "Balde 20 kg" },
  asignacionesLote: asignaciones,
});

const asignacion = (
  tipo: "ASIGNADA" | "LIBERADA",
  cantidad: number,
  linea = "d1",
  cliente = "Minera Andina S.A.C."
) => ({
  tipo,
  cantidad,
  pedidoDetalleId: linea,
  facturaDetalleId: null,
  guiaDetalleId: null,
  pedidoDetalle: { pedido: { numero: "P-001", cliente: { razonSocial: cliente } } },
  facturaDetalle: null,
  guiaDetalle: null,
});

test("lo despachado es lo asignado menos lo liberado", () => {
  const destinos = destinosDeLote([
    envasado("EV-1", [asignacion("ASIGNADA", 10), asignacion("LIBERADA", 4)]),
  ]);
  assert.equal(destinos.length, 1);
  assert.equal(destinos[0].cantidad, 6);
});

test("una línea devuelta por completo deja de contar", () => {
  // Una factura anulada o una devolución total: el cliente ya no lo tiene, y
  // aparecer en la lista de recall sería una alarma falsa.
  const destinos = destinosDeLote([
    envasado("EV-1", [asignacion("ASIGNADA", 10), asignacion("LIBERADA", 10)]),
  ]);
  assert.deepEqual(destinos, []);
});

test("una línea con varios eventos aparece una sola vez", () => {
  const destinos = destinosDeLote([
    envasado("EV-1", [
      asignacion("ASIGNADA", 5),
      asignacion("ASIGNADA", 5),
      asignacion("LIBERADA", 2),
    ]),
  ]);
  assert.equal(destinos.length, 1);
  assert.equal(destinos[0].cantidad, 8);
});

test("se agregan todos los envasados del lote, no uno", () => {
  const destinos = destinosDeLote([
    envasado("EV-1", [asignacion("ASIGNADA", 10, "d1", "Minera Andina S.A.C.")]),
    envasado("EV-2", [asignacion("ASIGNADA", 3, "d2", "Transportes Sur E.I.R.L.")]),
  ]);
  assert.deepEqual(resumenDespacho(destinos), { unidades: 13, clientes: 2 });
});

test("el mismo cliente en dos envasados cuenta como uno", () => {
  const destinos = destinosDeLote([
    envasado("EV-1", [asignacion("ASIGNADA", 10, "d1")]),
    envasado("EV-2", [asignacion("ASIGNADA", 3, "d2")]),
  ]);
  assert.deepEqual(resumenDespacho(destinos), { unidades: 13, clientes: 1 });
});

test("una guía facturada muestra sus facturas y omite las anuladas", () => {
  const conGuia = {
    ...asignacion("ASIGNADA", 5),
    guiaDetalleId: "g1",
    guiaDetalle: {
      facturaAsignaciones: [
        { facturaDetalle: { factura: { numero: "F001-1", estado: "EMITIDA" } } },
        { facturaDetalle: { factura: { numero: "F001-2", estado: "ANULADA" } } },
      ],
    },
  };
  assert.equal(destinosDeLote([envasado("EV-1", [conGuia])])[0].facturaNumero, "F001-1");
});

test("una guía sin facturas vigentes queda en null, no en cadena vacía", () => {
  // Defecto que apareció al extraer esta cuenta de la pantalla de recall: el
  // `join` de una lista vacía devolvía "", que no es nulo, así que la columna
  // salía en blanco en vez de mostrar «todavía sin facturar».
  const conGuia = {
    ...asignacion("ASIGNADA", 5),
    guiaDetalleId: "g1",
    guiaDetalle: {
      facturaAsignaciones: [
        { facturaDetalle: { factura: { numero: "F001-9", estado: "ANULADA" } } },
      ],
    },
  };
  assert.equal(destinosDeLote([envasado("EV-1", [conGuia])])[0].facturaNumero, null);
});

test("sin ninguna salida, el resumen es cero y no nulo", () => {
  assert.deepEqual(resumenDespacho([]), { unidades: 0, clientes: 0 });
});

// --- Que esté conectado -----------------------------------------------------

test("el panel general muestra los lotes por reensayar", async () => {
  // La guardia de siempre: una alerta que solo se ve entrando a su propia
  // pantalla no alerta a nadie. Ya pasó con las homologaciones por vencer.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.match(panel, /senalReensayos\(/, "el semáforo no recibe la señal");
  assert.match(panel, /revisarReensayos\(/, "el panel no calcula los lotes de verdad");
});

test("el panel y la pantalla usan la misma consulta", async () => {
  // Dos derivaciones del mismo hecho terminan discrepando sin que nadie lo
  // note: es el defecto que este proyecto ya corrigió con la densidad.
  const pantalla = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/reensayos/page.tsx"),
    "utf8"
  );
  assert.match(pantalla, /revisarReensayos\(/);
});

test("se llega a la pantalla desde el menú", async () => {
  const navegacion = await readFile(resolve(RAIZ, "src/lib/navegacion.ts"), "utf8");
  assert.match(navegacion, /produccion\/calidad\/reensayos/);
});

test("la pantalla de recall dejó de repetir la cuenta a mano", async () => {
  // Estaba escrita tres veces. Una regla de negocio copiada se corrige en un
  // solo lugar y sigue mal en los otros dos.
  const recall = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(recall, /destinosDeLote\(/);
  assert.doesNotMatch(recall, /tipo === "ASIGNADA"/, "volvió a calcular el neto a mano");
});

// --- Contra la base ---------------------------------------------------------

test("la consulta encuentra el lote medido con un instrumento vencido", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: {
      empresaId,
      categoriaId: categoria.id,
      codigo: `RNS-${sufijo}`,
      nombre: `Grasa ${sufijo}`,
    },
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
      codigo: `LG-RNS-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      kgProducidos: 98,
      estado: "APROBADO",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  try {
    await prisma.controlCalidad.create({
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
    });

    // Sin ninguna calibración cargada, el ensayo no se sostiene.
    const sinCalibrar = await revisarReensayos(empresaId);
    const mio = sinCalibrar.items.find((l) => l.itemId === lote.id);
    assert.ok(mio, "el lote medido con un instrumento sin calibrar no apareció");
    assert.equal(mio.peorRespaldo, "SIN_RESPALDO");
    assert.equal(mio.destino, "EN_ALMACEN", "nunca se despachó");
    assert.equal(mio.mediciones[0].caracteristica, "Densidad a 15 °C");

    // Se carga la calibración que faltaba y el lote sale de la lista SOLO, sin
    // tocar el ensayo. Es la misma propiedad del ciclo anterior, vista desde
    // acá: el respaldo se deriva, no se congela.
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
      despues.items.find((l) => l.itemId === lote.id),
      undefined,
      "cargar la calibración que faltaba no sacó al lote de la lista"
    );

    // Y una verificación posterior fuera de tolerancia lo devuelve, ahora como
    // problema confirmado y no como hueco de datos.
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(Date.now() + dia),
        vigenteHasta: new Date(Date.now() + 360 * dia),
        resultado: "NO_CONFORME",
        numeroCertificado: `CAL-NC-${sufijo}`,
        entidad: "Lab externo",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const enDuda = await revisarReensayos(empresaId);
    const vuelto = enDuda.items.find((l) => l.itemId === lote.id);
    assert.ok(vuelto, "la verificación fallida no puso el lote en cuestión");
    assert.equal(vuelto.peorRespaldo, "EN_DUDA");
  } finally {
    await prisma.controlCalidad.deleteMany({ where: { loteGranelId: lote.id } });
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});

test("el lote de otra compañía no entra aunque lo midan con un instrumento nuestro", async () => {
  // El caso que de verdad hay que aislar. Que cada compañía vea sus propios
  // instrumentos es fácil; lo difícil es el cruce: una fila de ensayo que
  // apunta a un instrumento de la compañía 1 y a un lote de la 2. La pantalla
  // llega al lote POR el instrumento, así que si solo se acotara el
  // instrumento, el lote ajeno entraría por la puerta de atrás.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // La segunda compañía se crea acá y no se busca: la base de pruebas trae
  // solo los maestros mínimos, y un `if (!otra) return` convertía esta prueba
  // en verde sin haber comprobado nada.
  const otra = await prisma.empresa.create({
    data: { razonSocial: `Lubricantes ajenos ${sufijo}`, ruc: "20555444333" },
  });
  const categoria = await prisma.categoria.create({
    data: { empresaId: otra.id, nombre: `Grasas ${sufijo}` },
  });
  const producto = await prisma.producto.create({
    data: {
      empresaId: otra.id,
      categoriaId: categoria.id,
      codigo: `RNS2-${sufijo}`,
      nombre: `Grasa ajena ${sufijo}`,
    },
  });
  // El instrumento es NUESTRO; el lote que mide, de la otra compañía.
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId: "1", codigo: `DM2-${sufijo}`, nombre: "Densímetro propio" },
  });
  const formula = await prisma.formula.create({
    data: {
      empresaId: otra.id,
      productoId: producto.id,
      version: 1,
      rendimientoKg: 100,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const lote = await prisma.loteGranel.create({
    data: {
      empresaId: otra.id,
      codigo: `LG-RNS2-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      estado: "APROBADO",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  try {
    await prisma.controlCalidad.create({
      data: {
        loteGranelId: lote.id,
        resultado: "APROBADO",
        usuarioId: "u",
        usuarioNombre: "u",
        resultadosCaracteristica: {
          create: [
            {
              secuencia: 1,
              nombre: "Densidad",
              unidadMedida: "kg/L",
              valorMedido: 0.9,
              conforme: true,
              instrumentoId: instrumento.id,
            },
          ],
        },
      },
    });

    const propia = await revisarReensayos("1");
    assert.equal(
      propia.items.find((l) => l.itemId === lote.id),
      undefined,
      "el lote de otra compañía se coló por el instrumento"
    );
  } finally {
    await prisma.controlCalidad.deleteMany({ where: { loteGranelId: lote.id } });
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
    await prisma.categoria.delete({ where: { id: categoria.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: otra.id } }).catch(() => {});
  }
});
