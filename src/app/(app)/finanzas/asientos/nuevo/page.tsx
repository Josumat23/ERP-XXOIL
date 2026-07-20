import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import AsientoManualFormulario from "../AsientoManualFormulario";

export default async function NuevoAsientoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/finanzas/asientos");

  const cuentas = await prisma.cuentaContable.findMany({
    where: { activo: true },
    orderBy: { codigo: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <Link href="/finanzas/asientos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a asientos
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Asiento manual
      </h1>
      <p className="text-neutral-500 mt-1">
        El asiento debe cuadrar (total debe = total haber) y su período fiscal debe estar abierto.
      </p>

      <div className="mt-6">
        <AsientoManualFormulario
          cuentas={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
        />
      </div>
    </div>
  );
}
