import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";

export default async function Page() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const acuerdos = await prisma.acuerdoSuministro.findMany({ where: { empresaId: usuario.empresaId }, include: { proveedor: true, _count: { select: { ordenesCompra: true } } }, orderBy: { creadoEn: "desc" } });
  return <div><div className="flex justify-between"><div><h1 className="text-2xl font-semibold">Acuerdos de suministro</h1><p className="text-neutral-500">Contratos marco y liberaciones parciales a órdenes de compra.</p></div><Link href="/logistica/acuerdos-suministro/nuevo" className="boton-primario">Nuevo acuerdo</Link></div><table className="tabla mt-6"><thead><tr><th>Número</th><th>Proveedor</th><th>Título</th><th>Vigencia</th><th>OC</th><th>Estado</th></tr></thead><tbody>{acuerdos.map((acuerdo) => <tr key={acuerdo.id}><td><Link href={`/logistica/acuerdos-suministro/${acuerdo.id}`} className="font-mono hover:underline">{acuerdo.numero}</Link></td><td>{acuerdo.proveedor.razonSocial}</td><td>{acuerdo.titulo}</td><td>{acuerdo.vigenteDesde.toLocaleDateString("es-PE")} – {acuerdo.vigenteHasta.toLocaleDateString("es-PE")}</td><td>{acuerdo._count.ordenesCompra}</td><td>{acuerdo.estado}</td></tr>)}</tbody></table></div>;
}
