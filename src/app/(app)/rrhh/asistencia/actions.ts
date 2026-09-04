"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { calcularJornada, minutosHora } from "@/lib/asistencia";

export type EstadoFormulario = { error?: string; exito?: string };
const ROLES_RRHH = ["GERENCIA"] as const;

async function autorizar(accion: "crear" | "editar" | "aprobar") {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", accion))) return { error: `No tiene permiso para ${accion} asistencia.` };
  return auth;
}

export async function registrarAsistencia(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const auth = await autorizar("crear");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const empleadoId = String(formData.get("empleadoId") ?? "");
  const fecha = crearFechaCalendarioLocal(String(formData.get("fecha") ?? ""));
  const ausenciaJustificada = formData.get("ausenciaJustificada") === "on";
  const entradaTexto = String(formData.get("entrada") ?? "");
  const salidaTexto = String(formData.get("salida") ?? "");
  const observacion = String(formData.get("observacion") ?? "").trim();
  const entradaMinuto = minutosHora(entradaTexto);
  const salidaMinuto = minutosHora(salidaTexto);
  if (!fecha) return { error: "Fecha inválida." };
  if (ausenciaJustificada && !observacion) return { error: "Indique el sustento de la ausencia justificada." };
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, empresaId, estado: "ACTIVO" }, include: { turnoTrabajo: true } });
  if (!empleado) return { error: "Empleado activo no encontrado en la compañía." };
  if (!empleado.turnoTrabajo?.activo) return { error: "Asigne un turno activo al empleado antes de registrar asistencia." };

  let entrada: Date | null = null;
  let salida: Date | null = null;
  let calculo = { minutosTrabajados: 0, minutosTardanza: 0, minutosSobretiempo: 0 };
  if (!ausenciaJustificada) {
    if (entradaMinuto === null || salidaMinuto === null) return { error: "Indique horas válidas de entrada y salida." };
    entrada = new Date(fecha); entrada.setMinutes(entradaMinuto);
    salida = new Date(fecha); salida.setMinutes(salidaMinuto);
    if (salidaMinuto <= entradaMinuto) salida.setDate(salida.getDate() + 1);
    const resultado = calcularJornada(entrada, salida, empleado.turnoTrabajo);
    if (!resultado) return { error: "La salida debe ser posterior a la entrada." };
    calculo = resultado;
  }

  const existente = await prisma.registroAsistencia.findUnique({ where: { empleadoId_fecha: { empleadoId, fecha } }, select: { estado: true } });
  if (existente?.estado === "APROBADO") return { error: "El registro aprobado es inmutable." };
  await prisma.registroAsistencia.upsert({
    where: { empleadoId_fecha: { empleadoId, fecha } },
    create: { empresaId, empleadoId, fecha, entrada, salida, ausenciaJustificada, observacion: observacion || null, ...calculo, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
    update: { entrada, salida, ausenciaJustificada, observacion: observacion || null, ...calculo, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
  });
  revalidatePath("/rrhh/asistencia");
  return { exito: "Asistencia guardada en borrador." };
}

export async function aprobarAsistencia(registroId: string): Promise<void> {
  const auth = await autorizar("aprobar");
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.registroAsistencia.updateMany({ where: { id: registroId, empresaId, estado: "BORRADOR" }, data: { estado: "APROBADO", aprobadoEn: new Date(), aprobadoPorId: auth.usuario.id, aprobadoPorNombre: auth.usuario.nombre } });
  revalidatePath("/rrhh/asistencia");
}

export async function crearTurno(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const auth = await autorizar("crear");
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const inicioMinuto = minutosHora(String(formData.get("inicio") ?? ""));
  const finMinuto = minutosHora(String(formData.get("fin") ?? ""));
  const refrigerioMinuto = Number(formData.get("refrigerioMinuto"));
  const toleranciaMinuto = Number(formData.get("toleranciaMinuto"));
  if (!codigo || !nombre || inicioMinuto === null || finMinuto === null || inicioMinuto === finMinuto) return { error: "Complete código, nombre y un horario válido." };
  if (!Number.isInteger(refrigerioMinuto) || refrigerioMinuto < 0 || refrigerioMinuto > 240 || !Number.isInteger(toleranciaMinuto) || toleranciaMinuto < 0 || toleranciaMinuto > 120) return { error: "Refrigerio o tolerancia fuera de rango." };
  try { await prisma.turnoTrabajo.create({ data: { empresaId, codigo, nombre, inicioMinuto, finMinuto, refrigerioMinuto, toleranciaMinuto } }); }
  catch { return { error: "Ya existe un turno con ese código o los datos no son válidos." }; }
  revalidatePath("/rrhh/asistencia/turnos");
  return { exito: "Turno creado." };
}

export async function asignarTurno(formData: FormData): Promise<void> {
  const auth = await autorizar("editar");
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  const empleadoId = String(formData.get("empleadoId") ?? "");
  const turnoTrabajoId = String(formData.get("turnoTrabajoId") ?? "");
  const turno = await prisma.turnoTrabajo.findFirst({ where: { id: turnoTrabajoId, empresaId, activo: true }, select: { id: true } });
  if (!turno) return;
  await prisma.empleado.updateMany({ where: { id: empleadoId, empresaId, estado: "ACTIVO" }, data: { turnoTrabajoId: turno.id } });
  revalidatePath("/rrhh/asistencia/turnos"); revalidatePath("/rrhh/asistencia");
}
