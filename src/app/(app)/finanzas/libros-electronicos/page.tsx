import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatMoneda } from "@/lib/format";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function LibrosElectronicosPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");

  const hoy = new Date();
  const { anio: anioParam, mes: mesParam } = await searchParams;
  const anio = Number(anioParam) || hoy.getFullYear();
  const mes = Number(mesParam) || hoy.getMonth() + 1;

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const [facturas, notasCredito, cuentas] = await Promise.all([
    prisma.factura.aggregate({
      where: { fechaEmision: { gte: desde, lt: hasta } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.notaCredito.aggregate({
      where: { fecha: { gte: desde, lt: hasta } },
      _count: true,
      _sum: { monto: true },
    }),
    prisma.cuentaPorPagar.aggregate({
      where: { fechaEmision: { gte: desde, lt: hasta } },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  const totalVentas = (facturas._sum.total?.toNumber() ?? 0) + (notasCredito._sum.monto?.toNumber() ?? 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Libros electrónicos (PLE)
      </h1>
      <p className="text-sm mb-6 max-w-2xl" style={{ color: "var(--epicor-texto-tenue)" }}>
        Genera el Registro de Ventas e Ingresos (Formato 14.1) y el Registro de Compras (Formato
        8.1) del PLE de SUNAT, listos para importar en el Programa de Libros Electrónicos. Cubre
        los campos principales de operaciones domésticas; los campos de uso opcional (no
        domiciliados, detracciones, aduanas) se dejan en blanco.
      </p>

      <form method="get" className="flex items-end gap-3 mb-8 no-imprimir">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Mes</span>
          <select name="mes" defaultValue={mes} className="campo-input">
            {NOMBRE_MES.map((n, i) => (
              <option key={i + 1} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={anio} className="campo-input w-24" />
        </label>
        <button type="submit" className="boton-secundario">
          Ver período
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
            Registro de Ventas e Ingresos
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            Formato 14.1 — {facturas._count} factura(s), {notasCredito._count} nota(s) de crédito.
            Total: {formatMoneda(totalVentas)}.
          </p>
          <a
            href={`/api/ple/ventas?anio=${anio}&mes=${mes}`}
            className="boton-primario inline-block"
          >
            Descargar .txt
          </a>
        </div>

        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
            Registro de Compras
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            Formato 8.1 — {cuentas._count} documento(s) de compra. Total:{" "}
            {formatMoneda(cuentas._sum.total?.toNumber() ?? 0)}.
          </p>
          <a
            href={`/api/ple/compras?anio=${anio}&mes=${mes}`}
            className="boton-primario inline-block"
          >
            Descargar .txt
          </a>
        </div>
      </div>
    </div>
  );
}
