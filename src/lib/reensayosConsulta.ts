import { prisma } from "./prisma";
import { respaldoDeMedicion } from "./calibracion";
import { destinosDeLote, resumenDespacho, type EnvasadoDespachado } from "./despachoLote";
import { lotesPorReensayar, type ItemPorReensayar, type MedicionParaRevisar } from "./reensayos";

// ---------------------------------------------------------------------------
// La consulta detrás de «qué hay que reensayar».
//
// Vive acá y no en la pantalla porque el panel general muestra la misma cuenta
// en su semáforo. Si cada uno la armara por su lado, el día que una diferencia
// se cuele —un filtro de compañía, un tipo de ensayo— el panel diría una cosa
// y la pantalla otra, y nadie sabría cuál creer. Es el mismo defecto que este
// proyecto ya corrigió con la densidad: un solo hecho, una sola fuente.
//
// Recorre los TRES ensayos que hace el laboratorio: la liberación del lote
// granel, el re-análisis que le da vigencia nueva a un envasado, y la
// inspección de lo que entra por compras. Dejar alguno fuera sería peor que no
// tener la pantalla: diría «no hay nada que reensayar» habiendo trabajo.
//
// La inspección de recepción vive en su propia tabla y no en la de los otros
// dos —ya existía así y moverla sería una migración de datos, no un cambio
// aditivo—, y ese es justo el motivo por el que esta función tiene que
// recorrerla explícitamente. La protección contra olvidarse de una fuente es
// que solo hay UN lugar donde acordarse: acá.
// ---------------------------------------------------------------------------

/** Lo que hace falta de una línea de venta para saber cuánto salió y a quién. */
const SELECT_ASIGNACIONES = {
  tipo: true,
  cantidad: true,
  pedidoDetalleId: true,
  facturaDetalleId: true,
  guiaDetalleId: true,
  pedidoDetalle: {
    select: { pedido: { select: { numero: true, cliente: { select: { razonSocial: true } } } } },
  },
  facturaDetalle: { select: { factura: { select: { numero: true } } } },
  guiaDetalle: {
    select: {
      facturaAsignaciones: {
        select: {
          facturaDetalle: { select: { factura: { select: { numero: true, estado: true } } } },
        },
      },
    },
  },
} as const;

export type RevisionDeReensayos = {
  items: ItemPorReensayar[];
  /** Mediciones que declaran instrumento: las únicas cuyo respaldo se puede derivar. */
  medicionesEvaluadas: number;
  /** Las que no lo declaran. No están respaldadas: no se sabe. */
  medicionesSinInstrumento: number;
};

