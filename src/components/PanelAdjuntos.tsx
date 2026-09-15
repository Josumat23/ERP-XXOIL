import { prisma } from "@/lib/prisma";
import { formatearTamanio } from "@/lib/adjuntos";
import { eliminarAdjunto } from "@/app/(app)/adjuntos/actions";
import SubirAdjuntoFormulario from "./SubirAdjuntoFormulario";
import {
  documentosPorAtender,
  ETIQUETA_TIPO_DOCUMENTO,
  mensajeAvisoDocumento,
  vigenciaDocumento,
  type TipoDocumentoAdjunto,
} from "@/lib/documentosAdjuntos";
import { formatFecha } from "@/lib/format";
import BotonEliminarConfirmacion from "./BotonEliminarConfirmacion";

// Componente compartido: se cae dentro de cualquier página de detalle (con
// entidadTipo/entidadId propios) sin necesitar una tabla de unión nueva por
// módulo. Server Component: hace su propia consulta a Prisma.
export default async function PanelAdjuntos({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const adjuntos = await prisma.adjunto.findMany({
    where: { entidadTipo, entidadId },
    orderBy: { creadoEn: "desc" },
  });

  // Solo los vencidos y los que están por vencer: listar los vigentes
  // convertiría el aviso en un inventario, y un aviso que siempre tiene
  // contenido deja de mirarse.
  const avisos = documentosPorAtender(adjuntos);

  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Adjuntos</h2>
      <SubirAdjuntoFormulario
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        rutaRevalidar={rutaRevalidar}
      />
      {avisos.length > 0 && (
        <ul className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {avisos.map((aviso) => (
            <li key={aviso.documento.id}>{mensajeAvisoDocumento(aviso)}</li>
          ))}
        </ul>
      )}
      {adjuntos.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {adjuntos.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-sm border-b border-black/5 dark:border-white/5 pb-2"
            >
              <a
                href={`/api/adjuntos/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {a.nombreOriginal}
              </a>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                {a.tipoDocumento && (
                  <span className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {ETIQUETA_TIPO_DOCUMENTO[a.tipoDocumento as TipoDocumentoAdjunto]}
                  </span>
                )}
                {a.venceEl && (
                  <span
                    className={
                      vigenciaDocumento(a.venceEl) === "VENCIDO"
                        ? "text-red-600 dark:text-red-400"
                        : vigenciaDocumento(a.venceEl) === "POR_VENCER"
                          ? "text-amber-700 dark:text-amber-400"
                          : ""
                    }
                  >
                    Vence {formatFecha(a.venceEl)}
                  </span>
                )}
                <span>{formatearTamanio(a.tamanioBytes)}</span>
                <span>{a.usuarioNombre}</span>
                <form
                  action={async () => {
                    "use server";
                    await eliminarAdjunto(a.id, rutaRevalidar);
                  }}
                >
                  <BotonEliminarConfirmacion descripcion={`el adjunto ${a.nombreOriginal}`} />
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 mt-3">Sin adjuntos.</p>
      )}
    </section>
  );
}
