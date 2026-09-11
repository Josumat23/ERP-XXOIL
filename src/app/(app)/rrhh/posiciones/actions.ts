"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  obtenerEmpresaActivaId,
  perteneceAEmpresaActiva,
  requerirRolEmpresaActiva as requerirRol,
} from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import {
  creariaCicloPosicion,
  esPeriodoAsignacionValido,
  haySolapamientoDeOcupacion,
} from "@/lib/posicionesOrganizativas";

export type EstadoFormulario = { error?: string };

export async function crearPosicion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en RR. HH." };
  }

  const empresaId = auth.usuario.empresaId;
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const reportaAId = String(formData.get("reportaAId") ?? "").trim() || null;
  const centroCostoId = String(formData.get("centroCostoId") ?? "").trim() || null;

  if (!codigo || !titulo || !area) return { error: "Código, título y área son obligatorios." };

  // Posición superior y centro de costo llegan del formulario: se releen
  // acotados a la compañía activa.
  if (reportaAId) {
    const superior = await prisma.posicionOrganizativa.findFirst({
      where: { id: reportaAId, empresaId },
      select: { id: true },
    });
    if (!superior) return { error: "La posición superior no pertenece a la compañía activa." };
  }
  if (centroCostoId) {
    const centro = await prisma.centroCosto.findFirst({
      where: { id: centroCostoId, empresaId, activo: true },
      select: { id: true },
    });
    if (!centro) return { error: "El centro de costo no pertenece a la compañía activa." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const posicion = await tx.posicionOrganizativa.create({
        data: {
          empresaId,
          codigo,
          titulo,
          area,
          reportaAId,
          centroCostoId,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "PosicionOrganizativa",
        registroId: posicion.id,
        accion: "CREAR",
        despues: posicion,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la posición "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/rrhh/posiciones");
  return {};
}

export async function reasignarSuperiorPosicion(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en RR. HH." };
  }

  const empresaId = auth.usuario.empresaId;
  const reportaAId = String(formData.get("reportaAId") ?? "").trim() || null;

  const posiciones = await prisma.posicionOrganizativa.findMany({
    where: { empresaId },
    select: { id: true, reportaAId: true },
  });
  if (!posiciones.some((p) => p.id === id)) {
    return { error: "La posición no pertenece a la compañía activa." };
  }
  if (reportaAId && !posiciones.some((p) => p.id === reportaAId)) {
    return { error: "La posición superior no pertenece a la compañía activa." };
  }
  if (creariaCicloPosicion(id, reportaAId, posiciones)) {
    return { error: "Esa posición superior cerraría un ciclo en la jerarquía." };
  }

  await prisma.$transaction(async (tx) => {
    const antes = await tx.posicionOrganizativa.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.posicionOrganizativa.update({ where: { id }, data: { reportaAId } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "PosicionOrganizativa",
      registroId: id,
      accion: "ACTUALIZAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/rrhh/posiciones");
  return {};
}

export async function asignarEmpleadoAPosicion(
  posicionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en RR. HH." };
  }

  const empresaId = auth.usuario.empresaId;
  const empleadoId = String(formData.get("empleadoId") ?? "").trim();
  const vigenteDesde = crearFechaCalendarioLocal(String(formData.get("vigenteDesde") ?? "").trim());
  const hastaTexto = String(formData.get("vigenteHasta") ?? "").trim();
  const vigenteHasta = hastaTexto ? crearFechaCalendarioLocal(hastaTexto) : null;
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!empleadoId) return { error: "Seleccione al empleado." };
  if (!vigenteDesde) return { error: "Indique una fecha de inicio válida." };
  if (hastaTexto && !vigenteHasta) return { error: "La fecha de término no es válida." };
  if (!esPeriodoAsignacionValido(vigenteDesde, vigenteHasta)) {
    return { error: "La fecha de término debe ser posterior a la de inicio." };
  }

  const [posicion, empleado] = await Promise.all([
    prisma.posicionOrganizativa.findFirst({
      where: { id: posicionId, empresaId, activa: true },
      select: { id: true },
    }),
    prisma.empleado.findFirst({ where: { id: empleadoId, empresaId }, select: { id: true } }),
  ]);
  if (!posicion) return { error: "La posición no pertenece a la compañía activa o está inactiva." };
  if (!empleado) return { error: "El empleado no pertenece a la compañía activa." };

  const existentes = await prisma.asignacionPosicion.findMany({
    where: { empresaId, posicionId, empleadoId },
    select: { id: true, posicionId: true, empleadoId: true, vigenteDesde: true, vigenteHasta: true },
  });
  if (
    haySolapamientoDeOcupacion({ posicionId, empleadoId, vigenteDesde, vigenteHasta }, existentes)
  ) {
    return { error: "Esa persona ya ocupa esta posición en un período que se solapa." };
  }

  await prisma.$transaction(async (tx) => {
    const asignacion = await tx.asignacionPosicion.create({
      data: {
        empresaId,
        posicionId,
        empleadoId,
        vigenteDesde,
        vigenteHasta,
        motivo,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "AsignacionPosicion",
      registroId: asignacion.id,
      accion: "CREAR",
      despues: asignacion,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/rrhh/posiciones");
  return {};
}

export async function cerrarAsignacionPosicion(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en RR. HH." };
  }

  const empresaId = auth.usuario.empresaId;
  const vigenteHasta = crearFechaCalendarioLocal(String(formData.get("vigenteHasta") ?? "").trim());
  if (!vigenteHasta) return { error: "Indique una fecha de término válida." };

  const antes = await prisma.asignacionPosicion.findFirst({ where: { id, empresaId } });
  if (!antes) return { error: "La asignación no pertenece a la compañía activa." };
  if (antes.vigenteHasta) return { error: "Esa asignación ya está cerrada." };
  if (!esPeriodoAsignacionValido(antes.vigenteDesde, vigenteHasta)) {
    return { error: "La fecha de término debe ser posterior a la de inicio." };
  }

  await prisma.$transaction(async (tx) => {
    const despues = await tx.asignacionPosicion.update({ where: { id }, data: { vigenteHasta } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "AsignacionPosicion",
      registroId: id,
      accion: "ACTUALIZAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/rrhh/posiciones");
  return {};
}

export async function alternarActivaPosicion(id: string, activa: boolean) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "editar"))) return;

  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.posicionOrganizativa.findUnique({ where: { id } });
    if (!perteneceAEmpresaActiva(antes, empresaId)) return;
    const despues = await tx.posicionOrganizativa.update({ where: { id }, data: { activa } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "PosicionOrganizativa",
      registroId: id,
      accion: activa ? "ACTIVAR" : "DESACTIVAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/rrhh/posiciones");
}
