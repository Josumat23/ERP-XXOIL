import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HojaRutaFormulario from "../HojaRutaFormulario";

export default async function NuevaHojaRutaPage() {
  const [vendedores, clientes] = await Promise.all([
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({
      where: { activo: true },
      include: { zona: true },
      orderBy: { razonSocial: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/comercial/hojas-ruta" className="text-sm text-neutral-500 hover:underline">
        ← Volver a hojas de ruta
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nueva hoja de ruta
      </h1>

      <div className="mt-6">
        <HojaRutaFormulario
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: c.zona ? `${c.razonSocial} (${c.zona.nombre})` : c.razonSocial,
          }))}
        />
      </div>
    </div>
  );
}
