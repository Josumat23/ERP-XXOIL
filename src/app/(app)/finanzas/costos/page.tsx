import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

// Reporte de costos: costo promedio de insumos, costo/kg de lotes y
// margen por presentación (precio de venta vs costo promedio de envasado).
export default async function CostosPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const [insumos, lotes, presentaciones] = await Promise.all([
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.loteGranel.findMany({
      where: { estado: { in: ["APROBADO", "RECHAZADO", "PENDIENTE_CALIDAD"] } },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
      take: 20,
    }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Costos y márgenes
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Los costos de insumos se actualizan por promedio ponderado en cada recepción de compra; los
        de producción se calculan por lote y envasado.
      </p>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Margen por presentación
        </h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Presentación</th>
              <th className="text-right">Costo promedio</th>
              <th className="text-right">Precio de venta</th>
              <th className="text-right">Margen unitario</th>
              <th className="text-right">Margen %</th>
            </tr>
          </thead>
          <tbody>
            {presentaciones.map((p) => {
              const costo = p.costoPromedio.toNumber();
              const precio = p.precio.toNumber();
              const margen = precio - costo;
              const margenPct = precio > 0 ? (margen / precio) * 100 : 0;
              const sinCosto = costo === 0;
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.sku}</td>
                  <td>
                    {p.producto.nombre} — {p.nombre}
                  </td>
                  <td className="text-right">{sinCosto ? "—" : formatMoneda(costo)}</td>
                  <td className="text-right">{formatMoneda(precio)}</td>
                  <td
                    className={`text-right font-medium ${
                      sinCosto
                        ? ""
                        : margen >= 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {sinCosto ? "—" : formatMoneda(margen)}
                  </td>
                  <td className="text-right">{sinCosto ? "—" : `${formatNumero(margenPct, 1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-neutral-400 mt-2">
          El costo promedio se calcula al envasar (granel al costo/kg del lote + envases y
          etiquetas). Las presentaciones sin envasados registrados aún no tienen costo.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Costo de órdenes de producción recientes
        </h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Producto</th>
              <th className="text-right">Kg producidos</th>
              <th className="text-right">Merma</th>
              <th className="text-right">Costo insumos</th>
              <th className="text-right">Costo por kg</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.codigo}</td>
                <td>{l.formula.producto.nombre}</td>
                <td className="text-right">{formatNumero(l.kgProducidos, 2)}</td>
                <td className="text-right">{formatNumero(l.mermaKg, 2)}</td>
                <td className="text-right">{formatMoneda(l.costoInsumos)}</td>
                <td className="text-right font-medium">{formatMoneda(l.costoKg)}</td>
              </tr>
            ))}
            {lotes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-4">
                  Sin órdenes de producción con costo registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Costo promedio de insumos
        </h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Código</th>
              <th>Insumo</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Costo unitario</th>
              <th className="text-right">Valorizado</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs">{i.codigo}</td>
                <td>{i.nombre}</td>
                <td className="text-right">
                  {formatNumero(i.stock, 2)} {i.unidadMedida}
                </td>
                <td className="text-right">{formatMoneda(i.costoUnitario)}</td>
                <td className="text-right">
                  {formatMoneda(i.stock.toNumber() * i.costoUnitario.toNumber())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
