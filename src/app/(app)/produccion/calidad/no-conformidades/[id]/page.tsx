import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import CapaFormulario from "./CapaFormulario";

export default async function DetalleNoConformidadPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const { id } = await params;
  const [registro, usuarios] = await Promise.all([
    prisma.noConformidadCalidad.findFirst({ where: { id, empresaId: usuario.empresaId }, include: { controlCalidad: { include: { causa: true, loteGranel: { include: { formula: { include: { producto: true } } } } } }, eventos: { orderBy: { creadoEn: "asc" } } } }),
    prisma.usuario.findMany({ where: { empresaId: usuario.empresaId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!registro) notFound();
  return <div className="max-w-4xl"><div className="flex justify-between no-imprimir"><Link href="/produccion/calidad/no-conformidades" className="text-sm hover:underline">← Volver a no conformidades</Link><BotonImprimir /></div>
    <div className="mt-4 flex justify-between gap-4"><div><h1 className="text-2xl font-semibold">NC-{registro.id.slice(-8).toUpperCase()}</h1><p className="text-neutral-500">Lote <Link className="hover:underline" href={`/produccion/lotes/${registro.controlCalidad.loteGranelId}`}>{registro.controlCalidad.loteGranel.codigo}</Link> · {registro.controlCalidad.loteGranel.formula.producto.nombre}</p></div><span className="insignia h-fit">{registro.estado.replaceAll("_", " ")}</span></div>
    <section className="mt-6 grid md:grid-cols-2 gap-3 text-sm border rounded-lg p-4"><Dato e="Defecto / causa catalogada" v={registro.controlCalidad.causa?.nombre ?? "Sin catálogo"}/><Dato e="Responsable" v={registro.responsableNombre ?? "Sin asignar"}/><Dato e="Contención inmediata" v={registro.contencionInmediata ?? "Pendiente"}/><Dato e="Causa raíz confirmada" v={registro.causaRaizConfirmada ?? "Pendiente"}/><Dato e="Acción correctiva" v={registro.accionCorrectiva ?? "Pendiente"}/><Dato e="Fecha compromiso" v={registro.fechaCompromiso ? new Intl.DateTimeFormat("es-PE").format(registro.fechaCompromiso) : "Pendiente"}/><Dato e="Verificación de eficacia" v={registro.verificacionEficacia ?? "Pendiente"}/><Dato e="Resultado de eficacia" v={registro.eficaz === null ? "Pendiente" : registro.eficaz ? "Eficaz" : "No eficaz"}/></section>
    {registro.estado !== "CERRADA" && <section className="mt-6"><h2 className="font-medium mb-2">Gestionar expediente</h2><CapaFormulario id={registro.id} usuarios={usuarios} estadoActual={registro.estado}/></section>}
    <section className="mt-7"><h2 className="font-medium">Historial inmutable</h2><ol className="mt-3 space-y-3 border-l pl-5">{registro.eventos.map(ev=><li key={ev.id}><strong>{ev.estadoNuevo.replaceAll("_", " ")}</strong><span className="block text-sm">{ev.comentario}</span><span className="block text-xs text-neutral-500">{ev.usuarioNombre} · {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(ev.creadoEn)}</span></li>)}</ol></section>
  </div>;
}
function Dato({e,v}:{e:string;v:string}) { return <p><span className="block text-xs uppercase text-neutral-500">{e}</span><span className="whitespace-pre-wrap">{v}</span></p>; }
