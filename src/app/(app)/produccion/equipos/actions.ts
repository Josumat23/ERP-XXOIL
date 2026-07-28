"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoEquipo } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

function esErrorDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function crearEquipo(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const almacenId = String(formData.get("almacenId") ?? "");
  const activoFijoId = String(formData.get("activoFijoId") ?? "") || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!almacenId) return { error: "Seleccione el almacén / planta del equipo." };

  try {
    await prisma.$transaction(async (tx) => {
      const codigo = await siguienteCodigoEquipo(tx);
      await tx.equipo.create({
        data: { codigo, nombre, almacenId, activoFijoId, notas },
      });
    });
  } catch (e) {
    if (esErrorDuplicado(e)) {
      return { error: "Ese activo fijo ya está enlazado a otro equipo." };
    }
    throw e;
  }

  revalidatePath("/produccion/equipos");
  redirect("/produccion/equipos");
}

export async function alternarActivoEquipo(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.equipo.update({ where: { id }, data: { activo } });
  revalidatePath("/produccion/equipos");
}
