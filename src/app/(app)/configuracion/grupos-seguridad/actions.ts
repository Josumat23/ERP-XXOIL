"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  obtenerEmpresaActivaId,
  perteneceAEmpresaActiva,
  requerirRolEmpresaActiva as requerirRol,
} from "@/lib/empresas";
import { MODULOS } from "./modulos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { evaluarConflictosSoD } from "@/lib/segregacionFunciones";

export type EstadoFormulario = { error?: string };

export async function crearGrupoSeguridad(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };

  try {
    await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoSeguridad.create({
        data: { empresaId: auth.usuario.empresaId, codigo, nombre, permisos: { create: MODULOS.map((m) => ({ modulo: m.clave, puedeVer: true })) } },
        include: { permisos: true },
      });
      await registrarAuditoriaMaestro(tx, { empresaId: grupo.empresaId, entidad: "GrupoSeguridad", registroId: grupo.id, accion: "CREAR", despues: grupo, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe el grupo "${codigo}".` };
    }
    throw e;
  }

  revalidatePath("/configuracion/grupos-seguridad");
  return {};
}

export async function actualizarPermiso(
  permisoId: string,
  campo: "puedeVer" | "puedeCrear" | "puedeEditar" | "puedeAprobar",
  valor: boolean
): Promise<
  | { ok: true }
  | { ok: false; codigo: string; mensaje: string }
> {
  const auth = await requerirRol([]);
  if ("error" in auth) {
    return { ok: false, codigo: "AUTH-RECHAZADA", mensaje: auth.error };
  }

  const camposPermitidos = new Set(["puedeVer", "puedeCrear", "puedeEditar", "puedeAprobar"]);
  if (!camposPermitidos.has(campo) || typeof valor !== "boolean") {
    return { ok: false, codigo: "PERMISO-ENTRADA-INVALIDA", mensaje: "El cambio solicitado no es válido." };
  }

  // El permisoId llega del navegador: se resuelve el grupo dueño y se
  // comprueba que sea de la compañía activa antes de tocar nada.
  const empresaId = await obtenerEmpresaActivaId();
  const resultado = await prisma.$transaction(async (tx) => {
    const permiso = await tx.permisoGrupo.findFirst({
      where: { id: permisoId, grupo: { empresaId } },
      include: { grupo: { include: { permisos: true } } },
    });
    if (!permiso) {
      return { ok: false as const, codigo: "PERMISO-NO-EXISTE", mensaje: "El permiso ya no existe. Recargue la pantalla." };
    }
    if (permiso.grupo.esPredefinido) {
      return { ok: false as const, codigo: "GRUPO-PREDEFINIDO", mensaje: "Los grupos predefinidos son de solo lectura." };
    }

    const permisosPropuestos = permiso.grupo.permisos.map((actual) =>
      actual.id === permisoId ? { ...actual, [campo]: valor } : actual
    );
    const [conflicto] = evaluarConflictosSoD(permisosPropuestos);
    if (conflicto) {
      return { ok: false as const, codigo: conflicto.codigo, mensaje: conflicto.descripcion };
    }

    const despues = await tx.permisoGrupo.update({ where: { id: permisoId }, data: { [campo]: valor } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "GrupoSeguridad", registroId: permiso.grupoId, accion: "ACTUALIZAR", antes: permiso, despues, usuario: auth.usuario });
    return { ok: true as const };
  });
  revalidatePath("/configuracion/grupos-seguridad");
  return resultado;
}

export async function alternarActivoGrupo(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  const grupo = await prisma.grupoSeguridad.findUnique({ where: { id } });
  if (!perteneceAEmpresaActiva(grupo, empresaId) || grupo.esPredefinido) return;
  await prisma.$transaction(async (tx) => {
    const despues = await tx.grupoSeguridad.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "GrupoSeguridad", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes: grupo, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/grupos-seguridad");
}
