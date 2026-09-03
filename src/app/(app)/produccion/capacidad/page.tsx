import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import { cargaPlanOperacion } from "@/lib/planificacionCapacidad";
import { nivelarCapacidad } from "./actions";

export default async function CapacidadPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const centros = await prisma.centroTrabajo.findMany({
    where: { activo: true },
    include: { almacen: true, operacionesLote: { where: { loteGranel: { estado: { in: ["PLANIFICADO", "EN_PROCESO"] } }, estado: { not: "COMPLETADA" } }, include: { loteGranel: { include: { formula: { include: { producto: true } } } } }, orderBy: [{ fechaPlanInicio: "asc" }, { loteGranel: { fechaInicio: "asc" } }] } },
    orderBy: { codigo: "asc" },
  });
  return <div className="max-w-7xl">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Planificación de capacidad</h1><p className="text-sm text-neutral-500 mt-1">Carga finita por centro, calendario de planta y secuencia de operación.</p></div><form action={nivelarCapacidad}><button className="boton-primario">Nivelar órdenes abiertas</button></form></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6">{centros.map((centro) => {
      const capacidad = centro.capacidadHorasDia.toNumber() * centro.eficienciaPct.toNumber() / 100;
      const carga = centro.operacionesLote.reduce((total, operacion) => total + cargaPlanOperacion(operacion.preparacionPlanHoras.toNumber(), operacion.maquinaPlanHoras.toNumber(), operacion.manoObraPlanHoras.toNumber()), 0);
      return <section key={centro.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4"><div className="flex justify-between gap-3"><div><h2 className="font-semibold"><Link className="hover:underline" href={`/produccion/centros-trabajo/${centro.id}`}>{centro.codigo} — {centro.nombre}</Link></h2><p className="text-xs text-neutral-500">{centro.almacen.nombre} · {formatNumero(capacidad, 2)} h/día efectivas</p></div><div className="text-right"><strong>{formatNumero(carga, 2)} h</strong><p className="text-xs text-neutral-500">carga abierta</p></div></div>
      <table className="tabla mt-3"><thead><tr><th>Orden / operación</th><th>Plan</th><th className="text-right">Carga</th></tr></thead><tbody>{centro.operacionesLote.map((operacion) => <tr key={operacion.id}><td><Link className="hover:underline font-mono text-xs" href={`/produccion/lotes/${operacion.loteGranelId}`}>{operacion.loteGranel.codigo}</Link><span className="block text-xs">{operacion.secuencia}. {operacion.nombre} · {operacion.loteGranel.formula.producto.nombre}</span></td><td className="text-xs">{operacion.fechaPlanInicio ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(operacion.fechaPlanInicio) : "Sin nivelar"}{operacion.fechaPlanFin ? ` – ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(operacion.fechaPlanFin)}` : ""}</td><td className="text-right">{formatNumero(cargaPlanOperacion(operacion.preparacionPlanHoras.toNumber(), operacion.maquinaPlanHoras.toNumber(), operacion.manoObraPlanHoras.toNumber()), 2)} h</td></tr>)}{centro.operacionesLote.length === 0 && <tr><td colSpan={3} className="text-center text-neutral-500 py-5">Sin carga abierta.</td></tr>}</tbody></table></section>;
    })}</div>
  </div>;
}