export async function revisarReensayos(empresaId: string): Promise<RevisionDeReensayos> {
  // Un ensayo pertenece a la compañía por dos caminos distintos según su clase,
  // y los dos se acotan. El instrumento ya está acotado, pero la medición llega
  // por otra rama del grafo.
  const deLaCompania = {
    OR: [{ controlCalidad: { loteGranel: { empresaId } } }, { reanalisis: { empresaId } }],
  };

  // La inspección de recepción pertenece a la compañía por la orden de compra.
  const inspeccionDeLaCompania = {
    inspeccion: { recepcionDetalle: { recepcion: { ordenCompra: { empresaId } } } },
  };

  const [instrumentos, sinInstrumentoProduccion, sinInstrumentoRecepcion] = await Promise.all([
    prisma.instrumentoMedicion.findMany({
      where: { empresaId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        calibraciones: { select: { fecha: true, vigenteHasta: true, resultado: true } },
        mediciones: {
          where: deLaCompania,
          select: {
            nombre: true,
            controlCalidad: {
              select: { fecha: true, loteGranel: { select: { id: true, codigo: true } } },
            },
            reanalisis: {
              select: {
                fecha: true,
                envasado: { select: { id: true, codigo: true, loteGranelId: true } },
              },
            },
          },
        },
        medicionesInspeccion: {
          where: inspeccionDeLaCompania,
          select: {
            nombre: true,
            inspeccion: {
              select: {
                fecha: true,
                recepcionDetalle: {
                  select: {
                    id: true,
                    cantidadDisponible: true,
                    insumo: { select: { codigo: true, nombre: true } },
                    recepcion: { select: { numero: true } },
                    asignacionesLote: { select: { cantidad: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.resultadoCaracteristicaCalidad.count({
      where: { instrumentoId: null, ...deLaCompania },
    }),
    prisma.medicionInspeccionCompra.count({
      where: { instrumentoId: null, ...inspeccionDeLaCompania },
    }),
  ]);
  const medicionesSinInstrumento = sinInstrumentoProduccion + sinInstrumentoRecepcion;

  // Se filtra ANTES de ir a buscar a dónde salió cada cosa: derivar el respaldo
  // es aritmética sobre datos que ya están en memoria, y consultar el despacho
  // de algo que no tiene problema sería traer media cadena comercial para
  // descartarla.
  const enCuestion = instrumentos.flatMap((i) =>
    i.mediciones.flatMap((m) => {
      const fecha = m.controlCalidad?.fecha ?? m.reanalisis?.fecha;
      // Sin padre no hay ensayo. La base lo impide con un CHECK; acá se
      // descarta en vez de romper la pantalla si alguna vez fallara.
      if (!fecha) return [];
      return respaldoDeMedicion(i.calibraciones, fecha) === "CALIBRADO"
        ? []
        : [{ instrumento: i, medicion: m, fecha }];
    })
  );
  // La inspección de recepción trae consigo todo lo que hace falta para
  // ubicarla —el insumo, la recepción y si ya se consumió—, así que no necesita
  // una segunda consulta como los lotes y los envasados.
  const recepcionesEnCuestion = instrumentos.flatMap((i) =>
    i.medicionesInspeccion.flatMap((m) => {
      const fecha = m.inspeccion.fecha;
      // Una inspección pendiente todavía no tiene fecha: no se ensayó nada.
      if (!fecha) return [];
      return respaldoDeMedicion(i.calibraciones, fecha) === "CALIBRADO"
        ? []
        : [{ instrumento: i, medicion: m, fecha, detalle: m.inspeccion.recepcionDetalle }];
    })
  );

  const medicionesEvaluadas = instrumentos.reduce(
    (n, i) => n + i.mediciones.length + i.medicionesInspeccion.length,
    0
  );

  const loteIds = [
    ...new Set(
      enCuestion.flatMap((e) =>
        e.medicion.controlCalidad ? [e.medicion.controlCalidad.loteGranel.id] : []
      )
    ),
  ];
  const envasadoIds = [
    ...new Set(
      enCuestion.flatMap((e) => (e.medicion.reanalisis ? [e.medicion.reanalisis.envasado.id] : []))
    ),
  ];

  const [lotes, envasados] = await Promise.all([
    loteIds.length === 0
      ? []
      : prisma.loteGranel.findMany({
          where: { id: { in: loteIds }, empresaId },
          select: {
            id: true,
            estado: true,
            formula: { select: { producto: { select: { nombre: true } } } },
            envasados: {
              select: {
                id: true,
                codigo: true,
                presentacion: { select: { nombre: true } },
                asignacionesLote: { select: SELECT_ASIGNACIONES },
              },
            },
          },
        }),
    envasadoIds.length === 0
      ? []
      : prisma.envasado.findMany({
          where: { id: { in: envasadoIds }, empresaId },
          select: {
            id: true,
            codigo: true,
            unidadesDisponibles: true,
            presentacion: { select: { nombre: true, producto: { select: { nombre: true } } } },
            asignacionesLote: { select: SELECT_ASIGNACIONES },
          },
        }),
  ]);

  const porLote = new Map(
    lotes.map((l) => [
      l.id,
      {
        producto: l.formula.producto.nombre,
        disponibleEnAlmacen: l.estado === "APROBADO",
        despacho: resumenDespacho(destinosDeLote(l.envasados)),
      },
    ])
  );
  const porEnvasado = new Map(
    envasados.map((e) => [
      e.id,
      {
        codigo: e.codigo,
        producto: `${e.presentacion.producto.nombre} ${e.presentacion.nombre}`,
        disponibleEnAlmacen: e.unidadesDisponibles > 0,
        // Un solo envasado, no todos los del lote: el re-análisis le dio
        // vigencia a este envase, no al lote entero.
        despacho: resumenDespacho(
          destinosDeLote([
            {
              id: e.id,
              codigo: e.codigo,
              presentacion: { nombre: e.presentacion.nombre },
              asignacionesLote: e.asignacionesLote,
            } satisfies EnvasadoDespachado,
          ])
        ),
      },
    ])
  );

  const filas: MedicionParaRevisar[] = [];
  for (const { instrumento, medicion, fecha } of enCuestion) {
    const comun = {
      caracteristica: medicion.nombre,
      instrumentoId: instrumento.id,
      instrumentoCodigo: `${instrumento.codigo} — ${instrumento.nombre}`,
      calibraciones: instrumento.calibraciones,
      fechaEnsayo: fecha,
    };

    if (medicion.controlCalidad) {
      const lote = porLote.get(medicion.controlCalidad.loteGranel.id);
      // Si no volvió de la consulta acotada por compañía, no se muestra.
      if (!lote) continue;
      filas.push({
        ...comun,
        ensayo: "LIBERACION",
        itemId: medicion.controlCalidad.loteGranel.id,
        itemCodigo: medicion.controlCalidad.loteGranel.codigo,
        loteGranelId: medicion.controlCalidad.loteGranel.id,
        productoNombre: lote.producto,
        disponibleEnAlmacen: lote.disponibleEnAlmacen,
        unidadesDespachadas: lote.despacho.unidades,
        clientesAfectados: lote.despacho.clientes,
      });
      continue;
    }

    if (medicion.reanalisis) {
      const envasado = porEnvasado.get(medicion.reanalisis.envasado.id);
      if (!envasado) continue;
      filas.push({
        ...comun,
        ensayo: "REANALISIS",
        itemId: medicion.reanalisis.envasado.id,
        itemCodigo: envasado.codigo,
        loteGranelId: medicion.reanalisis.envasado.loteGranelId,
        productoNombre: envasado.producto,
        disponibleEnAlmacen: envasado.disponibleEnAlmacen,
        unidadesDespachadas: envasado.despacho.unidades,
        clientesAfectados: envasado.despacho.clientes,
      });
    }
  }

  for (const { instrumento, medicion, fecha, detalle } of recepcionesEnCuestion) {
    const consumido = detalle.asignacionesLote.reduce((acc, a) => acc + a.cantidad.toNumber(), 0);
    filas.push({
      caracteristica: medicion.nombre,
      instrumentoId: instrumento.id,
      instrumentoCodigo: `${instrumento.codigo} — ${instrumento.nombre}`,
      calibraciones: instrumento.calibraciones,
      fechaEnsayo: fecha,
      ensayo: "RECEPCION",
      itemId: detalle.id,
      itemCodigo: `${detalle.recepcion.numero} · ${detalle.insumo.codigo}`,
      // Un insumo no tiene lote granel propio: el recall por lote no aplica
      // hasta saber en qué lotes se consumió, que es otra pregunta.
      loteGranelId: "",
      productoNombre: detalle.insumo.nombre,
      disponibleEnAlmacen: detalle.cantidadDisponible.toNumber() > 0,
      // «Despachado» para un insumo es que ya se consumió en producción: dejó
      // de estar en nuestras manos como insumo y pasó a estar dentro de lotes.
      unidadesDespachadas: consumido,
      clientesAfectados: 0,
    });
  }

  return {
    items: lotesPorReensayar(filas),
    medicionesEvaluadas,
    medicionesSinInstrumento,
  };
}
