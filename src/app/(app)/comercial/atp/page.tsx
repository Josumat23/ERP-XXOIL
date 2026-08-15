import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { calcularAtpPorProducto, unidadesEquivalentes } from "@/lib/atp";

export default async function AtpPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const [presentaciones, atpPorProducto] = await Promise.all([
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: [{ producto: { nombre: "asc" } }, { sku: "asc" }],
    }),
    calcularAtpPorProducto(),
  ]);

  const filas = presentaciones.map((p) => {
    const atp = atpPorProducto.get(p.productoId);
    const contenidoKg = p.contenidoKg.toNumber();
    const stockDisponible = p.stock.toNumber() - p.stockReservado.toNumber();
    const granelUnidades = atp ? unidadesEquivalentes(atp.granelSinEnvasarKg, contenidoKg) : 0;
    const enProcesoUnidades = atp ? unidadesEquivalentes(atp.planificadoKg, contenidoKg) : 0;
    return {
      id: p.id,
      producto: p.producto.nombre,
      presentacion: p.nombre,
      sku: p.sku,
      stockDisponible,
      granelUnidades,
      enProcesoUnidades,
      lotesPlanificados: atp?.lotesPlanificados ?? 0,
      atpTotal: stockDisponible + granelUnidades + enProcesoUnidades,
    };
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          ATP — Disponible para prometer
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        No solo el stock ya empacado: también cuánto granel aprobado está listo para envasar y
        cuánto hay en lotes de producción todavía en proceso o en espera de calidad, del mismo
        producto.
      </p>
      <p className="text-xs text-neutral-400 mt-1">
        &quot;En camino&quot; es planificado, no garantizado — confirme el plazo con Producción antes
        de prometer fecha a un cliente grande.
      </p>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th className="text-right">Stock disponible</th>
            <th className="text-right">Granel sin envasar</th>
            <th className="text-right">En proceso</th>
            <th className="text-right">ATP total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.producto}</td>
              <td>
                {f.presentacion} <span className="text-xs text-neutral-400 font-mono">{f.sku}</span>
              </td>
              <td className="text-right">{formatNumero(f.stockDisponible, 0)}</td>
              <td className="text-right text-neutral-500">
                {f.granelUnidades > 0 ? `+${formatNumero(f.granelUnidades, 0)}` : "—"}
              </td>
              <td className="text-right text-amber-700 dark:text-amber-500">
                {f.enProcesoUnidades > 0
                  ? `+${formatNumero(f.enProcesoUnidades, 0)} (${f.lotesPlanificados} lote${
                      f.lotesPlanificados === 1 ? "" : "s"
                    })`
                  : "—"}
              </td>
              <td className="text-right font-semibold">{formatNumero(f.atpTotal, 0)}</td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay presentaciones activas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
