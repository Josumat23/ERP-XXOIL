"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoDocumentoIdentidad, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoEmpleado } from "@/lib/correlativos";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { saldoVacaciones } from "@/lib/vacaciones";
import { generarLiquidacion } from "@/lib/planilla";

export type EstadoFormulario = { error?: string };

const ROLES_RRHH = ["GERENCIA"] as const;

const TIPOS_CONTRATO_VALIDOS: $Enums.TipoContrato[] = [
  "PLAZO_FIJO",
  "PLAZO_INDETERMINADO",
  "LOCACION_SERVICIOS",
];

export async function crearEmpleado(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Recursos Humanos." };
  }

  const nombres = String(formData.get("nombres") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const tipoDocumentoIdentidadRaw = String(formData.get("tipoDocumentoIdentidad") ?? "DNI");
  const tipoDocumentoIdentidad = Object.values(TipoDocumentoIdentidad).find(
    (tipo) => tipo === tipoDocumentoIdentidadRaw
  );
  const dni = String(formData.get("dni") ?? "").trim() || null;
  const nacionalidad = String(formData.get("nacionalidad") ?? "Peruana").trim() || "Peruana";
  const fechaNacimientoRaw = String(formData.get("fechaNacimiento") ?? "").trim();
  const fechaIngresoRaw = String(formData.get("fechaIngreso") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const tipoContrato = String(formData.get("tipoContrato") ?? "") as $Enums.TipoContrato;
  const sueldoBasico = Number(formData.get("sueldoBasico") ?? 0);
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const correo = String(formData.get("correo") ?? "").trim() || null;
  const almacenId = String(formData.get("almacenId") ?? "") || null;
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const numeroCuenta = String(formData.get("numeroCuenta") ?? "").trim() || null;
  const cci = String(formData.get("cci") ?? "").trim() || null;
  const swift = String(formData.get("swift") ?? "").trim() || null;
  const iban = String(formData.get("iban") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const sistemaPensionRaw = String(formData.get("sistemaPension") ?? "");
  const sistemaPension =
    sistemaPensionRaw === "ONP" || sistemaPensionRaw === "AFP" ? sistemaPensionRaw : null;
  const afpRaw = String(formData.get("afp") ?? "");
  const afp =
    sistemaPension === "AFP" && ["INTEGRA", "PRIMA", "HABITAT", "PROFUTURO"].includes(afpRaw)
      ? (afpRaw as $Enums.Afp)
      : null;
  const asignacionFamiliar = formData.get("asignacionFamiliar") === "on";

  if (!nombres || !apellidos) return { error: "Nombres y apellidos son obligatorios." };
  if (!tipoDocumentoIdentidad) {
    return { error: "Seleccione un tipo de documento de identidad válido." };
  }
  if (!cargo) return { error: "El cargo es obligatorio." };
  if (!area) return { error: "El área es obligatoria." };
  if (!TIPOS_CONTRATO_VALIDOS.includes(tipoContrato)) {
    return { error: "Seleccione un tipo de contrato válido." };
  }
  const fechaIngreso = crearFechaCalendarioLocal(fechaIngresoRaw);
  if (!fechaIngreso) {
    return { error: "La fecha de ingreso es obligatoria y debe ser válida." };
  }
  const fechaNacimiento = fechaNacimientoRaw
    ? crearFechaCalendarioLocal(fechaNacimientoRaw)
    : null;
  if (fechaNacimientoRaw && !fechaNacimiento) {
    return { error: "Ingrese una fecha de nacimiento válida." };
  }
  if (!Number.isFinite(sueldoBasico) || sueldoBasico < 0) {
    return { error: "El sueldo básico debe ser un número válido." };
  }
  if (sistemaPensionRaw === "AFP" && !afp) {
    return { error: "Seleccione la AFP del trabajador." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoEmpleado(tx);
      await tx.empleado.create({
        data: {
          codigo,
          nombres,
          apellidos,
          tipoDocumentoIdentidad,
          dni,
          nacionalidad,
          fechaNacimiento,
          fechaIngreso,
          cargo,
          area,
          tipoContrato,
          sueldoBasico,
          telefono,
          correo,
          banco,
          numeroCuenta,
          cci,
          swift,
          iban,
          almacenId,
          centroCostoId,
          notas,
          sistemaPension,
          afp,
          asignacionFamiliar,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un empleado con ese DNI o código." };
    }
    throw e;
  }

  revalidatePath("/rrhh/empleados");
  redirect("/rrhh/empleados");
}

export async function darDeBajaEmpleado(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Recursos Humanos." };
  }

  const motivoCese = String(formData.get("motivoCese") ?? "").trim();
  if (!motivoCese) return { error: "El motivo del cese es obligatorio." };

  const fechaCese = new Date();
  let advertenciaLiquidacion: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const reclamo = await tx.empleado.updateMany({
        where: { id, estado: "ACTIVO" },
        data: { estado: "CESADO", fechaCese, motivoCese },
      });
      if (reclamo.count !== 1) {
        throw new Error("El empleado no existe, ya fue dado de baja o cambió mientras se procesaba el cese.");
      }

      // La aprobación de vacaciones también reclama al empleado activo. Leer
      // después del reclamo garantiza que la liquidación incluya cualquier
      // aprobación que haya terminado antes del cese.
      const empleado = await tx.empleado.findUniqueOrThrow({
        where: { id },
        include: { vacaciones: { where: { estado: "APROBADA" } } },
      });
      if (empleado.tipoContrato !== "LOCACION_SERVICIOS") {
        const diasAprobados = empleado.vacaciones.reduce((acc, v) => acc + v.diasSolicitados, 0);
        const resultado = await generarLiquidacion(tx, {
          empleadoId: id,
          fechaCese,
          diasVacacionesAprobados: diasAprobados,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!resultado.ok) advertenciaLiquidacion = resultado.error;
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  if (advertenciaLiquidacion) {
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${id}`);
    return { error: `Empleado dado de baja, pero la liquidación no se pudo calcular: ${advertenciaLiquidacion}` };
  }

  revalidatePath("/rrhh/empleados");
  revalidatePath(`/rrhh/empleados/${id}`);
  return {};
}

export async function solicitarVacaciones(
  empleadoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;

  const fechaInicioRaw = String(formData.get("fechaInicio") ?? "").trim();
  const fechaFinRaw = String(formData.get("fechaFin") ?? "").trim();
  const fechaInicio = crearFechaCalendarioLocal(fechaInicioRaw);
  const fechaFin = crearFechaCalendarioLocal(fechaFinRaw);

  if (!fechaInicio || !fechaFin) {
    return { error: "Ingrese fecha de inicio y fin válidas." };
  }
  if (fechaFin < fechaInicio) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }
  const diasSolicitados = Math.round((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const empleado = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: { vacaciones: { where: { estado: "APROBADA" } } },
  });
  if (!empleado) return { error: "El empleado no existe." };
  if (empleado.estado !== "ACTIVO") return { error: "No se pueden solicitar vacaciones para un empleado cesado." };

  const diasAprobados = empleado.vacaciones.reduce((acc, v) => acc + v.diasSolicitados, 0);
  const saldo = saldoVacaciones(empleado.fechaIngreso, diasAprobados);
  if (diasSolicitados > saldo + 0.5) {
    return {
      error: `Solo tiene ${saldo.toFixed(1)} días de vacaciones disponibles (solicitó ${diasSolicitados}).`,
    };
  }

  await prisma.solicitudVacaciones.create({
    data: {
      empleadoId,
      fechaInicio,
      fechaFin,
      diasSolicitados,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath(`/rrhh/empleados/${empleadoId}`);
  revalidatePath("/rrhh/vacaciones");
  return {};
}

export async function aprobarVacaciones(
  id: string,
  _prevState: EstadoFormulario,
  _formData: FormData
): Promise<EstadoFormulario> {
  void _prevState;
  void _formData;
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver solicitudes de vacaciones." };
  }

  const pendiente = await prisma.solicitudVacaciones.findUnique({ where: { id }, select: { empleadoId: true } });
  if (!pendiente) return { error: "La solicitud no existe." };

  try {
    await prisma.$transaction(async (tx) => {
      const bloqueo = await tx.empleado.updateMany({
        where: { id: pendiente.empleadoId, estado: "ACTIVO" },
        data: { estado: "ACTIVO" },
      });
      if (bloqueo.count !== 1) throw new Error("No se pueden aprobar vacaciones para un empleado cesado.");

      const solicitud = await tx.solicitudVacaciones.findUnique({
        where: { id },
        include: { empleado: { include: { vacaciones: { where: { estado: "APROBADA" } } } } },
      });
      if (!solicitud || solicitud.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue resuelta.");

      const diasAprobados = solicitud.empleado.vacaciones.reduce((acc, v) => acc + v.diasSolicitados, 0);
      const saldo = saldoVacaciones(solicitud.empleado.fechaIngreso, diasAprobados);
      if (solicitud.diasSolicitados > saldo + 0.5) {
        throw new Error(`El saldo actual es ${saldo.toFixed(1)} d\u00edas y ya no cubre los ${solicitud.diasSolicitados} solicitados.`);
      }

      const reclamo = await tx.solicitudVacaciones.updateMany({
        where: { id, estado: "PENDIENTE" },
        data: { estado: "APROBADA", aprobadaPor: auth.usuario.nombre, aprobadaEn: new Date() },
      });
      if (reclamo.count !== 1) throw new Error("Esta solicitud ya fue resuelta.");
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/rrhh/empleados/${pendiente.empleadoId}`);
  revalidatePath("/rrhh/vacaciones");
  return {};
}

export async function rechazarVacaciones(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver solicitudes de vacaciones." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };

  const solicitud = await prisma.solicitudVacaciones.findUnique({ where: { id } });
  if (!solicitud) return { error: "La solicitud no existe." };
  if (solicitud.estado !== "PENDIENTE") return { error: "Esta solicitud ya fue resuelta." };

  const reclamo = await prisma.solicitudVacaciones.updateMany({
    where: { id, estado: "PENDIENTE" },
    data: {
      estado: "RECHAZADA",
      motivoRechazo: motivo,
      aprobadaPor: auth.usuario.nombre,
      aprobadaEn: new Date(),
    },
  });
  if (reclamo.count !== 1) return { error: "Esta solicitud ya fue resuelta." };

  revalidatePath(`/rrhh/empleados/${solicitud.empleadoId}`);
  revalidatePath("/rrhh/vacaciones");
  return {};
}
