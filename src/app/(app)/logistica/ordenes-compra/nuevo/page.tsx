import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import OrdenCompraFormulario from "../OrdenCompraFormulario";
import { obtenerTipoCambioVigente } from "@/lib/tipoCambio";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export default async function NuevaOrdenCompraPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const [proveedores, insumos, almacenes, ordenes, tipoCambioSugerido, proyectos, edts] = await Promise.all([
    prisma.proveedor.findMany({ where: { empresaId, activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.insumo.findMany({ where: { empresaId, activo: true }, orderBy: { codigo: "asc" } }),
    prisma.almacen.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.ordenCompra.findMany({ where: { empresaId }, include: { proveedor: true }, orderBy: { fecha: "desc" } }),
    obtenerTipoCambioVigente(),
    prisma.proyecto.findMany({
      where: { empresaId, estado: { in: ["PLANIFICADO", "EN_PROGRESO"] } },
      orderBy: { codigo: "asc" },
    }),
    prisma.edtProyecto.findMany({ where: { proyecto: { empresaId } }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div>
      <Link href="/logistica/ordenes-compra" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a órdenes de compra
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nueva orden de compra
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/logistica/ordenes-compra/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/logistica/ordenes-compra/${o.id}`,
          primario: o.numero,
          secundario: o.proveedor.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <OrdenCompraFormulario
          proveedores={proveedores.map((p) => ({ id: p.id, etiqueta: p.razonSocial }))}
          insumos={insumos.map((i) => ({
            id: i.id,
            etiqueta: `${i.codigo} — ${i.nombre} (${i.unidadMedida})`,
            costo: i.costoUnitario.toNumber(),
            unidad: i.unidadMedida,
          }))}
          almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
          tipoCambioSugerido={tipoCambioSugerido}
          proyectos={proyectos.map((p) => ({ id: p.id, etiqueta: `${p.codigo} — ${p.nombre}` }))}
          edts={edts.map((e) => ({ id: e.id, proyectoId: e.proyectoId, etiqueta: `${e.codigo} — ${e.nombre}` }))}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
