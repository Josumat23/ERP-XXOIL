import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { resumirAsistencia } from "@/lib/indicadoresAsistencia";
import BotonImprimir from "@/components/BotonImprimir";

const fechaInput = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
const duracion = (valor: number) => `${Math.floor(valor / 60)} h ${valor % 60} min`;

export default async function IndicadoresAsistenciaPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const consulta = await searchParams;
  const hoy = new Date();
  const desde = crearFechaCalendarioLocal(consulta.desde ?? "") ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = crearFechaCalendarioLocal(consulta.hasta ?? "") ?? hoy;
  if (hasta < desde) redirect(`/rrhh/asistencia/indicadores?desde=${fechaInput(desde)}&hasta=${fechaInput(desde)}`);
  const fin = new Date(hasta); fin.setDate(fin.getDate() + 1);
  const empresaId = await obtenerEmpresaActivaId();
  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { empresaId, estado: "ACTIVO" }, orderBy: [{ area: "asc" }, { apellidos: "asc" }] }),
    prisma.registroAsistencia.findMany({ where: { empresaId, fecha: { gte: desde, lt: fin } }, select: { empleadoId: true, estado: true, ausenciaJustificada: true, minutosTardanza: true, minutosSobretiempo: true } }),
  ]);
  const mapa = resumirAsistencia(registros);
  const filas = empleados.map((empleado) => ({ empleado, ...(mapa.get(empleado.id) ?? { diasAsistidos: 0, ausenciasJustificadas: 0, minutosTardanza: 0, minutosSobretiempo: 0, pendientes: 0 }) }));
  const totales = filas.reduce((a, f) => ({ dias: a.dias + f.diasAsistidos, ausencias: a.ausencias + f.ausenciasJustificadas, tardanza: a.tardanza + f.minutosTardanza, extra: a.extra + f.minutosSobretiempo, pendientes: a.pendientes + f.pendientes }), { dias: 0, ausencias: 0, tardanza: 0, extra: 0, pendientes: 0 });
  return <div><div className="mb-4 flex items-start justify-between"><div><h1 className="text-2xl font-semibold">Indicadores de asistencia</h1><p className="text-sm text-neutral-500">Registros aprobados por trabajador; los borradores se muestran únicamente como pendientes de control.</p></div><BotonImprimir /></div>
    <form className="no-imprimir mb-5 flex items-end gap-3"><label className="text-sm">Desde<input name="desde" type="date" defaultValue={fechaInput(desde)} className="campo-input mt-1 block" /></label><label className="text-sm">Hasta<input name="hasta" type="date" defaultValue={fechaInput(hasta)} className="campo-input mt-1 block" /></label><button className="boton-secundario">Actualizar</button></form>
    <div className="mb-5 grid gap-3 md:grid-cols-5">{[["Días asistidos", String(totales.dias)], ["Ausencias justificadas", String(totales.ausencias)], ["Tardanza", duracion(totales.tardanza)], ["Sobretiempo", duracion(totales.extra)], ["Pendientes", String(totales.pendientes)]].map(([etiqueta, valor]) => <div key={etiqueta} className="tarjeta p-3"><p className="text-xs text-neutral-500">{etiqueta}</p><p className="text-xl font-semibold">{valor}</p></div>)}</div>
    <table className="tabla"><thead><tr><th>Empleado</th><th>Área</th><th className="text-right">Asistidos</th><th className="text-right">Ausencias just.</th><th className="text-right">Tardanza</th><th className="text-right">Sobretiempo</th><th className="text-right">Pendientes</th></tr></thead><tbody>{filas.map(f => <tr key={f.empleado.id}><td>{f.empleado.codigo} · {f.empleado.apellidos}, {f.empleado.nombres}</td><td>{f.empleado.area}</td><td className="text-right">{f.diasAsistidos}</td><td className="text-right">{f.ausenciasJustificadas}</td><td className="text-right">{duracion(f.minutosTardanza)}</td><td className="text-right">{duracion(f.minutosSobretiempo)}</td><td className="text-right">{f.pendientes}</td></tr>)}</tbody></table>
  </div>;
}
