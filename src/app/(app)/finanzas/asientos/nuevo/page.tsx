import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import AsientoManualFormulario from "../AsientoManualFormulario";

const ETIQUETA_ORIGEN: Record<string, string> = {
  MANUAL: "Manual",
  VENTA: "Venta",
  COBRO: "Cobro",
  NOTA_CREDITO: "Nota de crédito",
  ANULACION_VENTA: "Anulación de venta",
  COMPRA: "Compra",
  PAGO_PROVEEDOR: "Pago a proveedor",
  REVERSO: "Reverso",
};

export default async function NuevoAsientoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/finanzas/asientos");

  const [cuentas, asientos] = await Promise.all([
    prisma.cuentaContable.findMany({
      where: { activo: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.asientoContable.findMany({ orderBy: { numero: "desc" }, take: 100 }),
  ]);

  return (
    <div>
      <Link href="/finanzas/asientos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a asientos
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Asiento manual
      </h1>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        El asiento debe cuadrar (total debe = total haber) y su período fiscal debe estar abierto.
      </p>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/asientos/nuevo"
        nuevoTexto="Asiento manual"
        registros={asientos.map((a) => ({
          id: a.id,
          href: `/finanzas/asientos/${a.id}`,
          primario: a.numero,
          secundario: ETIQUETA_ORIGEN[a.origen],
        }))}
      >
      <div className="max-w-3xl">
        <AsientoManualFormulario
          cuentas={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
