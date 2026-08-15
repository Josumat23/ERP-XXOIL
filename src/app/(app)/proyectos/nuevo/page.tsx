import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProyectoFormulario from "../ProyectoFormulario";

export default async function NuevoProyectoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "proyectos", "ver"))) redirect("/");

  const [centrosCosto, empleados, proyectos] = await Promise.all([
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.empleado.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombres: "asc" } }),
    prisma.proyecto.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link href="/proyectos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proyectos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo proyecto
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/proyectos/nuevo"
        nuevoTexto="Nuevo proyecto"
        registros={proyectos.map((p) => ({
          id: p.id,
          href: `/proyectos/${p.id}`,
          primario: p.codigo,
          secundario: p.nombre,
        }))}
      >
        <div className="max-w-lg">
          <ProyectoFormulario
            centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
            empleados={empleados.map((e) => ({ id: e.id, etiqueta: `${e.nombres} ${e.apellidos}` }))}
          />
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
