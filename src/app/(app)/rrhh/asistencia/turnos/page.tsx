import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import TurnoFormulario from "./TurnoFormulario";
import { asignarTurno } from "../actions";
const formatoHora = (minuto: number) => `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
export default async function TurnosPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");
  if (!(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();
  const [turnos, empleados] = await Promise.all([prisma.turnoTrabajo.findMany({ where: { empresaId }, include: { _count: { select: { empleados: true } } }, orderBy: { codigo: "asc" } }), prisma.empleado.findMany({ where: { empresaId, estado: "ACTIVO" }, include: { turnoTrabajo: true }, orderBy: { apellidos: "asc" } })]);
  return <div><div className="mb-4"><Link href="/rrhh/asistencia" className="text-sm hover:underline">← Asistencia</Link><h1 className="text-2xl font-semibold">Turnos de trabajo</h1><p className="text-sm text-neutral-500">Calendario base para jornadas diurnas o nocturnas, refrigerio y tolerancia.</p></div><TurnoFormulario /><div className="mb-6 grid gap-3 md:grid-cols-3">{turnos.map(t => <div key={t.id} className="tarjeta p-4"><strong>{t.codigo} · {t.nombre}</strong><p className="text-sm text-neutral-500">{formatoHora(t.inicioMinuto)}–{formatoHora(t.finMinuto)} · refrigerio {t.refrigerioMinuto} min · tolerancia {t.toleranciaMinuto} min</p><p className="text-sm">{t._count.empleados} empleado(s)</p></div>)}</div><h2 className="mb-2 font-semibold">Asignación de personal</h2><table className="tabla"><thead><tr><th>Empleado</th><th>Turno actual</th><th>Asignar</th></tr></thead><tbody>{empleados.map(e => <tr key={e.id}><td>{e.codigo} · {e.apellidos}, {e.nombres}</td><td>{e.turnoTrabajo?.codigo ?? "Sin turno"}</td><td><form action={asignarTurno} className="flex gap-2"><input type="hidden" name="empleadoId" value={e.id} /><select required name="turnoTrabajoId" className="campo-input"><option value="">Seleccione…</option>{turnos.filter(t => t.activo).map(t => <option key={t.id} value={t.id}>{t.codigo}</option>)}</select><button className="boton-secundario">Asignar</button></form></td></tr>)}</tbody></table></div>;
}
