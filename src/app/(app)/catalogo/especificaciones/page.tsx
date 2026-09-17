import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { etiquetaEspecificacion } from "@/lib/especificaciones";
import EspecificacionFormulario from "./EspecificacionFormulario";
import { alternarActivoEspecificacion } from "./actions";

export default async function EspecificacionesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const especificaciones = await prisma.especificacionTecnica.findMany({
    where: { empresaId },
    include: { _count: { select: { productos: true } } },
    orderBy: [{ organismo: "asc" }, { codigo: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Especificaciones técnicas
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-1" style={{ color: "var(--epicor-texto-tenue)" }}>
        Las normas del rubro que la empresa maneja: API, ACEA, JASO, SAE, ISO, NLGI y las
        aprobaciones de fabricantes de equipo. Cada producto declara después cuáles cumple.
      </p>
      {/*
        El catálogo nace vacío a propósito. Qué códigos existen y cuáles siguen
        vigentes es conocimiento del rubro que cambia —API CK-4 reemplazó a
        CJ-4—, y sembrarlo sería decidir por la empresa qué declara cumplir.
      */}
      <p className="text-sm mb-5" style={{ color: "var(--epicor-texto-tenue)" }}>
        El catálogo lo carga la empresa: el sistema no supone qué especificaciones están vigentes
        hoy ni cuáles maneja XXOIL.
      </p>

      <div className="max-w-4xl">
        <EspecificacionFormulario />

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Especificación</th>
              <th>Organismo</th>
              <th>Descripción</th>
              <th>Productos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {especificaciones.map((e) => (
              <tr key={e.id}>
                <td className="font-medium">{etiquetaEspecificacion(e)}</td>
                <td>{e.organismo}</td>
                <td style={{ color: "var(--epicor-texto-tenue)" }}>{e.descripcion ?? "—"}</td>
                <td>{e._count.productos}</td>
                <td>
                  <span className={e.activo ? "" : "text-neutral-500"}>
                    {e.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td>
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoEspecificacion(e.id, !e.activo);
                    }}
                  >
                    <button type="submit" className="text-sm hover:underline">
                      {e.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {especificaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6" style={{ color: "var(--epicor-texto-tenue)" }}>
                  Todavía no hay especificaciones cargadas. Agregue las que la empresa declara
                  manejar y después decláre­las en cada{" "}
                  <Link href="/catalogo/productos" className="hover:underline">
                    producto
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
