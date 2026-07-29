import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CentroCostoFormulario from "../CentroCostoFormulario";
import { crearCentroCosto } from "../actions";

export default async function NuevoCentroCostoPage() {
  const [almacenes, centros] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.centroCosto.findMany({ orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div>
      <Link
        href="/finanzas/centros-costo"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a centros de costo
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo centro de costo
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/centros-costo/nuevo"
        nuevoTexto="Nuevo centro de costo"
        registros={centros.map((c) => ({
          id: c.id,
          href: `/finanzas/centros-costo/${c.id}`,
          primario: c.nombre,
          secundario: c.codigo,
        }))}
      >
      <div className="max-w-lg">
        <CentroCostoFormulario accion={crearCentroCosto} almacenes={almacenes} />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
