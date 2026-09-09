import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ZonaFormulario from "../ZonaFormulario";
import { actualizarZona } from "../actions";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export default async function EditarZonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();

  const [zona, zonas] = await Promise.all([
    prisma.zona.findFirst({ where: { id, empresaId } }),
    prisma.zona.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } }),
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
