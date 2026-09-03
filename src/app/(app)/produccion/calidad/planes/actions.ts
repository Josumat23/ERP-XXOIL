"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { normalizarCaracteristicasPlan } from "@/lib/planesCalidad";

export type EstadoPlan = { error?: string };

export async function crearVersionPlan(_estado: EstadoPlan, formData: FormData): Promise<EstadoPlan> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return { error: "No tiene permiso para administrar planes de calidad." };
  const productoId = String(formData.get("productoId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!productoId || nombre.length < 3) return { error: "Seleccione el producto e indique un nombre de plan." };
  try {
    const caracteristicas = normalizarCaracteristicasPlan(String(formData.get("caracteristicas") ?? ""));
    await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({ where: { id: productoId, empresaId: auth.usuario.empresaId, activo: true } });
      if (!producto) throw new Error("El producto no existe o no está activo.");
      const ultima = await tx.planInspeccionCalidad.findFirst({ where: { productoId }, orderBy: { version: "desc" } });
      const ahora = new Date();
      await tx.planInspeccionCalidad.updateMany({ where: { productoId, activo: true }, data: { activo: false, vigenteHasta: ahora } });
      await tx.planInspeccionCalidad.create({
        data: {
          empresaId: auth.usuario.empresaId, productoId, version: (ultima?.version ?? 0) + 1, nombre,
          vigenteDesde: ahora, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre,
          caracteristicas: { create: caracteristicas },
        },
      });
    });
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el plan." }; }
  revalidatePath("/produccion/calidad");
  revalidatePath("/produccion/calidad/planes");
  redirect("/produccion/calidad/planes");
}
