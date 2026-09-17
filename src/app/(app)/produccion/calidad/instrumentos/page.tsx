import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import {
  DIAS_DE_AVISO_CALIBRACION,
  EXPLICACION_NIVEL_CALIBRACION,
  MENSAJE_ESTADO_CALIBRACION,
  MENSAJE_NIVEL_CONTROL,
  NIVELES_CONTROL,
  avisaAlgo,
  calibracionVigente,
  estadoCalibracion,
  MENSAJE_RESPALDO,
  proximaCalibracionSugerida,
  requiereAtencion,
  respaldoDeMedicion,
} from "@/lib/calibracion";
import { MENSAJE_TIPO_ENSAYO, type TipoEnsayo } from "@/lib/reensayos";
import InstrumentoFormulario from "./InstrumentoFormulario";
import CalibracionFormulario from "./CalibracionFormulario";
import {
  alternarActivoInstrumento,
  fijarNivelControlCalibracion,
  registrarCalibracion,
} from "./actions";

const fechaCorta = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

export default async function InstrumentosPage() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const empresaId = usuario.empresaId;

  const [instrumentos, configuracion] = await Promise.all([
    prisma.instrumentoMedicion.findMany({
      where: { empresaId },
      include: { calibraciones: { orderBy: { fecha: "desc" } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.configuracionEmpresa.findUnique({
      where: { empresaId },
      select: { nivelControlCalibracion: true },
    }),
  ]);
  const nivel = configuracion?.nivelControlCalibracion ?? "NO_APLICA";
  const controlActivo = avisaAlgo(nivel);

  // Qué midió cada instrumento. Es la pregunta del día que una calibración
  // vuelve fuera de tolerancia.
  //
  // Van dos consultas y no un `include` porque hay dos clases de ensayo con su
  // propia fecha —la liberación del lote y el re-análisis del envasado— y
  // Prisma no sabe ordenar una relación por el campo de dos padres distintos.
  // Cada una trae su tope y se mezclan acá.
  const TOPE_POR_CONSULTA = 300;
  const idsInstrumento = instrumentos.map((i) => i.id);
  const [deLiberacion, deReanalisis, deRecepcion] = idsInstrumento.length === 0
    ? [[], [], []]
    : await Promise.all([
        prisma.resultadoCaracteristicaCalidad.findMany({
          where: {
            instrumentoId: { in: idsInstrumento },
            controlCalidad: { loteGranel: { empresaId } },
          },
          select: {
            id: true,
            nombre: true,
            valorMedido: true,
            unidadMedida: true,
            instrumentoId: true,
            controlCalidad: {
              select: { fecha: true, loteGranel: { select: { id: true, codigo: true } } },
            },
          },
          orderBy: { controlCalidad: { fecha: "desc" } },
          take: TOPE_POR_CONSULTA,
        }),
        prisma.resultadoCaracteristicaCalidad.findMany({
          where: { instrumentoId: { in: idsInstrumento }, reanalisis: { empresaId } },
          select: {
            id: true,
            nombre: true,
            valorMedido: true,
            unidadMedida: true,
            instrumentoId: true,
            reanalisis: {
              select: { fecha: true, envasado: { select: { id: true, codigo: true } } },
            },
          },
          orderBy: { reanalisis: { fecha: "desc" } },
          take: TOPE_POR_CONSULTA,
        }),
        // Lo que ENTRA se mide con los mismos equipos. Omitirlo haría que la
        // ficha dijera que el instrumento midió menos de lo que midió.
        prisma.medicionInspeccionCompra.findMany({
          where: {
            instrumentoId: { in: idsInstrumento },
            inspeccion: { recepcionDetalle: { recepcion: { ordenCompra: { empresaId } } } },
          },
          select: {
            id: true,
            nombre: true,
            valorMedido: true,
            unidadMedida: true,
            instrumentoId: true,
            inspeccion: {
              select: {
                fecha: true,
                recepcionDetalle: {
                  select: {
                    id: true,
                    insumo: { select: { codigo: true } },
                    recepcion: { select: { numero: true } },
                  },
                },
              },
            },
          },
          orderBy: { inspeccion: { fecha: "desc" } },
          take: TOPE_POR_CONSULTA,
        }),
      ]);

  type MedicionDeFicha = {
    id: string;
    instrumentoId: string | null;
    fecha: Date;
    ensayo: TipoEnsayo;
    itemId: string;
    itemCodigo: string;
    nombre: string;
    valorMedido: { toString(): string };
    unidadMedida: string;
  };
  const medicionesPorInstrumento = new Map<string, MedicionDeFicha[]>();
  const filasMedicion: MedicionDeFicha[] = [
    ...deLiberacion.flatMap((m) =>
      m.controlCalidad
        ? [{
            ...m,
            fecha: m.controlCalidad.fecha,
            ensayo: "LIBERACION" as const,
            itemId: m.controlCalidad.loteGranel.id,
            itemCodigo: m.controlCalidad.loteGranel.codigo,
          }]
        : []
    ),
    ...deReanalisis.flatMap((m) =>
      m.reanalisis
        ? [{
            ...m,
            fecha: m.reanalisis.fecha,
            ensayo: "REANALISIS" as const,
            itemId: m.reanalisis.envasado.id,
            itemCodigo: m.reanalisis.envasado.codigo,
          }]
        : []
    ),
    ...deRecepcion.flatMap((m) =>
      // Una inspección pendiente todavía no tiene fecha: no se ensayó nada.
      m.inspeccion.fecha
        ? [{
            ...m,
            fecha: m.inspeccion.fecha,
            ensayo: "RECEPCION" as const,
            itemId: m.inspeccion.recepcionDetalle.id,
            itemCodigo: `${m.inspeccion.recepcionDetalle.recepcion.numero} · ${m.inspeccion.recepcionDetalle.insumo.codigo}`,
          }]
        : []
    ),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  for (const fila of filasMedicion) {
    if (!fila.instrumentoId) continue;
    const suyas = medicionesPorInstrumento.get(fila.instrumentoId) ?? [];
    if (suyas.length >= 50) continue;
    suyas.push(fila);
    medicionesPorInstrumento.set(fila.instrumentoId, suyas);
  }

  const filas = instrumentos.map((i) => {
    const vigente = calibracionVigente(i.calibraciones);
    return {
      instrumento: i,
      vigente,
      estado: estadoCalibracion(i.calibraciones),
      sugerido: vigente
        ? proximaCalibracionSugerida(vigente.fecha, i.frecuenciaCalibracionDias)
        : null,
    };
  });
  const enAtencion = filas.filter((f) => f.instrumento.activo && requiereAtencion(f.estado)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Instrumentos de medición
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Densímetros, viscosímetros, balanzas y termómetros del laboratorio, con su historial de
        calibración. <Link href="/produccion/calidad" className="hover:underline">Volver a calidad</Link>
      </p>

      {/*
        El interruptor que pidió el negocio: el laboratorio está en
        implementación, así que el control nace apagado. Lo que gobierna es la
        alerta, no el registro — el maestro se carga igual mientras tanto.
      */}
      {/*
        Tres niveles y no un interruptor, por decisión del negocio: el
        laboratorio informa siempre y frena solo si la empresa lo pide. El
        nivel de hoy se muestra elegido, y cada opción explica qué hace — un
        control que nadie entiende se deja en el que menos moleste.
      */}
      <section className="borde-seccion mb-6">
        <h2 className="font-medium">Control de calibración</h2>
        <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
          Qué hace el sistema al liberar un lote medido con un instrumento sin calibración
          vigente. En cualquier nivel se pueden cargar instrumentos y calibraciones: lo que
          cambia es el control, no el registro.
        </p>
        <div className="flex flex-col gap-2">
          {NIVELES_CONTROL.map((opcion) => (
            <form
              key={opcion}
              action={async () => {
                "use server";
                await fijarNivelControlCalibracion(opcion);
              }}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                opcion === nivel
                  ? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {MENSAJE_NIVEL_CONTROL[opcion]}
                  {opcion === nivel && (
                    <span className="insignia ml-2 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Vigente
                    </span>
                  )}
                </p>
                <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
                  {EXPLICACION_NIVEL_CALIBRACION[opcion]}
                </p>
              </div>
              {opcion !== nivel && (
                <button type="submit" className="boton-secundario shrink-0">
                  Usar este
                </button>
              )}
            </form>
          ))}
        </div>
        {controlActivo && (
          <p className="text-xs mt-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            Se avisa {DIAS_DE_AVISO_CALIBRACION} días antes de que venza una calibración.
          </p>
        )}
        {controlActivo && enAtencion > 0 && (
          <p className="text-sm mt-3 text-red-600 dark:text-red-400 font-medium">
            {enAtencion} instrumento{enAtencion === 1 ? "" : "s"} activo
            {enAtencion === 1 ? "" : "s"} no {enAtencion === 1 ? "está" : "están"} en condiciones de
            usarse para liberar un lote.
          </p>
        )}
      </section>

      <div className="max-w-5xl">
        <InstrumentoFormulario />

        {filas.length === 0 ? (
          <p className="text-sm mt-6" style={{ color: "var(--epicor-texto-tenue)" }}>
            Todavía no hay instrumentos cargados.
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {filas.map(({ instrumento, vigente, estado, sugerido }) => (
              <section key={instrumento.id} className="borde-seccion">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">
                      <span className="font-mono text-sm">{instrumento.codigo}</span>{" "}
                      {instrumento.nombre}
                      {!instrumento.activo && (
                        <span className="text-sm font-normal" style={{ color: "var(--epicor-texto-tenue)" }}>
                          {" "}— inactivo
                        </span>
                      )}
                    </h2>
                    <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
                      {[instrumento.marca, instrumento.modelo, instrumento.serie && `serie ${instrumento.serie}`, instrumento.ubicacion]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos de identificación"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`insignia ${
                        requiereAtencion(estado)
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                          : estado === "POR_VENCER"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      }`}
                    >
                      {MENSAJE_ESTADO_CALIBRACION[estado]}
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoInstrumento(instrumento.id, !instrumento.activo);
                      }}
                    >
                      <button type="submit" className="text-sm hover:underline">
                        {instrumento.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </div>

                <p className="text-sm mt-2">
                  {vigente ? (
                    <>
                      Rige hasta <strong>{fechaCorta.format(vigente.vigenteHasta)}</strong> · certificado{" "}
                      {vigente.numeroCertificado} de {vigente.entidad}
                      {sugerido && (
                        <span style={{ color: "var(--epicor-texto-tenue)" }}>
                          {" "}· por frecuencia tocaría el {fechaCorta.format(sugerido)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "var(--epicor-texto-tenue)" }}>
                      Sin calibraciones registradas.
                    </span>
                  )}
                </p>

                {instrumento.calibraciones.length > 0 && (
                  <table className="tabla mt-3">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Vigente hasta</th>
                        <th>Resultado</th>
                        <th>Certificado</th>
                        <th>Quién calibró</th>
                        <th>Registró</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instrumento.calibraciones.map((c) => (
                        <tr key={c.id}>
                          <td>{fechaCorta.format(c.fecha)}</td>
                          <td>{fechaCorta.format(c.vigenteHasta)}</td>
                          <td
                            className={
                              c.resultado === "NO_CONFORME"
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : ""
                            }
                          >
                            {c.resultado.replaceAll("_", " ")}
                          </td>
                          <td>{c.numeroCertificado}</td>
                          <td>{c.entidad}</td>
                          <td>{c.usuarioNombre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {(medicionesPorInstrumento.get(instrumento.id) ?? []).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">Qué se midió con este instrumento</h3>
                    <p className="text-xs mb-2" style={{ color: "var(--epicor-texto-tenue)" }}>
                      El respaldo se calcula contra el historial de arriba, no se guarda con la
                      medición: así mejora solo cuando se carga una calibración que faltaba.
                    </p>
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Lote / envasado</th>
                          <th>Ensayo</th>
                          <th>Fecha</th>
                          <th>Medición</th>
                          <th>Valor</th>
                          <th>Respaldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(medicionesPorInstrumento.get(instrumento.id) ?? []).map((m) => {
                          const respaldo = respaldoDeMedicion(instrumento.calibraciones, m.fecha);
                          return (
                            <tr key={m.id}>
                              <td className="font-medium">
                                {m.ensayo === "RECEPCION" ? (
                                  // La recepción no tiene ficha propia: se
                                  // identifica por su número y el insumo.
                                  <span className="font-mono text-xs">{m.itemCodigo}</span>
                                ) : (
                                  <Link
                                    href={
                                      m.ensayo === "LIBERACION"
                                        ? `/produccion/lotes/${m.itemId}`
                                        : `/produccion/envasados/${m.itemId}`
                                    }
                                    className="hover:underline"
                                  >
                                    {m.itemCodigo}
                                  </Link>
                                )}
                              </td>
                              <td className="text-xs">{MENSAJE_TIPO_ENSAYO[m.ensayo]}</td>
                              <td>{fechaCorta.format(m.fecha)}</td>
                              <td>{m.nombre}</td>
                              <td>
                                {m.valorMedido.toString()} {m.unidadMedida}
                              </td>
                              <td
                                className={
                                  respaldo === "CALIBRADO"
                                    ? ""
                                    : "text-red-600 dark:text-red-400 font-medium"
                                }
                              >
                                {MENSAJE_RESPALDO[respaldo]}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3">
                  <CalibracionFormulario
                    accion={registrarCalibracion.bind(null, instrumento.id)}
                    vigenteHastaSugerido={
                      proximaCalibracionSugerida(new Date(), instrumento.frecuenciaCalibracionDias)
                        ?.toISOString()
                        .slice(0, 10) ?? null
                    }
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
