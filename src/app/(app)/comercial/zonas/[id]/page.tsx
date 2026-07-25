import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ZonaFormulario from "../ZonaFormulario";
import { actualizarZona } from "../actions";

export default async function EditarZonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [zona, zonas] = await Promise.all([
    prisma.zona.findUnique({ where: { id } }),
    prisma.zona.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  if (!zona) notFound();

  return (
    <div>
      <Link href="/comercial/zonas" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a zonas
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar zona
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={zonas.map((z) => ({
          id: z.id,
          href: `/comercial/zonas/${z.id}`,
          primario: z.nombre,
        }))}
      >
      <div className="max-w-lg">
        <ZonaFormulario
          accion={actualizarZona.bind(null, id)}
          valoresIniciales={{ nombre: zona.nombre }}
          textoBoton="Guardar cambios"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
