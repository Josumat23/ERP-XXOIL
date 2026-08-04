import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import CausaFormulario from "./CausaFormulario";
import { alternarActivoCausaCalidad } from "./actions";

export default async function CausasCalidadPage() {
  const causas = await prisma.causaCalidad.findMany({
    include: { _count: { select: { controlesCalidad: true, reclamosCliente: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/produccion/calidad" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
            ← Volver a control de calidad
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
            Causas de calidad
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Catálogo reutilizable de causas/defectos, usado tanto en no conformidades de producción
            como en reclamos de cliente. Permite reportes agregados por causa.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <CausaFormulario />

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usos (calidad interna)</th>
            <th>Usos (reclamos)</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {causas.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.nombre}</td>
              <td>{c._count.controlesCalidad}</td>
              <td>{c._count.reclamosCliente}</td>
              <td>
                <span
                  className={`insignia ${
                    c.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {c.activo ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-right">
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoCausaCalidad(c.id, !c.activo);
                  }}
                >
                  <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {causas.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                Sin causas registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
