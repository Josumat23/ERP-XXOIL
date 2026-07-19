import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClienteFormulario from "../ClienteFormulario";
import { actualizarCliente } from "../actions";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cliente, zonas] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!cliente) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/comercial/clientes" className="text-sm text-neutral-500 hover:underline">
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar cliente
      </h1>

      <div className="mt-6">
        <ClienteFormulario
          accion={actualizarCliente.bind(null, id)}
          zonas={zonas}
          valoresIniciales={{
            razonSocial: cliente.razonSocial,
            ruc: cliente.ruc,
            zonaId: cliente.zonaId,
            direccion: cliente.direccion,
            telefono: cliente.telefono,
            email: cliente.email,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
    </div>
  );
}
