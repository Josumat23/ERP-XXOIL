import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import PlanFormulario from "./PlanFormulario";

export default async function PlanesCalidadPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const [productos, planes] = await Promise.all([
    prisma.producto.findMany({ where: { empresaId: usuario.empresaId, activo: true }, select: { id: true, codigo: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.planInspeccionCalidad.findMany({ where: { empresaId: usuario.empresaId }, include: { producto: true, caracteristicas: { orderBy: { secuencia: "asc" } }, _count: { select: { controles: true } } }, orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }] }),
  ]);
  return <div className="max-w-6xl"><div className="flex items-start justify-between"><div><h1 className="text-2xl font-semibold">Planes de inspección</h1><p className="text-neutral-500 mt-1">Especificaciones versionadas para liberar lotes de producción.</p></div><Link href="/produccion/calidad" className="boton-secundario">Volver a calidad</Link></div>
    <section className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-5"><h2 className="font-medium mb-4">Publicar nueva versión</h2><PlanFormulario productos={productos} /></section>
    <section className="mt-8"><h2 className="font-medium mb-3">Historial de planes</h2><div className="space-y-3">{planes.map(p => <article key={p.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4"><div className="flex flex-wrap justify-between gap-2"><div><span className="font-mono text-xs">{p.producto.codigo}</span><h3 className="font-medium">{p.producto.nombre} — {p.nombre} v{p.version}</h3></div><div className="text-right"><span className={`insignia ${p.activo ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>{p.activo ? "Vigente" : "Histórico"}</span><p className="text-xs text-neutral-500 mt-1">{p._count.controles} inspecciones</p></div></div><div className="mt-3 flex flex-wrap gap-2">{p.caracteristicas.map(c => <span key={c.id} className="text-xs border rounded px-2 py-1">{c.secuencia}. {c.nombre}: {c.limiteInferior?.toString() ?? "−∞"}–{c.limiteSuperior?.toString() ?? "+∞"} {c.unidadMedida}</span>)}</div></article>)}{planes.length === 0 && <p className="text-neutral-500">Aún no existen planes publicados.</p>}</div></section>
  </div>;
}
