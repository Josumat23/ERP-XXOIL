import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { alternarActivoFormula } from "./actions";

export default async function FormulasPage() {
  const formulas = await prisma.formula.findMany({
    include: {
      producto: true,
      detalles: { include: { insumo: true } },
      _count: { select: { lotes: true } },
    },
    orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Fórmulas</h1>
          <p className="text-neutral-500 mt-1">
            Recetas de producción por producto. No se editan: cada cambio crea una versión nueva.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
          <Link href="/produccion/formulas/nueva" className="boton-primario">
            Nueva versión
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {formulas.map((f) => (
          <div key={f.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {f.producto.nombre}{" "}
                  <span className="text-neutral-400 font-normal">— versión {f.version}</span>
                </p>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Batch de {formatNumero(f.rendimientoKg, 2)} kg de granel · {f._count.lotes}{" "}
                  {f._count.lotes === 1 ? "lote producido" : "lotes producidos"}
                  {f.notas ? ` · ${f.notas}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`insignia ${
                    f.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {f.activo ? "Activa" : "Inactiva"}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoFormula(f.id, !f.activo);
                  }}
                >
                  <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    {f.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            </div>

            <table className="tabla mt-3">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="text-right">Cantidad por batch</th>
                </tr>
              </thead>
              <tbody>
                {f.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.insumo.nombre}{" "}
                      <span className="text-xs text-neutral-400 font-mono">{d.insumo.codigo}</span>
                    </td>
                    <td className="text-right">
                      {formatNumero(d.cantidad, 3)} {d.insumo.unidadMedida}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-neutral-400 mt-2">
              Creada por {f.usuarioNombre} el{" "}
              {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(f.creadoEn)}
            </p>
          </div>
        ))}
        {formulas.length === 0 && (
          <p className="text-neutral-500 text-center py-10 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
            No hay fórmulas registradas. Cree la primera versión para poder producir lotes.
          </p>
        )}
      </div>
    </div>
  );
}
