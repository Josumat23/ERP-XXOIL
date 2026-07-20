import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VendedorFormulario from "../VendedorFormulario";
import { actualizarVendedor } from "../actions";

export default async function EditarVendedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [vendedor, zonas] = await Promise.all([
    prisma.vendedor.findUnique({ where: { id } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!vendedor) notFound();

  return (
    <div className="max-w-lg">
      <Link href="/comercial/vendedores" className="text-sm text-neutral-500 hover:underline">
        ← Volver a vendedores
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Editar vendedor
      </h1>
      <p className="text-neutral-500 mt-1 text-sm">
        La tasa nueva solo aplica a facturas futuras; las comisiones ya generadas conservan su tasa.
      </p>

      <div className="mt-6">
        <VendedorFormulario
          accion={actualizarVendedor.bind(null, id)}
          zonas={zonas}
          valoresIniciales={{
            nombre: vendedor.nombre,
            documento: vendedor.documento,
            telefono: vendedor.telefono,
            email: vendedor.email,
            tipo: vendedor.tipo,
            tasaComision: vendedor.tasaComision.toNumber(),
            zonaId: vendedor.zonaId,
          }}
          textoBoton="Guardar cambios"
        />
      </div>
    </div>
  );
}
