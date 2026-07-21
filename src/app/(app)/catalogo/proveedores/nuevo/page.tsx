import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProveedorFormulario from "../ProveedorFormulario";
import { crearProveedor } from "../actions";

export default async function NuevoProveedorPage() {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { razonSocial: "asc" } });

  return (
    <div>
      <Link href="/catalogo/proveedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proveedores
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo proveedor
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/catalogo/proveedores/nuevo"
        nuevoTexto="Nuevo proveedor"
        registros={proveedores.map((p) => ({
          id: p.id,
          href: `/catalogo/proveedores/${p.id}`,
          primario: p.razonSocial,
          secundario: p.ruc ?? undefined,
        }))}
      >
      <div className="max-w-lg">
        <ProveedorFormulario accion={crearProveedor} textoBoton="Crear proveedor" />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
