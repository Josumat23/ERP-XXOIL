import Link from "next/link";
import { prisma } from "@/lib/prisma";
import VendedorFormulario from "../VendedorFormulario";
import { crearVendedor } from "../actions";

export default async function NuevoVendedorPage() {
  const zonas = await prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return (
    <div className="max-w-lg">
      <Link href="/comercial/vendedores" className="text-sm text-neutral-500 hover:underline">
        ← Volver a vendedores
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo vendedor
      </h1>

      <div className="mt-6">
        <VendedorFormulario accion={crearVendedor} zonas={zonas} textoBoton="Crear vendedor" />
      </div>
    </div>
  );
}
