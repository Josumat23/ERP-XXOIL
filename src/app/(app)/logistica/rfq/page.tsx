import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
export default async function RfqPage() {
  const usuario = await obtenerUsuario(); if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const registros = await prisma.rfqCompra.findMany({ where: { empresaId: usuario.empresaId }, include: { _count: { select: { ofertas: true } }, ordenCompra: true }, orderBy: { creadoEn: "desc" } });
  return <div><div className="flex justify-between items-start"><div><h1 className="text-2xl font-semibold">RFQ y comparación de ofertas</h1><p className="text-sm text-neutral-500">Solicitudes de cotización con adjudicación trazable.</p></div><Link href="/logistica/rfq/nuevo" className="boton-primario">Nuevo RFQ</Link></div><table className="tabla mt-6"><thead><tr><th>Número</th><th>Título</th><th>Ofertas</th><th>Estado</th><th>Orden</th></tr></thead><tbody>{registros.map((r) => <tr key={r.id}><td><Link className="font-mono hover:underline" href={`/logistica/rfq/${r.id}`}>{r.numero}</Link></td><td>{r.titulo}</td><td>{r._count.ofertas}</td><td>{r.estado}</td><td>{r.ordenCompra ? <Link className="hover:underline" href={`/logistica/ordenes-compra/${r.ordenCompra.id}`}>{r.ordenCompra.numero}</Link> : "—"}</td></tr>)}{!registros.length && <tr><td colSpan={5} className="text-center py-8 text-neutral-500">No hay RFQ registrados.</td></tr>}</tbody></table></div>;
}
