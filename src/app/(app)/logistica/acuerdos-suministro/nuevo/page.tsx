import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import AcuerdoFormulario from "../AcuerdoFormulario";

export default async function Page() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const [proveedores, insumos] = await Promise.all([
    prisma.proveedor.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.insumo.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { codigo: "asc" } }),
  ]);
  return <div className="max-w-5xl"><h1 className="text-2xl font-semibold mb-5">Nuevo acuerdo de suministro</h1><AcuerdoFormulario proveedores={proveedores.map((proveedor) => ({ id: proveedor.id, etiqueta: proveedor.razonSocial }))} insumos={insumos.map((insumo) => ({ id: insumo.id, etiqueta: `${insumo.codigo} — ${insumo.nombre}` }))}/></div>;
}
