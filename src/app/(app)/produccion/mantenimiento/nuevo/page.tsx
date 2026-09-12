import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import OrdenMantenimientoFormulario from "../OrdenMantenimientoFormulario";
import { crearOrdenMantenimiento } from "../actions";

export default async function NuevaOrdenMantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ equipoId?: string; avisoId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { equipoId, avisoId } = await searchParams;

  const [equipos, centrosCosto, ordenes] = await Promise.all([
    // select explícito: el formulario es un componente cliente y una fila
    // completa le mandaría `contadorActual` como Decimal de Prisma, que React no
    // sabe serializar — avisa en consola y no es un valor que el formulario use.
    prisma.equipo.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, codigo: true, nombre: true, centroCostoId: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.centroCosto.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { codigo: "asc" } }),
    prisma.ordenMantenimiento.findMany({
      where: { equipo: { empresaId: usuario.empresaId } },
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
          avisoId={avisoId}
          textoBoton="Crear orden"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
