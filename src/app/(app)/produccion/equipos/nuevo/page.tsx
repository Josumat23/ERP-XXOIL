import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { etiquetaRutaUbicacion, ordenarArbolUbicaciones } from "@/lib/ubicacionesTecnicas";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import EquipoFormulario from "../EquipoFormulario";
import { crearEquipo } from "../actions";

export default async function NuevoEquipoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const [almacenes, activosFijos, centrosCosto, centrosTrabajo, ubicaciones, equipos] = await Promise.all([
    prisma.almacen.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.activoFijo.findMany({
      where: { empresaId: usuario.empresaId, activo: true, equipo: null },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.centroCosto.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.centroTrabajo.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, codigo: true, nombre: true, almacenId: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.ubicacionTecnica.findMany({
      where: { empresaId: usuario.empresaId, activo: true },
      select: { id: true, parentId: true, codigo: true, nombre: true },
    }),
    prisma.equipo.findMany({ where: { empresaId: usuario.empresaId }, orderBy: { creadoEn: "desc" } }),
  ]);

  const ubicacionesTecnicas = ordenarArbolUbicaciones(ubicaciones).map(({ ubicacion }) => ({
    id: ubicacion.id,
    etiqueta: `${etiquetaRutaUbicacion(ubicacion.id, ubicaciones)} — ${ubicacion.nombre}`,
  }));

  return (
    <div>
      <Link
        href="/produccion/equipos"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a equipos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo equipo
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/produccion/equipos/nuevo"
        nuevoTexto="Nuevo equipo"
        registros={equipos.map((e) => ({
          id: e.id,
          href: `/produccion/equipos/${e.id}`,
          primario: e.nombre,
          secundario: e.codigo,
        }))}
      >
      <div className="max-w-lg">
        <EquipoFormulario
          accion={crearEquipo}
          almacenes={almacenes}
          activosFijos={activosFijos}
          centrosCosto={centrosCosto}
          centrosTrabajo={centrosTrabajo}
          ubicacionesTecnicas={ubicacionesTecnicas}
          textoBoton="Crear equipo"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
