"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol, hashPassword } from "@/lib/auth";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

const ROLES_VALIDOS: $Enums.RolUsuario[] = ["ADMIN", "ALMACEN", "PRODUCCION", "VENTAS", "GERENCIA"];

export async function crearUsuario(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const usuario = String(formData.get("usuario") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "") as $Enums.RolUsuario;
  const grupoSeguridadId = String(formData.get("grupoSeguridadId") ?? "").trim() || null;

  if (!nombre || !usuario) return { error: "Nombre y usuario son obligatorios." };
  if (!/^[a-z0-9._-]{3,}$/.test(usuario)) {
    return { error: "El usuario debe tener al menos 3 caracteres (letras, números, . _ -)." };
  }
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!ROLES_VALIDOS.includes(rol)) return { error: "Seleccione el rol." };

  try {
    await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: { nombre, usuario, rol, grupoSeguridadId, passwordHash: hashPassword(password) },
      });
      await registrarAuditoriaMaestro(tx, { entidad: "Usuario", registroId: creado.id, accion: "CREAR", despues: creado, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe el usuario "${usuario}".` };
    }
    throw e;
  }

  revalidatePath("/configuracion/usuarios");
  return {};
}

export async function restablecerPassword(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  await prisma.$transaction(async (tx) => {
    const antes = await tx.usuario.findUniqueOrThrow({ where: { id } });
    const despues = await tx.usuario.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    await registrarAuditoriaMaestro(tx, { entidad: "Usuario", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
    // Cierra todas las sesiones abiertas del usuario afectado.
    await tx.sesion.deleteMany({ where: { usuarioId: id } });
  });

  revalidatePath("/configuracion/usuarios");
  return {};
}

export async function asignarGrupoUsuario(id: string, grupoSeguridadId: string | null) {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;

  await prisma.$transaction(async (tx) => {
    const antes = await tx.usuario.findUniqueOrThrow({ where: { id } });
    const despues = await tx.usuario.update({ where: { id }, data: { grupoSeguridadId } });
    await registrarAuditoriaMaestro(tx, { entidad: "Usuario", registroId: id, accion: "ACTUALIZAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/configuracion/usuarios");
}

export async function alternarActivoUsuario(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  if (auth.usuario.id === id) return; // nadie se desactiva a sí mismo

  await prisma.$transaction(async (tx) => {
    const antes = await tx.usuario.findUniqueOrThrow({ where: { id } });
    const despues = await tx.usuario.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "Usuario", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
    if (!activo) await tx.sesion.deleteMany({ where: { usuarioId: id } });
  });
  revalidatePath("/configuracion/usuarios");
}
