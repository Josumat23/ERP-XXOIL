"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearCausaCalidad(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const causa = await tx.causaCalidad.create({ data: { nombre } });
      await registrarAuditoriaMaestro(tx, { entidad: "CausaCalidad", registroId: causa.id, accion: "CREAR", despues: causa, usuario: auth.usuario });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la causa "${nombre}".` };
    }
    throw e;
  }

  revalidatePath("/produccion/calidad/causas");
  revalidatePath("/produccion/calidad");
  revalidatePath("/produccion/calidad/reclamos");
  return {};
}

export async function alternarActivoCausaCalidad(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.causaCalidad.findUniqueOrThrow({ where: { id } });
    const despues = await tx.causaCalidad.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { entidad: "CausaCalidad", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/produccion/calidad/causas");
}
