import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ETIQUETA_ESTADO_HR } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import CerrarRutaFormulario from "./CerrarRutaFormulario";

export default async function DetalleHojaRutaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const hoja = await prisma.hojaRuta.findUnique({
    where: { id },
    include: {
      vendedor: { include: { zona: true } },
      visitas: { include: { cliente: true }, orderBy: { orden: "asc" } },
    },
  });
  if (!hoja) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/comercial/hojas-ruta" className="text-sm text-neutral-500 hover:underline">
          ← Volver a hojas de ruta
        </Link>
        <BotonImprimir />
      </div>

      <div className="documento border border-black/10 dark:border-white/10 rounded-lg p-6 mt-4">
        <MembreteEmpresa soloImprimir tituloDocumento="HOJA DE RUTA" numero={hoja.numero} />
        <div className="flex items-start justify-between border-b border-black/10 dark:border-white/10 pb-4">
          <div>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Hoja de ruta {hoja.numero}
            </p>
            <p className="text-sm text-neutral-500">
              {hoja.vendedor.nombre}
              {hoja.vendedor.zona ? ` · Zona ${hoja.vendedor.zona.nombre}` : ""} ·{" "}
              {new Intl.DateTimeFormat("es-PE", { dateStyle: "full" }).format(hoja.fecha)}
            </p>
          </div>
          <span
            className={`insignia no-imprimir ${
              hoja.estado === "COMPLETADA"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
            }`}
          >
            {ETIQUETA_ESTADO_HR[hoja.estado]}
          </span>
        </div>

        <table className="tabla mt-4">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Cliente</th>
              <th>Dirección</th>
              <th>Objetivo</th>
              <th>{hoja.estado === "COMPLETADA" ? "Resultado" : "Resultado (llenar en campo)"}</th>
            </tr>
          </thead>
          <tbody>
            {hoja.visitas.map((v) => (
              <tr key={v.id}>
                <td>{v.orden}</td>
                <td className="font-medium">{v.cliente.razonSocial}</td>
                <td className="text-sm text-neutral-500">{v.cliente.direccion ?? "—"}</td>
                <td className="text-sm">{v.objetivo ?? "—"}</td>
                <td className="text-sm">{v.resultado ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {hoja.notas && <p className="text-sm text-neutral-500 mt-4">Notas: {hoja.notas}</p>}
        <p className="text-xs text-neutral-400 mt-6">
          Planificada por {hoja.usuarioNombre} el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(hoja.creadoEn)}
        </p>
      </div>

      {hoja.estado === "PLANIFICADA" && (
        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Cerrar ruta y registrar resultados
          </h2>
          <CerrarRutaFormulario
            hojaId={hoja.id}
            visitas={hoja.visitas.map((v) => ({
              id: v.id,
              orden: v.orden,
              cliente: v.cliente.razonSocial,
              objetivo: v.objetivo,
            }))}
          />
        </section>
      )}
    </div>
  );
}
