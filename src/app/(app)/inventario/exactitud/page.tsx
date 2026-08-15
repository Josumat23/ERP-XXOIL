import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

export default async function ExactitudInventarioPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const conteos = await prisma.conteoInventario.findMany({
    include: { detalles: true },
    orderBy: { fecha: "desc" },
  });

  const filas = conteos.map((c) => {
    const lineas = c.detalles.length;
    const conDiferencia = c.detalles.filter((d) => d.diferencia.toNumber() !== 0).length;
    // Exactitud por línea: 1 - |diferencia| / sistema (si sistema=0 y contada=0,
    // la línea es exacta; si sistema=0 y contada>0, se cuenta como 0% exacta).
    const exactitudes = c.detalles.map((d) => {
      const sistema = d.cantidadSistema.toNumber();
      const diferencia = Math.abs(d.diferencia.toNumber());
      if (sistema === 0) return diferencia === 0 ? 1 : 0;
      return Math.max(0, 1 - diferencia / sistema);
    });
    const exactitudPromedio =
      exactitudes.length > 0 ? exactitudes.reduce((a, b) => a + b, 0) / exactitudes.length : 1;
    return { id: c.id, codigo: c.codigo, fecha: c.fecha, lineas, conDiferencia, exactitudPromedio };
  });

  const totalLineas = filas.reduce((acc, f) => acc + f.lineas, 0);
  const totalConDiferencia = filas.reduce((acc, f) => acc + f.conDiferencia, 0);
  const exactitudGlobal =
    filas.length > 0
      ? filas.reduce((acc, f) => acc + f.exactitudPromedio * f.lineas, 0) / (totalLineas || 1)
      : 1;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Exactitud de inventario
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Qué tan cerca está el stock del sistema de lo contado físicamente en cada conteo cíclico.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 max-w-2xl">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Exactitud global</p>
          <p
            className={`text-xl font-semibold mt-0.5 ${
              exactitudGlobal < 0.95 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"
            }`}
          >
            {formatNumero(exactitudGlobal * 100, 1)}%
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Líneas contadas</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {totalLineas}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Líneas con diferencia</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {totalConDiferencia}
          </p>
        </div>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Conteo</th>
            <th>Fecha</th>
            <th className="text-right">Líneas</th>
            <th className="text-right">Con diferencia</th>
            <th className="text-right">Exactitud</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="font-mono text-xs">{f.codigo}</td>
              <td>{formatFecha(f.fecha)}</td>
              <td className="text-right">{f.lineas}</td>
              <td className="text-right">{f.conDiferencia}</td>
              <td
                className={`text-right font-medium ${
                  f.exactitudPromedio < 0.95 ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {formatNumero(f.exactitudPromedio * 100, 1)}%
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                No hay conteos cíclicos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
