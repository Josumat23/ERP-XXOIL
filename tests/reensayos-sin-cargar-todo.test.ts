import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { revisarReensayos } from "@/lib/reensayosConsulta";
import {
  respaldoDeMedicion,
  ventanasRespaldadas,
  type Calibracion,
  type VentanaRespaldada,
} from "@/lib/calibracion";

// ---------------------------------------------------------------------------
// «Qué hay que reensayar» cargaba el laboratorio entero para descartarlo.
//
// `revisarReensayos()` traía TODAS las mediciones de TODOS los instrumentos
// —sin tope— y después filtraba en memoria las que no tenían respaldo. Con seis
// mediciones es gratis. Con un año de producción son decenas de miles de filas
// por visita, y no solo en su pantalla: el semáforo del panel general llama a
// la misma función, así que el costo lo paga cualquiera que abra el inicio.
//
// Es el defecto OPUESTO al de la ficha del instrumento: aquel truncaba y
// mentía; este dice la verdad pero no escala. Y la solución no puede ser un
// tope, porque el orden que importa —lo que ya está en el cliente primero— se
// calcula después de traer la cadena comercial: recortar antes de ordenar
// devolvería una lista incompleta con cara de completa.
//
// La solución es FILTRAR, no recortar. Lo que se busca son las mediciones sin
// respaldo, que son la excepción y no la regla: si el laboratorio está al día
// el resultado es pequeño, y si es enorme eso mismo es la alarma. El tamaño
// pasa a estar acotado por el tamaño del problema, que es el límite correcto.
//
// Para poder preguntárselo a la base hace falta traducir la regla de respaldo
// a tramos de fechas. `ventanasRespaldadas()` no la reimplementa: la EJECUTA
// sobre los instantes donde la respuesta puede cambiar. Este archivo comprueba
// que las dos formas de preguntar dan siempre lo mismo.
// ---------------------------------------------------------------------------

const dia = 24 * 60 * 60 * 1000;
const fecha = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

const dentroDe = (ventanas: VentanaRespaldada[], d: Date) =>
  ventanas.some((v) => v.desde.getTime() <= d.getTime() && d.getTime() <= v.hasta.getTime());

// --- Las formas conocidas ---------------------------------------------------

test("sin calibraciones no hay ningún tramo respaldado", () => {
  assert.deepEqual(ventanasRespaldadas([]), []);
});

test("una calibración conforme respalda su vigencia completa, extremos incluidos", () => {
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2026-01-10"), vigenteHasta: fecha("2027-01-10"), resultado: "CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  assert.equal(ventanas.length, 1, "debería ser un solo tramo");
  assert.equal(ventanas[0].desde.getTime(), fecha("2026-01-10").getTime());
  assert.equal(ventanas[0].hasta.getTime(), fecha("2027-01-10").getTime());
  // El día del vencimiento todavía respalda: la regla usa `<=` en los dos lados.
  assert.ok(dentroDe(ventanas, fecha("2027-01-10")));
  assert.ok(!dentroDe(ventanas, new Date(fecha("2027-01-10").getTime() + 1)));
});

