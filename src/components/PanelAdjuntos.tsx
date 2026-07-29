import { prisma } from "@/lib/prisma";
import { formatearTamanio } from "@/lib/adjuntos";
import { eliminarAdjunto } from "@/app/(app)/adjuntos/actions";
import SubirAdjuntoFormulario from "./SubirAdjuntoFormulario";

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

  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Adjuntos</h2>
      <SubirAdjuntoFormulario
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        rutaRevalidar={rutaRevalidar}
      />
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
                <span>{formatearTamanio(a.tamanioBytes)}</span>
                <span>{a.usuarioNombre}</span>
                <form
                  action={async () => {
                    "use server";
                    await eliminarAdjunto(a.id, rutaRevalidar);
                  }}
                >
                  <button type="submit" className="text-red-500 hover:underline">
                    Eliminar
                  </button>
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
