import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import OrdenInternaFormulario from "../OrdenInternaFormulario";

export default async function NuevaOrdenInternaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const [centrosCosto, ordenes] = await Promise.all([
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.ordenInterna.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);

  return (
    <div>
      <Link
        href="/finanzas/ordenes-internas"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a órdenes internas
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva orden interna
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/ordenes-internas/nueva"
        nuevoTexto="Nueva orden interna"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/finanzas/ordenes-internas/${o.id}`,
          primario: o.codigo,
          secundario: o.descripcion,
        }))}
      >
        <div className="max-w-xl">
          <OrdenInternaFormulario
            centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
          />
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
