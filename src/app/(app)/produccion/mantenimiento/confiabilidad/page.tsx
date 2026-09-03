import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

export default async function ConfiabilidadPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const equipos = await prisma.equipo.findMany({ where: { empresaId: usuario.empresaId }, include: { lecturasContador: { orderBy: { creadoEn: "asc" } }, ordenesMantenimiento: { where: { tipo: "CORRECTIVO", estado: "COMPLETADA" }, orderBy: { fechaFin: "desc" } } }, orderBy: { codigo: "asc" } });
  const ordenes = equipos.flatMap(e => e.ordenesMantenimiento.map(o => ({ ...o, equipo: e })));
  const totalHoras = ordenes.reduce((s, o) => s + (o.tiempoParadaHoras?.toNumber() ?? 0), 0);
  return <div className="max-w-6xl"><div className="flex justify-between"><div><h1 className="text-2xl font-semibold">Confiabilidad de equipos</h1><p className="text-neutral-500">Recurrencia, tiempo entre fallas, MTTR, parada y costo correctivo.</p></div><div className="flex gap-2"><Link href="/produccion/mantenimiento" className="boton-secundario">Órdenes</Link><BotonImprimir/></div></div>
    <div className="grid sm:grid-cols-3 gap-3 mt-6"><K e="Fallas cerradas" v={String(ordenes.length)}/><K e="Horas de parada" v={formatNumero(totalHoras,2)}/><K e="MTTR global" v={`${formatNumero(ordenes.length ? totalHoras/ordenes.length : 0,2)} h`}/></div>
    <table className="tabla mt-6"><thead><tr><th>Equipo</th><th className="text-right">Fallas</th><th className="text-right">Parada</th><th className="text-right">MTTR</th><th className="text-right">Intervalo medio entre fallas</th><th className="text-right">Costo</th></tr></thead><tbody>{equipos.map(e => { const fallas=e.ordenesMantenimiento; const horas=fallas.reduce((s,o)=>s+(o.tiempoParadaHoras?.toNumber()??0),0); const costo=fallas.reduce((s,o)=>s+o.costoManoObra.toNumber()+o.costoRepuestos.toNumber(),0); const primera=e.lecturasContador[0]; const ultima=e.lecturasContador.at(-1); const fallasEnVentana=primera?fallas.filter(o=>o.fechaFin&&o.fechaFin>=primera.creadoEn).length:0; const intervalo=primera&&ultima&&fallasEnVentana>0?(ultima.valor.toNumber()-primera.valor.toNumber())/fallasEnVentana:null; return <tr key={e.id}><td>{e.codigo} — {e.nombre}</td><td className="text-right">{fallas.length}</td><td className="text-right">{formatNumero(horas,2)} h</td><td className="text-right">{fallas.length?`${formatNumero(horas/fallas.length,2)} h`:"—"}</td><td className="text-right">{intervalo===null?"Sin base suficiente":`${formatNumero(intervalo,2)} ${e.unidadContador??"unidades"}`}</td><td className="text-right">{formatMoneda(costo)}</td></tr>})}</tbody></table>
    <p className="mt-2 text-xs text-neutral-500">El intervalo medio usa el incremento entre la primera y última lectura inmutable dividido entre fallas cerradas dentro de esa ventana. Solo equivale a MTBF en equipos cuyo contador está expresado en horas.</p>
    <section className="mt-8"><h2 className="font-medium">Causas recientes</h2><table className="tabla mt-2"><thead><tr><th>Orden</th><th>Equipo</th><th>Causa</th><th>Modo de falla</th><th>Parada</th></tr></thead><tbody>{ordenes.slice(0,30).map(o=><tr key={o.id}><td><Link href={`/produccion/mantenimiento/${o.id}`} className="hover:underline">{o.codigo}</Link></td><td>{o.equipo.nombre}</td><td>{o.causaFalla?.replaceAll("_"," ")??"Sin clasificar"}</td><td>{o.modoFalla??"Histórico"}</td><td>{o.tiempoParadaHoras?.toString()??"0"} h</td></tr>)}</tbody></table></section>
  </div>;
}
function K({e,v}:{e:string;v:string}) { return <div className="border rounded-lg p-4"><p className="text-xs text-neutral-500">{e}</p><p className="text-2xl font-semibold">{v}</p></div>; }
