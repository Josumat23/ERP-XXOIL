import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";

export default async function CertificadoAnalisisPage({ params }: { params: Promise<{ loteId: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const { loteId } = await params;
  const lote = await prisma.loteGranel.findFirst({
    where: { id: loteId, formula: { empresaId: usuario.empresaId } },
    include: {
      formula: { include: { producto: true } },
      controlCalidad: { include: { planInspeccion: true, resultadosCaracteristica: { orderBy: { secuencia: "asc" } } } },
    },
  });
  if (!lote?.controlCalidad || lote.controlCalidad.resultado !== "APROBADO" || lote.controlCalidad.resultadosCaracteristica.length === 0) notFound();
  const control = lote.controlCalidad;
  return <div className="max-w-3xl">
    <div className="flex items-center justify-between no-imprimir"><Link href={`/produccion/lotes/${lote.id}`} className="text-sm hover:underline">← Volver al lote</Link><BotonImprimir etiqueta="Imprimir certificado / PDF" /></div>
    <article className="documento border border-black/10 dark:border-white/10 rounded-lg p-7 mt-4">
      <MembreteEmpresa tituloDocumento="CERTIFICADO DE ANÁLISIS" numero={`Lote ${lote.codigo}`} />
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Dato etiqueta="Producto" valor={`${lote.formula.producto.codigo} — ${lote.formula.producto.nombre}`} />
        <Dato etiqueta="Lote de fabricación" valor={lote.codigo} />
        <Dato etiqueta="Cantidad fabricada" valor={`${formatNumero(lote.kgProducidos, 2)} kg`} />
        <Dato etiqueta="Fecha de fabricación" valor={new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(lote.fechaFin ?? lote.fechaInicio)} />
        <Dato etiqueta="Plan de inspección" valor={control.planInspeccion ? `${control.planInspeccion.nombre} v${control.planVersion}` : "Evaluación heredada"} />
        <Dato etiqueta="Decisión de uso" valor="APROBADO PARA USO / ENVASADO" />
      </div>
      <table className="tabla mt-7"><thead><tr><th>#</th><th>Característica</th><th>Método</th><th>Especificación</th><th>Resultado</th><th>Conformidad</th></tr></thead><tbody>
        {control.resultadosCaracteristica.map(r => <tr key={r.id}><td>{r.secuencia}</td><td>{r.nombre}</td><td>{r.metodoEnsayo ?? "—"}</td><td>{r.limiteInferior?.toString() ?? "−∞"} a {r.limiteSuperior?.toString() ?? "+∞"} {r.unidadMedida}</td><td className="font-medium">{r.valorMedido.toString()} {r.unidadMedida}</td><td className="text-green-700 font-medium">Conforme</td></tr>)}
      </tbody></table>
      {control.observaciones && <div className="mt-5 text-sm"><strong>Observaciones:</strong> {control.observaciones}</div>}
      <div className="mt-12 grid grid-cols-2 gap-12 text-sm"><div className="border-t border-neutral-500 pt-2"><strong>{control.usuarioNombre}</strong><span className="block text-neutral-500">Responsable de liberación de calidad</span></div><div className="border-t border-neutral-500 pt-2"><strong>Fecha de liberación</strong><span className="block text-neutral-500">{new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(control.fecha)}</span></div></div>
      <p className="mt-8 text-xs text-neutral-500">Documento generado desde el registro inmutable de control de calidad. La validez corresponde al lote indicado y a la versión del plan aplicada al momento de su liberación.</p>
    </article>
  </div>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) { return <div><span className="block text-xs text-neutral-500 uppercase tracking-wide">{etiqueta}</span><span className="font-medium">{valor}</span></div>; }
