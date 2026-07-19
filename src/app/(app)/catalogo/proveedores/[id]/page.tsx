import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProveedorFormulario from "../ProveedorFormulario";
import { actualizarProveedor } from "../actions";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/catalogo/proveedores" className="text-sm text-neutral-500 hover:underline">
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar proveedor
      </h1>

      <div className="mt-6">
        <ProveedorFormulario
          accion={actualizarProveedor.bind(null, id)}
          valoresIniciales={{
            razonSocial: proveedor.razonSocial,
            ruc: proveedor.ruc,
            telefono: proveedor.telefono,
            email: proveedor.email,
            direccion: proveedor.direccion,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
    </div>
  );
}
