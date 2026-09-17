import { prisma } from "./prisma";
import { respaldoDeMedicion } from "./calibracion";
import { destinosDeLote, resumenDespacho } from "./despachoLote";
import { lotesPorReensayar, type LotePorReensayar, type MedicionParaRevisar } from "./reensayos";

// ---------------------------------------------------------------------------
// La consulta detrás de «qué hay que reensayar».
//
// Vive acá y no en la pantalla porque el panel general muestra la misma cuenta
// en su semáforo. Si cada uno la armara por su lado, el día que una diferencia
// se cuele —un filtro de compañía, un estado de lote— el panel diría una cosa
// y la pantalla otra, y nadie sabría cuál creer. Es el mismo defecto que este
// proyecto ya corrigió con la densidad: un solo hecho, una sola fuente.
// ---------------------------------------------------------------------------

export type RevisionDeReensayos = {
  lotes: LotePorReensayar[];
  /** Mediciones que declaran instrumento: las únicas cuyo respaldo se puede derivar. */
  medicionesEvaluadas: number;
  /** Las que no lo declaran. No están respaldadas: no se sabe. */
  medicionesSinInstrumento: number;
};

export async function revisarReensayos(empresaId: string): Promise<RevisionDeReensayos> {
  const [instrumentos, medicionesSinInstrumento] = await Promise.all([
    prisma.instrumentoMedicion.findMany({
      where: { empresaId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        calibraciones: { select: { fecha: true, vigenteHasta: true, resultado: true } },
        mediciones: {
          // El instrumento ya está acotado a la compañía, pero el ensayo llega
          // por otra rama del grafo: se acota también. Un lote de otra
          // compañía no tiene por qué aparecer acá aunque alguien haya
          // cruzado los ids.
          where: { controlCalidad: { loteGranel: { empresaId } } },
          select: {
            nombre: true,
            controlCalidad: {
              select: { fecha: true, loteGranel: { select: { id: true, codigo: true } } },
            },
          },
        },
      },
    }),
    prisma.resultadoCaracteristicaCalidad.count({
      where: { instrumentoId: null, controlCalidad: { loteGranel: { empresaId } } },
    }),
  ]);

  // Se filtra ANTES de ir a buscar a dónde salió cada lote: derivar el respaldo
  // es aritmética sobre datos que ya están en memoria, y consultar el despacho
  // de un lote que no tiene problema sería traer media cadena comercial para
  // descartarla.
  const enCuestion = instrumentos.flatMap((i) =>
    i.mediciones
      .filter((m) => respaldoDeMedicion(i.calibraciones, m.controlCalidad.fecha) !== "CALIBRADO")
      .map((m) => ({ instrumento: i, medicion: m }))
  );
  const medicionesEvaluadas = instrumentos.reduce((n, i) => n + i.mediciones.length, 0);
  const loteIds = [...new Set(enCuestion.map((e) => e.medicion.controlCalidad.loteGranel.id))];

  const lotesAfectados =
    loteIds.length === 0
      ? []
      : await prisma.loteGranel.findMany({
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
                asignacionesLote: {
                  select: {
                    tipo: true,
                    cantidad: true,
                    pedidoDetalleId: true,
                    facturaDetalleId: true,
                    guiaDetalleId: true,
                    pedidoDetalle: {
                      select: {
                        pedido: {
                          select: { numero: true, cliente: { select: { razonSocial: true } } },
                        },
                      },
                    },
                    facturaDetalle: { select: { factura: { select: { numero: true } } } },
                    guiaDetalle: {
                      select: {
                        facturaAsignaciones: {
                          select: {
                            facturaDetalle: {
                              select: { factura: { select: { numero: true, estado: true } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

  const porLote = new Map(
    lotesAfectados.map((l) => [
      l.id,
      {
        estado: l.estado,
        producto: l.formula.producto.nombre,
        despacho: resumenDespacho(destinosDeLote(l.envasados)),
      },
    ])
  );

  const filas: MedicionParaRevisar[] = [];
  for (const { instrumento, medicion } of enCuestion) {
    const lote = porLote.get(medicion.controlCalidad.loteGranel.id);
    // Si el lote no volvió de la consulta acotada por compañía, no se muestra.
    if (!lote) continue;
    filas.push({
      loteId: medicion.controlCalidad.loteGranel.id,
      loteCodigo: medicion.controlCalidad.loteGranel.codigo,
      productoNombre: lote.producto,
      loteAprobado: lote.estado === "APROBADO",
      unidadesDespachadas: lote.despacho.unidades,
      clientesAfectados: lote.despacho.clientes,
      fechaEnsayo: medicion.controlCalidad.fecha,
      caracteristica: medicion.nombre,
      instrumentoId: instrumento.id,
      instrumentoCodigo: `${instrumento.codigo} — ${instrumento.nombre}`,
      calibraciones: instrumento.calibraciones,
    });
  }

  return {
    lotes: lotesPorReensayar(filas),
    medicionesEvaluadas,
    medicionesSinInstrumento,
  };
}
