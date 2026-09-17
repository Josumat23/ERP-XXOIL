import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import {
  declaracionesParaDocumento,
  etiquetaEspecificacion,
  textoDeclaracion,
} from "@/lib/especificaciones";

const fechaLarga = new Intl.DateTimeFormat("es-PE", { dateStyle: "long" });
const fechaCorta = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

export default async function CertificadoAnalisisPage({ params }: { params: Promise<{ loteId: string }> }) {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const { loteId } = await params;
  const lote = await prisma.loteGranel.findFirst({
    where: { id: loteId, formula: { empresaId: usuario.empresaId } },
    include: {
      formula: {
        include: {
          producto: {
            include: {
              especificaciones: {
                include: { especificacion: true },
                orderBy: [{ especificacion: { organismo: "asc" } }, { especificacion: { codigo: "asc" } }],
              },
            },
          },
        },
      },
      controlCalidad: {
        include: {
          planInspeccion: true,
          resultadosCaracteristica: {
            orderBy: { secuencia: "asc" },
            include: { instrumento: { select: { codigo: true, nombre: true } } },
          },
        },
      },
      // El certificado es del LOTE y los re-análisis son de cada ENVASADO: un
      // lote puede tener varios envases y solo algunos revalidados. Por eso la
      // sección de abajo dice de qué envase habla cada uno — quien recibe el
      // EV-00003 tiene que poder encontrar el suyo y no leer el de otro.
      envasados: {
        where: { reanalisis: { some: {} } },
        select: {
          codigo: true,
          fechaVencimiento: true,
          reanalisis: {
            orderBy: { fecha: "asc" },
            include: {
              planInspeccion: { select: { nombre: true } },
              resultadosCaracteristica: {
                orderBy: { secuencia: "asc" },
                include: { instrumento: { select: { codigo: true } } },
              },
            },
          },
        },
        orderBy: { codigo: "asc" },
      },
    },
  });
  if (!lote?.controlCalidad || lote.controlCalidad.resultado !== "APROBADO" || lote.controlCalidad.resultadosCaracteristica.length === 0) notFound();
  const control = lote.controlCalidad;
  // Una homologación vencida no se imprime: el documento se emite hoy y
  // afirmarla hoy sería afirmar algo que dejó de regir. El dato no se borra —
  // sigue en la ficha del producto, marcado, para que alguien lo renueve.
  const especificaciones = declaracionesParaDocumento(lote.formula.producto.especificaciones);
  return <div className="max-w-3xl">
    <div className="flex items-center justify-between no-imprimir"><Link href={`/produccion/lotes/${lote.id}`} className="text-sm hover:underline">← Volver al lote</Link><BotonImprimir etiqueta="Imprimir certificado / PDF" /></div>
    <article className="documento border border-black/10 dark:border-white/10 rounded-lg p-7 mt-4">
      <MembreteEmpresa tituloDocumento="CERTIFICADO DE ANÁLISIS" numero={`Lote ${lote.codigo}`} />
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Dato etiqueta="Producto" valor={`${lote.formula.producto.codigo} — ${lote.formula.producto.nombre}`} />
        <Dato etiqueta="Lote de fabricación" valor={lote.codigo} />
        <Dato etiqueta="Cantidad fabricada" valor={`${formatNumero(lote.kgProducidos, 2)} kg`} />
        <Dato etiqueta="Fecha de fabricación" valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(lote.fechaFin ?? lote.fechaInicio)} />
        <Dato etiqueta="Plan de inspección" valor={control.planInspeccion ? `${control.planInspeccion.nombre} v${control.planVersion}` : "Evaluación heredada"} />
        <Dato etiqueta="Decisión de uso" valor="APROBADO PARA USO / ENVASADO" />
      </div>
      {/*
        El instrumento va bajo el método, no en columna propia: en un documento
        que se imprime, una columna más aprieta todo lo demás. Se imprime el
        EQUIPO, que es un hecho del ensayo; no se imprime si su calibración
        estaba vigente —eso el sistema lo deriva y es criterio de calidad, no
        un dato que corresponda afirmar en un documento que va al cliente—.
      */}
      <table className="tabla mt-7"><thead><tr><th>#</th><th>Característica</th><th>Método / equipo</th><th>Especificación</th><th>Resultado</th><th>Conformidad</th></tr></thead><tbody>
        {control.resultadosCaracteristica.map(r => <tr key={r.id}><td>{r.secuencia}</td><td>{r.nombre}</td><td>{r.metodoEnsayo ?? "—"}{r.instrumento && <span className="block text-xs text-neutral-500">{r.instrumento.codigo} — {r.instrumento.nombre}</span>}</td><td>{r.limiteInferior?.toString() ?? "−∞"} a {r.limiteSuperior?.toString() ?? "+∞"} {r.unidadMedida}</td><td className="font-medium">{r.valorMedido.toString()} {r.unidadMedida}</td><td className={r.conforme ? "text-green-700 font-medium" : "text-red-700 font-medium"}>{r.conforme ? "Conforme" : "No conforme"}</td></tr>)}
      </tbody></table>
      {/*
        Las especificaciones son del PRODUCTO, no resultados de ensayo de este
        lote. Van en su propio bloque y con su propia leyenda: mezclarlas con
        la tabla de mediciones haría creer que el lote se ensayó contra API
        CK-4, cuando lo que se midió es lo que el plan de inspección dice.
      */}
      {especificaciones.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Especificaciones del producto
          </h3>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Especificación</th>
                <th>Declaración</th>
              </tr>
            </thead>
            <tbody>
              {especificaciones.map((e) => (
                <tr key={e.id}>
                  <td>{etiquetaEspecificacion(e.especificacion)}</td>
                  <td>{textoDeclaracion(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            Corresponden al producto y no a los ensayos de este lote, que son los de la tabla
            anterior. «Cumple» es una declaración del fabricante; «Homologado» es una aprobación
            otorgada por el organismo, identificada por su número.
          </p>
        </div>
      )}

      {/*
        Revalidación de vigencia.
        =========================
        Un lubricante no se echa a perder al llegar su fecha: el laboratorio
        vuelve a ensayarlo y, si sigue en especificación, le da vigencia nueva.
        Quien recibe producto con la fecha extendida tiene derecho a ver que la
        extensión se sostiene en un ensayo y no en una decisión administrativa
        — que es, exactamente, la diferencia entre revalidar y reetiquetar.
      */}
      {lote.envasados.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Revalidación de vigencia
          </h3>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Envase</th>
                <th>Fecha</th>
                <th>Resultado</th>
                <th>Vigencia</th>
                <th>Mediciones del re-ensayo</th>
              </tr>
            </thead>
            <tbody>
              {lote.envasados.flatMap((e) =>
                e.reanalisis.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">
                      {e.codigo}
                      {e.fechaVencimiento && (
                        <span className="block text-xs font-normal text-neutral-500">
                          vence {fechaCorta.format(e.fechaVencimiento)}
                        </span>
                      )}
                    </td>
                    <td>{fechaLarga.format(r.fecha)}</td>
                    <td className={r.resultado === "APROBADO" ? "" : "text-red-700 font-medium"}>
                      {r.resultado}
                    </td>
                    <td>
                      {fechaCorta.format(r.vencimientoAnterior)} →{" "}
                      <strong>{fechaCorta.format(r.vencimientoNuevo)}</strong>
                    </td>
                    <td className="text-xs">
                      {r.resultadosCaracteristica.length > 0 ? (
                        <ul>
                          {r.resultadosCaracteristica.map((m) => (
                            <li key={m.id} className={m.conforme ? "" : "text-red-700 font-medium"}>
                              {m.nombre}: {m.valorMedido.toString()} {m.unidadMedida}
                              {m.instrumento ? ` · ${m.instrumento.codigo}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-neutral-500">
                          {r.planInspeccion ? r.planInspeccion.nombre : "Sin mediciones registradas"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            La vigencia de cada envase es la de su última revalidación. Un re-ensayo con resultado
            RECHAZADO no extiende la vigencia; se deja asentado porque consta que se ensayó.
          </p>
        </div>
      )}

      {control.observaciones && <div className="mt-5 text-sm"><strong>Observaciones:</strong> {control.observaciones}</div>}
      <div className="mt-12 grid grid-cols-2 gap-12 text-sm"><div className="border-t border-neutral-500 pt-2"><strong>{control.usuarioNombre}</strong><span className="block text-neutral-500">Responsable de liberación de calidad</span></div><div className="border-t border-neutral-500 pt-2"><strong>Fecha de liberación</strong><span className="block text-neutral-500">{new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(control.fecha)}</span></div></div>
      <p className="mt-8 text-xs text-neutral-500">Documento generado desde el registro inmutable de control de calidad. La validez corresponde al lote indicado y a la versión del plan aplicada al momento de su liberación.</p>
    </article>
  </div>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) { return <div><span className="block text-xs text-neutral-500 uppercase tracking-wide">{etiqueta}</span><span className="font-medium">{valor}</span></div>; }