test("si la verificación siguiente salió fuera de tolerancia, no queda tramo respaldado", () => {
  // Lo medido en ese período queda EN_DUDA, que no es CALIBRADO: tiene que
  // aparecer en «qué hay que reensayar», o sea FUERA de las ventanas.
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2026-01-10"), vigenteHasta: fecha("2027-01-10"), resultado: "CONFORME" },
    { fecha: fecha("2026-06-10"), vigenteHasta: fecha("2027-06-10"), resultado: "NO_CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  assert.ok(!dentroDe(ventanas, fecha("2026-03-01")), "un ensayo en duda quedó dado por bueno");
  assert.ok(!dentroDe(ventanas, fecha("2026-08-01")), "después del fallo no hay respaldo");
});

test("una calibración conforme posterior vuelve a respaldar", () => {
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2026-01-10"), vigenteHasta: fecha("2027-01-10"), resultado: "CONFORME" },
    { fecha: fecha("2026-06-10"), vigenteHasta: fecha("2027-06-10"), resultado: "NO_CONFORME" },
    { fecha: fecha("2026-07-01"), vigenteHasta: fecha("2027-07-01"), resultado: "CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  assert.ok(dentroDe(ventanas, fecha("2026-09-01")), "lo medido después del arreglo sí respalda");
  assert.ok(!dentroDe(ventanas, fecha("2026-03-01")), "lo anterior al fallo sigue en duda");
});

test("los huecos entre dos vigencias no se respaldan", () => {
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2025-01-01"), vigenteHasta: fecha("2025-12-31"), resultado: "CONFORME" },
    { fecha: fecha("2026-03-01"), vigenteHasta: fecha("2027-03-01"), resultado: "CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  assert.equal(ventanas.length, 2, "los dos períodos se unieron tapando el hueco");
  assert.ok(!dentroDe(ventanas, fecha("2026-01-15")), "el hueco quedó dado por respaldado");
});

test("dos vigencias pegadas se devuelven como un solo tramo", () => {
  // Mandarle a la base veinte rangos donde hay uno no cambia la respuesta, pero
  // la consulta crece sin motivo.
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2025-01-01"), vigenteHasta: fecha("2026-01-01"), resultado: "CONFORME" },
    { fecha: fecha("2025-12-01"), vigenteHasta: fecha("2026-12-01"), resultado: "CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  assert.equal(ventanas.length, 1, `se devolvieron ${ventanas.length} tramos donde hay uno`);
  assert.equal(ventanas[0].desde.getTime(), fecha("2025-01-01").getTime());
  assert.equal(ventanas[0].hasta.getTime(), fecha("2026-12-01").getTime());
});

test("«conforme con ajuste» respalda igual que conforme", () => {
  const calibraciones: Calibracion[] = [
    {
      fecha: fecha("2026-01-10"),
      vigenteHasta: fecha("2027-01-10"),
      resultado: "CONFORME_CON_AJUSTE",
    },
  ];
  assert.ok(dentroDe(ventanasRespaldadas(calibraciones), fecha("2026-05-05")));
});

// --- La equivalencia, sobre fechas al azar -----------------------------------

test("los tramos dicen exactamente lo mismo que la regla, sobre mil fechas al azar", () => {
  // La guarda que de verdad importa: `ventanasRespaldadas()` existe para poder
  // preguntarle a la base, y si contestara distinto que `respaldoDeMedicion()`
  // la pantalla mostraría una lista y la ficha otra.
  //
  // Semilla fija: una prueba que falla una vez de cada cien y pasa al
  // reintentar no es una guarda, es ruido.
  let semilla = 20260918;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };
  const resultados = ["CONFORME", "CONFORME_CON_AJUSTE", "NO_CONFORME"] as const;
  const base = fecha("2025-01-01").getTime();

  let casosCalibrados = 0;
  for (let caso = 0; caso < 200; caso += 1) {
    const cuantas = 1 + Math.floor(azar() * 4);
    const calibraciones: Calibracion[] = [];
    for (let i = 0; i < cuantas; i += 1) {
      const inicio = base + Math.floor(azar() * 700) * dia;
      calibraciones.push({
        fecha: new Date(inicio),
        vigenteHasta: new Date(inicio + (30 + Math.floor(azar() * 500)) * dia),
        resultado: resultados[Math.floor(azar() * resultados.length)],
      });
    }
    const ventanas = ventanasRespaldadas(calibraciones);

    for (let intento = 0; intento < 5; intento += 1) {
      const cuando = new Date(base + Math.floor(azar() * 1200) * dia);
      const porLaRegla = respaldoDeMedicion(calibraciones, cuando) === "CALIBRADO";
      if (porLaRegla) casosCalibrados += 1;
      assert.equal(
        dentroDe(ventanas, cuando),
        porLaRegla,
        `los tramos y la regla discrepan el ${cuando.toISOString()} con ${JSON.stringify(
          calibraciones.map((c) => [c.fecha.toISOString(), c.vigenteHasta.toISOString(), c.resultado])
        )}`
      );
    }
  }

  // Sin esto la prueba pasaría con una implementación que nunca respalda nada.
  assert.ok(casosCalibrados > 50, `solo ${casosCalibrados} casos respaldados: el azar no ejercitó`);
});

test("los extremos exactos de cada calibración también coinciden", () => {
  // Los bordes son donde una implementación por tramos se equivoca: `<` en vez
  // de `<=` mueve la frontera un milisegundo y nadie lo nota hasta que un
  // ensayo del día del vencimiento aparece —o desaparece— de la lista.
  const calibraciones: Calibracion[] = [
    { fecha: fecha("2026-01-10"), vigenteHasta: fecha("2026-06-10"), resultado: "CONFORME" },
    { fecha: fecha("2026-06-20"), vigenteHasta: fecha("2026-12-20"), resultado: "CONFORME" },
  ];
  const ventanas = ventanasRespaldadas(calibraciones);
  for (const c of calibraciones) {
    for (const instante of [c.fecha, c.vigenteHasta]) {
      for (const desplazamiento of [-1, 0, 1]) {
        const cuando = new Date(instante.getTime() + desplazamiento);
        assert.equal(
          dentroDe(ventanas, cuando),
          respaldoDeMedicion(calibraciones, cuando) === "CALIBRADO",
          `discrepan en ${cuando.toISOString()} (${desplazamiento} ms del borde)`
        );
      }
    }
  }
});

// --- Contra la base ---------------------------------------------------------

/** El armado mínimo para tener mediciones de recepción en una compañía propia. */
async function montarLaboratorio(sufijo: string) {
  const empresaId = `empresa-rs-${sufijo}`;
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
      numero: `OC-RS-${sufijo}`,
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
      numero: `RC-RS-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `VIS-${sufijo}`, nombre: "Viscosímetro" },
  });

  /** Una inspección con una medición, fechada hace `diasAtras` días. */
  const inspeccionar = async (diasAtras: number, etiqueta: string) => {
    const detalle = await prisma.recepcionCompraDetalle.create({
      data: {
        recepcionId: recepcion.id,
        insumoId: insumo.id,
        cantidad: 10,
        cantidadDisponible: 10,
        costoUnitario: 1,
      },
    });
    await prisma.inspeccionCompra.create({
      data: {
        recepcionCompraDetalleId: detalle.id,
        resultado: "APROBADO",
        fecha: new Date(Date.now() - diasAtras * dia),
        mediciones: {
          create: [
            {
              secuencia: 1,
              nombre: etiqueta,
              unidadMedida: "cSt",
              valorMedido: 14.8,
              conforme: true,
              instrumentoId: instrumento.id,
            },
          ],
        },
      },
    });
    return detalle;
  };

  const calibrar = (desdeDias: number, hastaDias: number, resultado: "CONFORME" | "NO_CONFORME") =>
    prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(Date.now() - desdeDias * dia),
        vigenteHasta: new Date(Date.now() - hastaDias * dia),
        resultado,
        numeroCertificado: `CAL-${sufijo}-${desdeDias}`,
        entidad: "Laboratorio acreditado",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

  const limpiar = async () => {
    await prisma.medicionInspeccionCompra.deleteMany({
      where: { inspeccion: { recepcionDetalle: { recepcionId: recepcion.id } } },
    });
    await prisma.inspeccionCompra.deleteMany({
      where: { recepcionDetalle: { recepcionId: recepcion.id } },
    });
    await prisma.recepcionCompraDetalle.deleteMany({ where: { recepcionId: recepcion.id } });
    await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
    await prisma.calibracionInstrumento.deleteMany({ where: { empresaId } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
    await prisma.insumo.delete({ where: { id: insumo.id } }).catch(() => {});
    await prisma.proveedor.delete({ where: { id: proveedor.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  };

  return { empresaId, instrumento, inspeccionar, calibrar, limpiar };
}

test("solo vuelve lo que no tiene respaldo, no el laboratorio entero", async () => {
  // La consecuencia del cambio, medida donde se nota: una compañía con dos
  // mediciones —una respaldada y otra no— devuelve UNA.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lab = await montarLaboratorio(sufijo);

  try {
    // Calibración conforme vigente desde hace 100 días hasta dentro de 100.
    await lab.calibrar(100, -100, "CONFORME");
    const respaldada = await lab.inspeccionar(50, "Dentro de la vigencia");
    const sinRespaldo = await lab.inspeccionar(200, "Antes de la calibración");

    const revision = await revisarReensayos(lab.empresaId);

    assert.equal(revision.items.length, 1, "trajo de más o de menos");
    assert.equal(revision.items[0].itemId, sinRespaldo.id, "trajo la que sí tenía respaldo");
    assert.ok(
      !revision.items.some((i) => i.itemId === respaldada.id),
      "una medición con calibración vigente apareció como pendiente de reensayo"
    );

    // El conteo sigue contando TODAS las evaluadas, no solo las que volvieron:
    // el mensaje «las N mediciones tienen calibración vigente» depende de eso, y
    // antes salía de contar lo que la consulta había traído.
    assert.equal(revision.medicionesEvaluadas, 2, "el conteo se quedó con lo que trajo la consulta");
    assert.equal(revision.medicionesSinInstrumento, 0);
  } finally {
    await lab.limpiar();
  }
});

test("lo que quedó en duda por una verificación fallida sí vuelve", async () => {
  // EN_DUDA no es CALIBRADO: la medición se tomó dentro de una vigencia, pero
  // la verificación siguiente encontró el instrumento fuera de tolerancia. Es
  // el caso que un filtro por «fecha dentro de la vigencia» dejaría afuera.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lab = await montarLaboratorio(sufijo);

  try {
    await lab.calibrar(300, -100, "CONFORME");
    const enDuda = await lab.inspeccionar(200, "Medida antes del fallo");
    // La verificación siguiente, hace 30 días: fuera de tolerancia.
    await lab.calibrar(30, -300, "NO_CONFORME");

    const revision = await revisarReensayos(lab.empresaId);
    assert.equal(revision.items.length, 1, "lo que quedó en duda no apareció");
    assert.equal(revision.items[0].itemId, enDuda.id);
  } finally {
    await lab.limpiar();
  }
});

test("un instrumento sin ninguna calibración deja todo lo suyo en cuestión", async () => {
  // El laboratorio que recién arranca: sin tramos respaldados no hay nada que
  // excluir, y la consulta tiene que traer todo lo que midió — lo contrario de
  // lo que haría un `NOT IN ()` mal armado.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lab = await montarLaboratorio(sufijo);

  try {
    const detalle = await lab.inspeccionar(1, "Densidad a 15 °C");
    const revision = await revisarReensayos(lab.empresaId);
    assert.equal(revision.items.length, 1, "lo medido con un instrumento sin calibrar no apareció");
    assert.equal(revision.items[0].itemId, detalle.id);
    assert.equal(revision.medicionesEvaluadas, 1);
  } finally {
    await lab.limpiar();
  }
});

test("una compañía sin instrumentos no rompe ni inventa trabajo", async () => {
  // Con el catálogo vacío las consultas ni se lanzan: un `OR` vacío en la base
  // no significa «todo», pero tampoco hay por qué averiguarlo cada vez.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-rsv-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  try {
    const revision = await revisarReensayos(empresaId);
    assert.deepEqual(revision.items, []);
    assert.equal(revision.medicionesEvaluadas, 0);
    assert.equal(revision.medicionesSinInstrumento, 0);
  } finally {
    await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  }
});

test("una medición sin instrumento declarado se sigue contando aparte", async () => {
  // No está respaldada —no se sabe con qué se midió— pero tampoco se puede
  // derivar nada de ella. La pantalla la reporta por separado y eso no cambió.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lab = await montarLaboratorio(sufijo);

  try {
    const detalle = await lab.inspeccionar(10, "Sin instrumento");
    await prisma.medicionInspeccionCompra.updateMany({
      where: { inspeccion: { recepcionCompraDetalleId: detalle.id } },
      data: { instrumentoId: null },
    });

    const revision = await revisarReensayos(lab.empresaId);
    assert.equal(revision.medicionesSinInstrumento, 1);
    assert.equal(revision.medicionesEvaluadas, 0, "contó como evaluada una sin instrumento");
    assert.equal(revision.items.length, 0, "una medición sin instrumento no se puede dictaminar");
  } finally {
    await lab.limpiar();
  }
});

test("el filtro de la base no cruza compañías", async () => {
  const a = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const b = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "z";
  const una = await montarLaboratorio(a);
  const otra = await montarLaboratorio(b);

  try {
    const suya = await una.inspeccionar(5, "Propia");
    await otra.inspeccionar(5, "Ajena");

    const revision = await revisarReensayos(una.empresaId);
    assert.equal(revision.items.length, 1, "vio mediciones de otra compañía");
    assert.equal(revision.items[0].itemId, suya.id);
    assert.equal(revision.medicionesEvaluadas, 1);
  } finally {
    await una.limpiar();
    await otra.limpiar();
  }
});
