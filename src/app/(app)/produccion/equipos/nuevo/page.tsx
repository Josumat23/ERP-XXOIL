import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import EquipoFormulario from "../EquipoFormulario";
import { crearEquipo } from "../actions";

export default async function NuevoEquipoPage() {
  const [almacenes, activosFijos, centrosCosto, equipos] = await Promise.all([
    prisma.almacen.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.activoFijo.findMany({
      where: { activo: true, equipo: null },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.centroCosto.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.equipo.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

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
          textoBoton="Crear equipo"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
