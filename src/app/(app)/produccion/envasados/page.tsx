import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

export default async function EnvasadosPage() {
  const envasados = await prisma.envasado.findMany({
    include: {
      loteGranel: { include: { formula: { include: { producto: true } } } },
      presentacion: true,
      insumos: { include: { insumo: true } },
    },
    orderBy: { fecha: "desc" },
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Envasados</h1>
          <p className="text-neutral-500 mt-1">
            Segunda etapa de producción: el granel aprobado se convierte en stock de presentaciones.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
          <Link href="/produccion/envasados/nuevo" className="boton-primario">
            Nuevo envasado
          </Link>
        </div>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Código</th>
            <th>Lote</th>
            <th>Producto</th>
            <th>Presentación</th>
            <th className="text-right">Unidades</th>
            <th className="text-right">Kg granel</th>
            <th>Envases/etiquetas</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {envasados.map((e) => (
            <tr key={e.id}>
              <td className="font-mono text-xs">{e.codigo}</td>
              <td className="font-mono text-xs">
                <Link href={`/produccion/lotes/${e.loteGranelId}`} className="hover:underline">
                  {e.loteGranel.codigo}
                </Link>
              </td>
              <td>{e.loteGranel.formula.producto.nombre}</td>
              <td>{e.presentacion.nombre}</td>
              <td className="text-right">{e.unidades}</td>
              <td className="text-right">{formatNumero(e.kgConsumidos, 2)}</td>
              <td className="text-xs text-neutral-500">
                {e.insumos.map((i) => `${i.insumo.nombre} × ${i.cantidad.toNumber()}`).join(", ") ||
                  "—"}
              </td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                  e.fecha
                )}
              </td>
            </tr>
          ))}
          {envasados.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay envasados registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
