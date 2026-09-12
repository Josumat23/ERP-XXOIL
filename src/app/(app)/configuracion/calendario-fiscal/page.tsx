import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { esAnioOperativoValido } from "@/lib/periodos";
import { generarAnioFiscal, alternarPeriodoFiscal, agregarTareaCierre, completarTareaCierre } from "./actions";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { verificacionesDeCierre } from "@/lib/cierrePeriodo";
import { formatFecha } from "@/lib/format";
import ChecklistCierre from "./ChecklistCierre";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function CalendarioFiscalPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");
  if (!(await puedeRealizar(usuario, "configuracion", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const { anio: anioParam } = await searchParams;
  const hoy = new Date();
  const anioIngresado = anioParam ? Number(anioParam) : hoy.getFullYear();
  const anio = esAnioOperativoValido(anioIngresado) ? anioIngresado : hoy.getFullYear();

  const periodos = await prisma.periodoFiscal.findMany({
    where: { empresaId, anio },
    orderBy: { mes: "asc" },
    include: { tareasCierre: { orderBy: { orden: "asc" } } },
  });

  // Datos del checklist para los doce meses de una sola vez: agrupados por
  // mes, en vez de una consulta por período.
  const inicioAnio = new Date(anio, 0, 1);
  const finAnio = new Date(anio + 1, 0, 1);
  const [incidencias, comprobantes, asientos] = await Promise.all([
    prisma.incidenciaContable.findMany({
      where: { empresaId, resueltoEn: null, fecha: { gte: inicioAnio, lt: finAnio } },
      select: { fecha: true },
    }),
    prisma.comprobanteElectronico.findMany({
      where: {
        empresaId,
        estado: { in: ["PENDIENTE", "ENVIADO", "RECHAZADO", "ERROR"] },
        creadoEn: { gte: inicioAnio, lt: finAnio },
      },
      select: { creadoEn: true },
    }),
    prisma.asientoContable.groupBy({
      by: ["mes"],
      where: { empresaId, anio },
      _count: { _all: true },
    }),
  ]);

  const contarPorMes = (fechas: { getMonth: () => number }[]) => {
    const mapa = new Map<number, number>();
    for (const f of fechas) {
      const mes = f.getMonth() + 1;
      mapa.set(mes, (mapa.get(mes) ?? 0) + 1);
    }
    return mapa;
  };
  const incidenciasPorMes = contarPorMes(incidencias.map((i) => i.fecha));
  const comprobantesPorMes = contarPorMes(comprobantes.map((c) => c.creadoEn));
  const asientosPorMes = new Map(asientos.map((a) => [a.mes, a._count._all]));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Calendario fiscal
      </h1>
      <p className="text-neutral-500 mt-1">
        Equivalente reducido a Fiscal Calendar de Epicor: define qué meses están abiertos o
        cerrados para contabilización. Se usará para bloquear el registro contable en períodos
        cerrados.
      </p>

      <div className="flex items-center gap-3 mt-6 no-imprimir">
        <a href={`/configuracion/calendario-fiscal?anio=${anio - 1}`} className="boton-secundario px-3 py-1.5">
          ← {anio - 1}
        </a>
        <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{anio}</span>
        <a href={`/configuracion/calendario-fiscal?anio=${anio + 1}`} className="boton-secundario px-3 py-1.5">
          {anio + 1} →
        </a>
        {periodos.length === 0 && (
          <form
            action={async () => {
              "use server";
              await generarAnioFiscal(anio);
            }}
          >
            <button type="submit" className="boton-primario">
              Generar los 12 meses de {anio}
            </button>
          </form>
        )}
      </div>

      {periodos.length > 0 && (
        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id}>
                <td>
                  {NOMBRES_MES[p.mes - 1]}
                  <ChecklistCierre
                    mes={NOMBRES_MES[p.mes - 1]}
                    periodoCerrado={p.estado === "CERRADO"}
                    verificaciones={verificacionesDeCierre({
                      incidenciasContablesAbiertas: incidenciasPorMes.get(p.mes) ?? 0,
                      comprobantesSinAceptar: comprobantesPorMes.get(p.mes) ?? 0,
                      asientosDelPeriodo: asientosPorMes.get(p.mes) ?? 0,
                    })}
                    tareas={p.tareasCierre.map((t) => ({
                      id: t.id,
                      orden: t.orden,
                      descripcion: t.descripcion,
                      completadaEn: t.completadaEn ? formatFecha(t.completadaEn) : null,
                      completadaPorNombre: t.completadaPorNombre,
                      nota: t.nota,
                    }))}
                    agregarTarea={agregarTareaCierre.bind(null, p.id)}
                    completarTarea={completarTareaCierre}
                  />
                </td>
                <td>
                  <span
                    className={`insignia ${
                      p.estado === "ABIERTO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {p.estado === "ABIERTO" ? "Abierto" : "Cerrado"}
                  </span>
                  {p.estado === "CERRADO" && p.cerradoPor && (
                    <span className="text-xs text-neutral-400 ml-2">por {p.cerradoPor}</span>
                  )}
                  {/* Cerrar es decisión del contador; si quedaban puntos
                      abiertos, la decisión queda registrada. */}
                  {p.estado === "CERRADO" && (p.pendientesAlCerrar ?? 0) > 0 && (
                    <span className="block text-xs text-amber-700 dark:text-amber-400">
                      Se cerró con {p.pendientesAlCerrar} punto
                      {p.pendientesAlCerrar === 1 ? "" : "s"} del checklist sin resolver
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <form
                    action={async () => {
                      "use server";
                      await alternarPeriodoFiscal(p.id);
                    }}
                  >
                    <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                      {p.estado === "ABIERTO" ? "Cerrar período" : "Reabrir período"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
