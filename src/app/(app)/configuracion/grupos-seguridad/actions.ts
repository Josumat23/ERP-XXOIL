"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { MODULOS } from "./modulos";

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
    await prisma.grupoSeguridad.create({
      data: {
        codigo,
        nombre,
        permisos: {
          create: MODULOS.map((m) => ({ modulo: m.clave, puedeVer: true })),
        },
      },
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
) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;

  const permiso = await prisma.permisoGrupo.findUnique({
    where: { id: permisoId },
    include: { grupo: true },
  });
  if (!permiso || permiso.grupo.esPredefinido) return; // los predefinidos son de solo lectura

  await prisma.permisoGrupo.update({ where: { id: permisoId }, data: { [campo]: valor } });
  revalidatePath("/configuracion/grupos-seguridad");
}

export async function alternarActivoGrupo(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const grupo = await prisma.grupoSeguridad.findUnique({ where: { id } });
  if (!grupo || grupo.esPredefinido) return;
  await prisma.grupoSeguridad.update({ where: { id }, data: { activo } });
  revalidatePath("/configuracion/grupos-seguridad");
}
