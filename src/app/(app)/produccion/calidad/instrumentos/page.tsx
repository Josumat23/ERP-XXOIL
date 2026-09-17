import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import {
  DIAS_DE_AVISO_CALIBRACION,
  MENSAJE_ESTADO_CALIBRACION,
  calibracionVigente,
  estadoCalibracion,
  proximaCalibracionSugerida,
  requiereAtencion,
} from "@/lib/calibracion";
import InstrumentoFormulario from "./InstrumentoFormulario";
import CalibracionFormulario from "./CalibracionFormulario";
import {
  alternarActivoInstrumento,
  alternarControlCalibracion,
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
      select: { controlCalibracion: true },
    }),
  ]);
  const controlActivo = configuracion?.controlCalibracion ?? false;

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
      <section className="borde-seccion mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Control de calibración</h2>
            <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
              {controlActivo
                ? `Activo: los instrumentos vencidos, sin calibrar o fuera de tolerancia aparecen en el semáforo del panel general, y se avisa ${DIAS_DE_AVISO_CALIBRACION} días antes del vencimiento.`
                : "No aplica todavía. Puede cargar instrumentos y calibraciones igual; el semáforo y los avisos quedan apagados hasta que lo active."}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await alternarControlCalibracion(!controlActivo);
            }}
          >
            <button type="submit" className={controlActivo ? "boton-secundario" : "boton-primario"}>
              {controlActivo ? "Marcar como no aplica" : "Activar el control"}
            </button>
          </form>
        </div>
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
