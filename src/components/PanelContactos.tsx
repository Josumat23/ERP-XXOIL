import { prisma } from "@/lib/prisma";
import { eliminarContacto } from "@/app/(app)/contactos/actions";
import AgregarContactoFormulario from "./AgregarContactoFormulario";
import BotonEliminarConfirmacion from "./BotonEliminarConfirmacion";

// Server Component compartido, mismo patrón que PanelAdjuntos/PanelDirecciones
// — el contacto "plano" que ya tiene cada modelo sigue siendo el principal por
// defecto; esto es para contactos ADICIONALES (comprador, gerente de
// finanzas, contacto de logística, etc.).
export default async function PanelContactos({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const contactos = await prisma.contacto.findMany({
    where: { entidadTipo, entidadId },
    orderBy: [{ esPrincipal: "desc" }, { creadoEn: "desc" }],
  });

  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
        Contactos adicionales
      </h2>
      <AgregarContactoFormulario
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        rutaRevalidar={rutaRevalidar}
      />
      {contactos.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 text-sm border-b border-black/5 dark:border-white/5 pb-2"
            >
              <div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{c.nombre}</span>
                {c.esPrincipal && (
                  <span className="insignia ml-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                    Principal
                  </span>
                )}
                <p className="text-xs text-neutral-500">
                  {c.cargo}
                  {c.cargo && (c.telefono || c.email) ? " · " : ""}
                  {c.telefono}
                  {c.telefono && c.email ? " · " : ""}
                  {c.email}
                </p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await eliminarContacto(c.id, rutaRevalidar);
                }}
              >
                <BotonEliminarConfirmacion descripcion={`el contacto ${c.nombre}`} />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 mt-3">Sin contactos adicionales.</p>
      )}
    </section>
  );
}
