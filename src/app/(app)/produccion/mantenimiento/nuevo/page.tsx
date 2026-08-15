import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import OrdenMantenimientoFormulario from "../OrdenMantenimientoFormulario";
import { crearOrdenMantenimiento } from "../actions";

export default async function NuevaOrdenMantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ equipoId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { equipoId } = await searchParams;

  const [equipos, centrosCosto, ordenes] = await Promise.all([
    prisma.equipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.ordenMantenimiento.findMany({
      include: { equipo: true },
      orderBy: { fechaProgramada: "desc" },
    }),
  ]);

  return (
    <div>
      <Link
        href="/produccion/mantenimiento"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a mantenimiento
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva orden de mantenimiento
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/produccion/mantenimiento/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/produccion/mantenimiento/${o.id}`,
          primario: o.equipo.nombre,
          secundario: o.codigo,
        }))}
      >
      <div className="max-w-lg">
        <OrdenMantenimientoFormulario
          accion={crearOrdenMantenimiento}
          equipos={equipos}
          centrosCosto={centrosCosto}
          equipoIdInicial={equipoId}
          textoBoton="Crear orden"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
