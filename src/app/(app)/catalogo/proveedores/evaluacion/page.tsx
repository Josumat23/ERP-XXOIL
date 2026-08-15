import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

const MS_POR_DIA = 1000 * 60 * 60 * 24;

type Fila = {
  id: string;
  razonSocial: string;
  inspecciones: number;
  aprobadas: number;
  tasaAprobacion: number | null;
  discrepancias: number[];
  retrasos: number[];
};

export default async function EvaluacionProveedoresPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const [proveedores, inspecciones, cuentasConDiscrepancia, recepciones] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true } }),
    prisma.inspeccionCompra.findMany({
      where: { resultado: { not: "PENDIENTE" } },
      include: {
        recepcionDetalle: {
          include: { recepcion: { include: { ordenCompra: { select: { proveedorId: true } } } } },
        },
      },
    }),
    prisma.cuentaPorPagar.findMany({
      where: { discrepanciaPrecioPct: { not: null } },
      select: { proveedorId: true, discrepanciaPrecioPct: true },
    }),
    prisma.recepcionCompra.findMany({
      include: { ordenCompra: { include: { detalles: true } } },
    }),
  ]);

  const mapa = new Map<string, Fila>(
    proveedores.map((p) => [
      p.id,
      { id: p.id, razonSocial: p.razonSocial, inspecciones: 0, aprobadas: 0, tasaAprobacion: null, discrepancias: [], retrasos: [] },
    ])
  );

  for (const insp of inspecciones) {
    const proveedorId = insp.recepcionDetalle.recepcion.ordenCompra.proveedorId;
    const fila = mapa.get(proveedorId);
    if (!fila) continue;
    fila.inspecciones++;
    if (insp.resultado === "APROBADO") fila.aprobadas++;
  }

  for (const c of cuentasConDiscrepancia) {
    const fila = mapa.get(c.proveedorId);
    if (fila && c.discrepanciaPrecioPct) fila.discrepancias.push(c.discrepanciaPrecioPct.toNumber());
  }

  for (const r of recepciones) {
    const fechasEsperadas = r.ordenCompra.detalles
      .map((d) => d.fechaEntregaEsperada)
      .filter((f): f is Date => f !== null);
    if (fechasEsperadas.length === 0) continue;
    const promedioEsperada =
      fechasEsperadas.reduce((acc, f) => acc + f.getTime(), 0) / fechasEsperadas.length;
    const retrasoDias = (r.fecha.getTime() - promedioEsperada) / MS_POR_DIA;
    const fila = mapa.get(r.ordenCompra.proveedorId);
    if (fila) fila.retrasos.push(retrasoDias);
  }

  const filas = Array.from(mapa.values())
    .map((f) => ({
      ...f,
      tasaAprobacion: f.inspecciones > 0 ? f.aprobadas / f.inspecciones : null,
      discrepanciaPromedio: f.discrepancias.length > 0 ? f.discrepancias.reduce((a, b) => a + b, 0) / f.discrepancias.length : null,
      retrasoPromedio: f.retrasos.length > 0 ? f.retrasos.reduce((a, b) => a + b, 0) / f.retrasos.length : null,
    }))
    .filter((f) => f.inspecciones > 0 || f.discrepancias.length > 0 || f.retrasos.length > 0)
    .sort((a, b) => (a.tasaAprobacion ?? 1) - (b.tasaAprobacion ?? 1));

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Evaluación de proveedores
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Calidad (tasa de aprobación en inspección de calidad), precio (variación vs. lo pactado en la
        orden de compra) y plazo (retraso promedio vs. fecha de entrega esperada).
      </p>
      <p className="text-xs text-neutral-400 mt-1">
        Calidad solo considera insumos marcados &quot;requiere inspección&quot; — no todas las compras
        pasan por ese control.
      </p>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th className="text-right">Inspecciones</th>
            <th className="text-right">Aprobación</th>
            <th className="text-right">Discrepancia de precio</th>
            <th className="text-right">Retraso promedio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/catalogo/proveedores/${f.id}`} className="hover:underline">
                  {f.razonSocial}
                </Link>
              </td>
              <td className="text-right">{f.inspecciones}</td>
              <td
                className={`text-right ${
                  f.tasaAprobacion !== null && f.tasaAprobacion < 0.9
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : ""
                }`}
              >
                {f.tasaAprobacion !== null ? `${formatNumero(f.tasaAprobacion * 100, 0)}%` : "—"}
              </td>
              <td
                className={`text-right ${
                  f.discrepanciaPromedio !== null ? "text-amber-700 dark:text-amber-500" : ""
                }`}
              >
                {f.discrepanciaPromedio !== null ? `${formatNumero(f.discrepanciaPromedio, 1)}%` : "—"}
              </td>
              <td
                className={`text-right ${
                  f.retrasoPromedio !== null && f.retrasoPromedio > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-neutral-500"
                }`}
              >
                {f.retrasoPromedio !== null ? `${formatNumero(f.retrasoPromedio, 1)} días` : "—"}
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                No hay suficiente historial de inspecciones, discrepancias o entregas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
