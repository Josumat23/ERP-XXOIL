import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import AsistenciaFormulario from "./AsistenciaFormulario";
import { aprobarAsistencia } from "./actions";

const hora = (fecha: Date | null) => fecha ? fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—";
const minutos = (valor: number) => `${Math.floor(valor / 60)} h ${valor % 60} min`;

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const solicitada = crearFechaCalendarioLocal((await searchParams).fecha ?? "");
  const fecha = solicitada ?? new Date(); fecha.setHours(0, 0, 0, 0);
  const fin = new Date(fecha); fin.setDate(fin.getDate() + 1);
  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { empresaId, estado: "ACTIVO" }, include: { turnoTrabajo: true }, orderBy: [{ apellidos: "asc" }, { nombres: "asc" }] }),
    prisma.registroAsistencia.findMany({ where: { empresaId, fecha: { gte: fecha, lt: fin } }, include: { empleado: { include: { turnoTrabajo: true } } }, orderBy: { empleado: { apellidos: "asc" } } }),
  ]);
  return <div>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Control de asistencia</h1><p className="text-sm text-neutral-500">Marcaciones, tardanzas y sobretiempo calculados contra el turno. La aprobación cierra el registro.</p></div><Link href="/rrhh/asistencia/turnos" className="boton-secundario">Gestionar turnos</Link></div>
    <form className="mb-4 flex items-end gap-2"><label className="text-sm">Día<input name="fecha" type="date" defaultValue={fecha.toLocaleDateString("en-CA")} className="campo-input mt-1 block" /></label><button className="boton-secundario">Consultar</button></form>
    <AsistenciaFormulario empleados={empleados.map(e => ({ id: e.id, etiqueta: `${e.codigo} · ${e.apellidos}, ${e.nombres}${e.turnoTrabajo ? ` · ${e.turnoTrabajo.codigo}` : " · sin turno"}` }))} />
    <table className="tabla"><thead><tr><th>Empleado</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Trabajado</th><th>Tardanza</th><th>Sobretiempo</th><th>Estado</th><th></th></tr></thead><tbody>{registros.map(r => <tr key={r.id}><td>{r.empleado.codigo} · {r.empleado.apellidos}, {r.empleado.nombres}</td><td>{r.empleado.turnoTrabajo?.codigo ?? "—"}</td><td>{r.ausenciaJustificada ? "Ausencia justificada" : hora(r.entrada)}</td><td>{hora(r.salida)}</td><td>{minutos(r.minutosTrabajados)}</td><td>{minutos(r.minutosTardanza)}</td><td>{minutos(r.minutosSobretiempo)}</td><td><span className="insignia">{r.estado === "APROBADO" ? "Aprobado" : "Borrador"}</span></td><td>{r.estado === "BORRADOR" && <form action={aprobarAsistencia.bind(null, r.id)}><button className="boton-secundario">Aprobar</button></form>}</td></tr>)}{registros.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-neutral-500">No hay registros para el día.</td></tr>}</tbody></table>
  </div>;
}
