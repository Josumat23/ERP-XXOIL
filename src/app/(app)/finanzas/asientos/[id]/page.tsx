import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { obtenerUsuario } from "@/lib/auth";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import ReversarFormulario from "./ReversarFormulario";

export default async function DetalleAsientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuario();

  const asiento = await prisma.asientoContable.findUnique({
    where: { id },
    include: { detalles: { include: { cuenta: true } }, libro: true },
  });
  if (!asiento) notFound();

  const totalDebe = asiento.detalles.reduce((acc, d) => acc + d.debe.toNumber(), 0);
  const totalHaber = asiento.detalles.reduce((acc, d) => acc + d.haber.toNumber(), 0);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/finanzas/asientos" className="text-sm text-neutral-500 hover:underline">
          ← Volver a asientos
        </Link>
        <BotonImprimir />
      </div>

      <MembreteEmpresa soloImprimir tituloDocumento="ASIENTO CONTABLE" numero={asiento.numero} />

      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
          {asiento.numero}
        </h1>
        {asiento.reversadoPor && (
          <span className="insignia bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
            Reversado por {asiento.reversadoPor}
          </span>
        )}
        {asiento.reversaA && (
          <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
            Reversa a {asiento.reversaA}
          </span>
        )}
      </div>
      <p className="text-neutral-500 mt-1">
        {asiento.glosa} · {asiento.libro.nombre} · Período {asiento.mes}/{asiento.anio} ·{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(asiento.fecha)} ·
        Registrado por {asiento.usuarioNombre}
      </p>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Glosa</th>
            <th className="text-right">Debe</th>
            <th className="text-right">Haber</th>
          </tr>
        </thead>
        <tbody>
          {asiento.detalles.map((d) => (
            <tr key={d.id}>
              <td>
                <span className="font-mono text-xs">{d.cuenta.codigo}</span> {d.cuenta.nombre}
              </td>
              <td className="text-sm text-neutral-500">{d.glosa ?? "—"}</td>
              <td className="text-right">
                {d.debe.toNumber() > 0 ? formatMoneda(d.debe) : ""}
              </td>
              <td className="text-right">
                {d.haber.toNumber() > 0 ? formatMoneda(d.haber) : ""}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="text-right font-semibold">
              Totales
            </td>
            <td className="text-right font-semibold">{formatMoneda(totalDebe)}</td>
            <td className="text-right font-semibold">{formatMoneda(totalHaber)}</td>
          </tr>
        </tbody>
      </table>

      {usuario?.rol === "ADMIN" && !asiento.reversadoPor && asiento.origen !== "REVERSO" && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-red-700 dark:text-red-400 mb-3">
            Reversar este asiento
          </h2>
          <ReversarFormulario asientoId={asiento.id} />
        </section>
      )}
    </div>
  );
}
