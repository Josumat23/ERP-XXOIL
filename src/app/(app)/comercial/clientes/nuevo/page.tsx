import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ClienteFormulario from "../ClienteFormulario";
import { crearCliente } from "../actions";

export default async function NuevoClientePage() {
  const [zonas, vendedores] = await Promise.all([
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/comercial/clientes" className="text-sm text-neutral-500 hover:underline">
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo cliente
      </h1>

      <div className="mt-6">
        <ClienteFormulario
          accion={crearCliente}
          zonas={zonas}
          vendedores={vendedores}
          textoBoton="Crear cliente"
        />
      </div>
    </div>
  );
}
