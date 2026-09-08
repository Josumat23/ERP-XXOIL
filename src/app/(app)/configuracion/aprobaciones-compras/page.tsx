import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import NivelFormulario from "./NivelFormulario";
import { desactivarNivelCompra } from "./actions";
export default async function AprobacionesComprasPage() { const usuario = await obtenerUsuario(); if (!usuario || usuario.rol !== "ADMIN" || !(await puedeRealizar(usuario, "configuracion", "ver"))) redirect("/"); const niveles = await prisma.nivelAprobacionCompra.findMany({ where: { empresaId: usuario.empresaId, activo: true }, orderBy: { orden: "asc" } }); return <div className="max-w-4xl"><h1 className="text-2xl font-semibold">Aprobaciones de compras</h1><p className="text-neutral-500 mt-1 mb-6">Cada orden recorre, en secuencia, todos los niveles cuyo umbral haya alcanzado.</p><NivelFormulario/><table className="tabla mt-6"><thead><tr><th>Orden</th><th>Nivel</th><th>Desde</th><th>Rol</th><th></th></tr></thead><tbody>{niveles.map((n) => <tr key={n.id}><td>{n.orden}</td><td>{n.nombre}</td><td>PEN {n.montoDesdePen.toNumber().toFixed(2)}</td><td>{n.rolAprobador}</td><td><form action={desactivarNivelCompra.bind(null,n.id)}><button className="text-red-600 hover:underline">Desactivar</button></form></td></tr>)}</tbody></table></div>; }
