import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatFecha } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { registrarDepreciacionMes } from "./actions";
import DepreciacionFormulario from "./DepreciacionFormulario";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  MAQUINARIA: "Maquinaria",
  VEHICULO: "Vehículo",
  EQUIPO_OFICINA: "Equipo de oficina",
  INMUEBLE: "Inmueble",
  OTRO: "Otro",
};

export default async function ActivosFijosPage() {
  const activos = await prisma.activoFijo.findMany({
    include: { almacen: true },
    orderBy: { creadoEn: "desc" },
  });

  const totalCosto = activos.reduce((acc, a) => acc + a.costoAdquisicion.toNumber(), 0);
  const totalAcumulada = activos.reduce((acc, a) => acc + a.depreciacionAcumulada.toNumber(), 0);
  const ahora = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Activos fijos
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Maquinaria, vehículos y equipos. Depreciación en línea recta.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Dato etiqueta="Activos vigentes" valor={String(activos.filter((a) => a.activo).length)} />
        <Dato etiqueta="Costo de adquisición total" valor={formatMoneda(totalCosto)} />
        <Dato etiqueta="Depreciación acumulada total" valor={formatMoneda(totalAcumulada)} />
      </div>

      <section className="mb-6 border border-black/10 dark:border-white/10 rounded-lg p-4 max-w-md no-imprimir">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          Depreciación del período
        </h2>
        <DepreciacionFormulario
          accion={registrarDepreciacionMes}
          mesActual={ahora.getMonth() + 1}
          anioActual={ahora.getFullYear()}
        />
      </section>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/activos-fijos/nuevo"
        nuevoTexto="Nuevo activo"
        registros={activos.map((a) => ({
          id: a.id,
          href: `/finanzas/activos-fijos/${a.id}`,
          primario: a.nombre,
          secundario: a.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Almacén / planta</th>
            <th>Adquisición</th>
            <th className="text-right">Costo</th>
            <th className="text-right">Deprec. acumulada</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {activos.map((a) => (
            <tr key={a.id}>
              <td className="font-mono text-xs">
                <Link href={`/finanzas/activos-fijos/${a.id}`} className="hover:underline">
                  {a.codigo}
                </Link>
              </td>
              <td>{a.nombre}</td>
              <td>{ETIQUETA_CATEGORIA[a.categoria]}</td>
              <td>{a.almacen?.nombre ?? "—"}</td>
              <td>{formatFecha(a.fechaAdquisicion)}</td>
              <td className="text-right">{formatMoneda(a.costoAdquisicion)}</td>
              <td className="text-right">{formatMoneda(a.depreciacionAcumulada)}</td>
              <td>
                <span
                  className={`insignia ${
                    a.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {a.activo ? "Activo" : "Dado de baja"}
                </span>
              </td>
            </tr>
          ))}
          {activos.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay activos fijos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
