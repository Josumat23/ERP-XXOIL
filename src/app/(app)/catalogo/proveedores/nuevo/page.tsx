import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import ProveedorFormulario from "../ProveedorFormulario";
import { crearProveedor } from "../actions";

export default async function NuevoProveedorPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const empresaId = await obtenerEmpresaActivaId();
  const proveedores = await prisma.proveedor.findMany({
    where: { empresaId },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div>
      <Link href="/catalogo/proveedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
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
