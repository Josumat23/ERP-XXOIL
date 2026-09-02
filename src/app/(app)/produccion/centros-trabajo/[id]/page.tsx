import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { capacidadEfectivaDiaria } from "@/lib/centrosTrabajo";
import { formatNumero } from "@/lib/format";
import CentroTrabajoFormulario from "../CentroTrabajoFormulario";
import { actualizarCentroTrabajo, alternarCentroTrabajo } from "../actions";

export default async function DetalleCentroTrabajoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const { id } = await params;
  const [centro, almacenes, centrosCosto] = await Promise.all([
    prisma.centroTrabajo.findUnique({ where: { id }, include: { almacen: true, centroCosto: true, equipos: { orderBy: { codigo: "asc" } } } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);
  if (!centro) notFound();
  const accion = actualizarCentroTrabajo.bind(null, centro.id);
  return <div className="max-w-4xl"><Link href="/produccion/centros-trabajo" className="text-sm hover:underline">← Volver a centros de trabajo</Link><div className="flex items-center gap-3 mt-1"><h1 className="text-2xl font-semibold">{centro.codigo} — {centro.nombre}</h1><span className={`insignia ${centro.activo ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"}`}>{centro.activo ? "Activo" : "Inactivo"}</span></div>
    <p className="text-sm text-neutral-500 mt-1 mb-6">Capacidad efectiva: {formatNumero(capacidadEfectivaDiaria(centro.capacidadHorasDia.toNumber(), centro.eficienciaPct.toNumber()), 2)} h/día</p>
    <CentroTrabajoFormulario accion={accion} almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: `${a.codigo} — ${a.nombre}` }))} centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))} valores={{ codigo: centro.codigo, nombre: centro.nombre, tipo: centro.tipo, almacenId: centro.almacenId, centroCostoId: centro.centroCostoId, capacidadHorasDia: centro.capacidadHorasDia.toNumber(), eficienciaPct: centro.eficienciaPct.toNumber() }} />
    <form className="mt-4" action={async () => { "use server"; await alternarCentroTrabajo(centro.id, !centro.activo); }}><button className="boton-secundario" type="submit">{centro.activo ? "Desactivar" : "Activar"}</button></form>
    <section className="mt-8"><h2 className="font-medium">Equipos asignados</h2><table className="tabla mt-2"><thead><tr><th>Código</th><th>Equipo</th><th>Estado</th></tr></thead><tbody>{centro.equipos.map((e) => <tr key={e.id}><td><Link href={`/produccion/equipos/${e.id}`} className="font-mono text-xs hover:underline">{e.codigo}</Link></td><td>{e.nombre}</td><td>{e.activo ? "Activo" : "Inactivo"}</td></tr>)}{centro.equipos.length === 0 && <tr><td colSpan={3} className="text-center py-5 text-neutral-500">Sin equipos asignados.</td></tr>}</tbody></table></section>
  </div>;
}
