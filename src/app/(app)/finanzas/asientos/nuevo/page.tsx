import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { ETIQUETA_ORIGEN_ASIENTO } from "@/lib/etiquetas";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import AsientoManualFormulario from "../AsientoManualFormulario";

export default async function NuevoAsientoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/finanzas/asientos");
  if (!(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const [cuentas, asientos] = await Promise.all([
    prisma.cuentaContable.findMany({
      where: { activo: true, planCuentas: { empresaId } },
      orderBy: { codigo: "asc" },
    }),
    prisma.asientoContable.findMany({
      where: { empresaId },
      orderBy: { numero: "desc" },
      take: 100,
    }),
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
          secundario: ETIQUETA_ORIGEN_ASIENTO[a.origen],
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
