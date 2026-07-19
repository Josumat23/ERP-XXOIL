import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import CalidadFormulario from "./CalidadFormulario";

export default async function CalidadPage() {
  const [pendientes, evaluados] = await Promise.all([
    prisma.loteGranel.findMany({
      where: { estado: "PENDIENTE_CALIDAD" },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaFin: "asc" },
    }),
    prisma.controlCalidad.findMany({
      include: { loteGranel: { include: { formula: { include: { producto: true } } } } },
      orderBy: { fecha: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Control de calidad
      </h1>
      <p className="text-neutral-500 mt-1">
        Ningún lote granel puede envasarse sin aprobación de calidad.
      </p>

      <section className="mt-6">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Lotes pendientes</h2>
        <div className="mt-3 flex flex-col gap-4">
          {pendientes.map((l) => (
            <div key={l.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">
                  <Link href={`/produccion/lotes/${l.id}`} className="hover:underline">
                    {l.codigo}
                  </Link>{" "}
                  — {l.formula.producto.nombre} v{l.formula.version}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatNumero(l.kgProducidos, 2)} kg producidos · merma{" "}
                  {formatNumero(l.mermaKg, 2)} kg
                </p>
              </div>
              <CalidadFormulario loteId={l.id} />
            </div>
          ))}
          {pendientes.length === 0 && (
            <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
              No hay lotes pendientes de evaluación.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Últimas evaluaciones</h2>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Producto</th>
              <th>Resultado</th>
              <th>Observaciones</th>
              <th>Evaluador</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {evaluados.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">
                  <Link href={`/produccion/lotes/${c.loteGranelId}`} className="hover:underline">
                    {c.loteGranel.codigo}
                  </Link>
                </td>
                <td>{c.loteGranel.formula.producto.nombre}</td>
                <td>
                  <span
                    className={`insignia ${
                      c.resultado === "APROBADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {c.resultado === "APROBADO" ? "Aprobado" : "Rechazado"}
                  </span>
                </td>
                <td className="text-sm text-neutral-500 max-w-56">{c.observaciones ?? "—"}</td>
                <td className="text-sm">{c.usuarioNombre}</td>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                    c.fecha
                  )}
                </td>
              </tr>
            ))}
            {evaluados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-4">
                  Sin evaluaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
