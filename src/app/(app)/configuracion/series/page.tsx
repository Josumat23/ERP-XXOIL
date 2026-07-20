import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatearNumeroSerie } from "@/lib/series";
import SerieFormulario from "./SerieFormulario";
import { alternarActivoSerie } from "./actions";

const ETIQUETA_TIPO: Record<string, string> = {
  FACTURA: "Factura",
  NOTA_CREDITO: "Nota de crédito",
  GUIA_REMISION: "Guía de remisión",
};

export default async function SeriesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const series = await prisma.serieDocumento.findMany({
    orderBy: [{ tipoDocumento: "asc" }, { serie: "asc" }],
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Series de documentos
      </h1>
      <p className="text-neutral-500 mt-1">
        Numeración legal (equivalente a Legal Number Maintenance de Epicor). Al facturar, crear una
        guía o una nota de crédito, se puede elegir una de estas series para sugerir el siguiente
        número — el número real lo asigna SUNAT al emitir el documento externamente.
      </p>

      <div className="mt-6">
        <SerieFormulario />
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Serie</th>
            <th>Siguiente número sugerido</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.id}>
              <td>{ETIQUETA_TIPO[s.tipoDocumento]}</td>
              <td className="font-mono text-xs">{s.serie}</td>
              <td className="font-mono text-xs">
                {formatearNumeroSerie(s.serie, s.correlativoActual + 1)}
              </td>
              <td>
                <span
                  className={`insignia ${
                    s.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {s.activo ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-right">
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoSerie(s.id, !s.activo);
                  }}
                >
                  <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    {s.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {series.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                No hay series registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
