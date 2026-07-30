import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { ETIQUETA_TAREA, type ClaveTarea } from "@/lib/tareasProgramadas";
import { ejecutarTareaAhora } from "./actions";

const CLAVES = Object.keys(ETIQUETA_TAREA) as ClaveTarea[];

function formatearFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(fecha);
}

export default async function TareasProgramadasPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const [ultimasPorClave, historial] = await Promise.all([
    Promise.all(
      CLAVES.map((clave) =>
        prisma.tareaProgramada.findFirst({ where: { clave }, orderBy: { ejecutadoEn: "desc" } })
      )
    ),
    prisma.tareaProgramada.findMany({ orderBy: { ejecutadoEn: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Tareas programadas
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a System Agent: estos trabajos corren solos dentro del servidor (cada
        hora) sin que nadie los dispare — depreciación mensual, recargo por mora en facturas
        vencidas y actualización del tipo de cambio. Cada uno revisa primero si ya hizo lo que
        tenía que hacer, así que &quot;Ejecutar ahora&quot; nunca duplica nada.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {CLAVES.map((clave, i) => {
          const ultima = ultimasPorClave[i];
          return (
            <div key={clave} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {ETIQUETA_TAREA[clave]}
              </p>
              {ultima ? (
                <>
                  <p className="text-xs text-neutral-500 mt-1">
                    Última vez: {formatearFechaHora(ultima.ejecutadoEn)}
                  </p>
                  <span
                    className={`insignia mt-2 inline-block ${
                      ultima.exitoso
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {ultima.exitoso ? "OK" : "Con error"}
                  </span>
                  <p className="text-xs text-neutral-500 mt-2">{ultima.resumen}</p>
                </>
              ) : (
                <p className="text-xs text-neutral-500 mt-1">Todavía no se ha ejecutado.</p>
              )}
              <form
                action={async () => {
                  "use server";
                  await ejecutarTareaAhora(clave);
                }}
                className="mt-3"
              >
                <button type="submit" className="boton-secundario text-xs">
                  Ejecutar ahora
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Historial de ejecuciones
      </h2>
      <table className="tabla">
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Fecha y hora</th>
            <th>Resultado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((h) => (
            <tr key={h.id}>
              <td>{ETIQUETA_TAREA[h.clave]}</td>
              <td className="text-sm text-neutral-500 whitespace-nowrap">
                {formatearFechaHora(h.ejecutadoEn)}
              </td>
              <td>
                <span
                  className={`insignia ${
                    h.exitoso
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {h.exitoso ? "OK" : "Con error"}
                </span>
              </td>
              <td className="text-sm text-neutral-500">{h.resumen}</td>
            </tr>
          ))}
          {historial.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-neutral-500 py-6">
                Todavía no hay ejecuciones registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
