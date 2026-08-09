import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { generarAnioFiscal, alternarPeriodoFiscal } from "./actions";

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

  const { anio: anioParam } = await searchParams;
  const hoy = new Date();
  const anio = anioParam ? Number(anioParam) : hoy.getFullYear();

  const periodos = await prisma.periodoFiscal.findMany({
    where: { anio },
    orderBy: { mes: "asc" },
  });

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
                <td>{NOMBRES_MES[p.mes - 1]}</td>
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
