import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import RfqFormulario from "../RfqFormulario";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
export default async function NuevoRfqPage() { const usuario = await obtenerUsuario(); if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/"); const empresaId = await obtenerEmpresaActivaId(); const insumos = await prisma.insumo.findMany({ where: { empresaId, activo: true }, orderBy: { codigo: "asc" } }); return <div><Link href="/logistica/rfq" className="text-sm hover:underline">← RFQ</Link><h1 className="text-2xl font-semibold my-4">Nueva solicitud de cotización</h1><RfqFormulario insumos={insumos.map((i) => ({ id: i.id, etiqueta: `${i.codigo} — ${i.nombre} (${i.unidadMedida})` }))} /></div>; }
