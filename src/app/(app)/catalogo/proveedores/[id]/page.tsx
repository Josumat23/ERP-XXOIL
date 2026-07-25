import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProveedorFormulario from "../ProveedorFormulario";
import { actualizarProveedor } from "../actions";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proveedor, proveedores] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id } }),
    prisma.proveedor.findMany({ orderBy: { razonSocial: "asc" } }),
  ]);
  if (!proveedor) notFound();

  return (
    <div>
      <Link href="/catalogo/proveedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar proveedor
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
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
        <ProveedorFormulario
          accion={actualizarProveedor.bind(null, id)}
          valoresIniciales={{
            razonSocial: proveedor.razonSocial,
            ruc: proveedor.ruc,
            telefono: proveedor.telefono,
            email: proveedor.email,
            direccion: proveedor.direccion,
            contactoNombre: proveedor.contactoNombre,
            contactoTelefono: proveedor.contactoTelefono,
            cuentaBancaria: proveedor.cuentaBancaria,
            condicionPagoDias: proveedor.condicionPagoDias,
            notas: proveedor.notas,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
