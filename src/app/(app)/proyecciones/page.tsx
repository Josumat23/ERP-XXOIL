import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { irAProyeccionActual } from "./actions";

const NOMBRE_TRIMESTRE: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3", 4: "T4" };

export default async function ProyeccionesPage() {
  const usuario = await obtenerUsuario();
  if (
    !usuario ||
    !["ADMIN", "GERENCIA", "VENTAS", "PRODUCCION"].includes(usuario.rol)
  ) {
    redirect("/");
  }

  const proyecciones = await prisma.proyeccion.findMany({
    orderBy: [{ anio: "desc" }, { trimestre: "desc" }],
    include: { _count: { select: { detalles: true } } },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Proyecciones
          </h1>
          <p className="text-neutral-500 mt-1">
            Marketing, Operaciones y Finanzas por trimestre — estacionalidad de tu propia historia
            de ventas + supuestos cualitativos, igual que un modelo de S&amp;OP.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await irAProyeccionActual();
          }}
        >
          <button type="submit" className="boton-primario">
            Proyectar próximo trimestre
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {proyecciones.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Todavía no hay proyecciones. Hacé clic en &quot;Proyectar próximo trimestre&quot; para crear la
            primera.
          </p>
        ) : (
          proyecciones.map((p) => (
            <Link
              key={p.id}
              href={`/proyecciones/${p.id}`}
              className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:border-black/30 dark:hover:border-white/30 transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {NOMBRE_TRIMESTRE[p.trimestre]} {p.anio}
              </span>
              <span className="text-sm text-neutral-500">
                basada en {NOMBRE_TRIMESTRE[p.trimestreBase]} {p.anioBase} · {p._count.detalles}{" "}
                presentaciones
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
