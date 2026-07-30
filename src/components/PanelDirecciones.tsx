import { prisma } from "@/lib/prisma";
import { eliminarDireccion } from "@/app/(app)/direcciones/actions";
import AgregarDireccionFormulario from "./AgregarDireccionFormulario";

const ETIQUETA_TIPO: Record<string, string> = {
  FACTURACION: "Facturación",
  ENVIO: "Envío",
  OTRA: "Otra",
};

// Server Component compartido: se cae dentro de cualquier ficha (Cliente,
// Proveedor, Empleado...) con su propio entidadTipo/entidadId, igual que
// PanelAdjuntos — la dirección "plana" que ya tiene cada modelo sigue siendo
// la principal por defecto; esto es para direcciones ADICIONALES (envío
// distinto de facturación, sucursales en otro país, etc.).
export default async function PanelDirecciones({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const direcciones = await prisma.direccion.findMany({
    where: { entidadTipo, entidadId },
    orderBy: [{ esPrincipal: "desc" }, { creadoEn: "desc" }],
  });

  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
        Direcciones adicionales
      </h2>
      <AgregarDireccionFormulario
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        rutaRevalidar={rutaRevalidar}
      />
      {direcciones.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {direcciones.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-3 text-sm border-b border-black/5 dark:border-white/5 pb-2"
            >
              <div>
                <span className="insignia bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
                  {ETIQUETA_TIPO[d.tipo]}
                </span>
                {d.esPrincipal && (
                  <span className="insignia ml-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                    Principal
                  </span>
                )}
                <p className="mt-1">
                  {d.direccion}
                  {d.distrito ? `, ${d.distrito}` : ""}
                  {d.provincia ? `, ${d.provincia}` : ""}
                  {d.departamento ? `, ${d.departamento}` : ""} — {d.pais}
                  {d.codigoPostal ? ` (${d.codigoPostal})` : ""}
                </p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await eliminarDireccion(d.id, rutaRevalidar);
                }}
              >
                <button type="submit" className="text-xs text-red-500 hover:underline whitespace-nowrap">
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 mt-3">Sin direcciones adicionales.</p>
      )}
    </section>
  );
}
