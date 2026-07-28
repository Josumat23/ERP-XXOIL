import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ActivoFijoFormulario from "../ActivoFijoFormulario";
import { crearActivoFijo } from "../actions";

export default async function NuevoActivoFijoPage() {
  const [almacenes, activos] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.activoFijo.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

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
        <ActivoFijoFormulario accion={crearActivoFijo} almacenes={almacenes} textoBoton="Crear activo" />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
