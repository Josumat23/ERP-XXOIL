import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ActivoFijoFormulario from "../ActivoFijoFormulario";
import { crearActivoFijo } from "../actions";
import { costoRealProyecto } from "@/lib/proyectos";

export default async function NuevoActivoFijoPage({
  searchParams,
}: {
  searchParams: Promise<{ proyectoId?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const { proyectoId } = await searchParams;

  const [almacenes, centrosCosto, activos, proyecto] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.activoFijo.findMany({ orderBy: { creadoEn: "desc" } }),
    proyectoId ? prisma.proyecto.findUnique({ where: { id: proyectoId } }) : null,
  ]);

  const proyectoOrigen = proyecto
    ? {
        id: proyecto.id,
        etiqueta: `${proyecto.codigo} — ${proyecto.nombre}`,
        nombreSugerido: proyecto.nombre,
        costoSugerido: await costoRealProyecto(prisma, proyecto.id),
      }
    : null;

  return (
    <div>
      <Link
        href="/finanzas/activos-fijos"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a activos fijos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo activo fijo
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/activos-fijos/nuevo"
        nuevoTexto="Nuevo activo"
        registros={activos.map((a) => ({
          id: a.id,
          href: `/finanzas/activos-fijos/${a.id}`,
          primario: a.nombre,
          secundario: a.codigo,
        }))}
      >
      <div className="max-w-lg">
        <ActivoFijoFormulario
          accion={crearActivoFijo}
          almacenes={almacenes}
          centrosCosto={centrosCosto}
          textoBoton="Crear activo"
          proyectoOrigen={proyectoOrigen}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
