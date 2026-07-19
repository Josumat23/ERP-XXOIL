import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";

export default async function PanelPage() {
  const [totalProductos, totalPresentaciones, totalInsumos] = await Promise.all([
    prisma.producto.count({ where: { activo: true } }),
    prisma.presentacion.count({ where: { activo: true } }),
    prisma.insumo.count({ where: { activo: true } }),
  ]);

  const presentaciones = await prisma.presentacion.findMany({
    where: { activo: true },
    include: { producto: true },
  });
  const insumos = await prisma.insumo.findMany({ where: { activo: true } });

  const presentacionesBajoMinimo = presentaciones.filter(
    (p) => p.stock.toNumber() < p.stockMinimo.toNumber()
  );
  const insumosBajoMinimo = insumos.filter(
    (i) => i.stock.toNumber() < i.stockMinimo.toNumber()
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Panel — Catálogo
      </h1>
      <p className="text-neutral-500 mt-1">
        Resumen del módulo de catálogo e inventario base.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <TarjetaResumen etiqueta="Productos activos" valor={totalProductos} href="/catalogo/productos" />
        <TarjetaResumen etiqueta="Presentaciones activas" valor={totalPresentaciones} href="/catalogo/presentaciones" />
        <TarjetaResumen etiqueta="Insumos activos" valor={totalInsumos} href="/catalogo/insumos" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Presentaciones bajo stock mínimo
          </h2>
          {presentacionesBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-2">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {presentacionesBajoMinimo.map((p) => (
                <li key={p.id} className="py-2 text-sm flex justify-between">
                  <span>
                    {p.producto.nombre} — {p.nombre}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {formatNumero(p.stock, 0)} / mín. {formatNumero(p.stockMinimo, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Insumos bajo stock mínimo
          </h2>
          {insumosBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-2">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {insumosBajoMinimo.map((i) => (
                <li key={i.id} className="py-2 text-sm flex justify-between">
                  <span>{i.nombre}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {formatNumero(i.stock, 0)} / mín. {formatNumero(i.stockMinimo, 0)} {i.unidadMedida}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function TarjetaResumen({
  etiqueta,
  valor,
  href,
}: {
  etiqueta: string;
  valor: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:border-black/30 dark:hover:border-white/30 transition-colors"
    >
      <p className="text-sm text-neutral-500">{etiqueta}</p>
      <p className="text-3xl font-semibold mt-1 text-neutral-900 dark:text-neutral-100">{valor}</p>
    </Link>
  );
}
