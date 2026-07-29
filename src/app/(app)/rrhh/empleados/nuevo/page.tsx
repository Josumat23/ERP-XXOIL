import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import EmpleadoFormulario from "../EmpleadoFormulario";

export default async function NuevoEmpleadoPage() {
  const [almacenes, centrosCosto, empleados] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.empleado.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link
        href="/rrhh/empleados"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a empleados
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo empleado
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/rrhh/empleados/nuevo"
        nuevoTexto="Nuevo empleado"
        registros={empleados.map((e) => ({
          id: e.id,
          href: `/rrhh/empleados/${e.id}`,
          primario: `${e.nombres} ${e.apellidos}`,
          secundario: e.codigo,
        }))}
      >
      <EmpleadoFormulario
        almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
        centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
      />
      </PanelMaestroDetalle>
    </div>
  );
}
