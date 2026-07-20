"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

type LineaDetalle = { insumoId: string; cantidad: number };

// Las fórmulas no se editan: cada cambio es una versión nueva (historia intacta).
export async function crearFormula(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const productoId = String(formData.get("productoId") ?? "");
  const rendimientoKg = Number(formData.get("rendimientoKg"));
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let detalles: LineaDetalle[];
  try {
    detalles = JSON.parse(String(formData.get("detalles") ?? "[]"));
  } catch {
    return { error: "El detalle de insumos es inválido." };
  }

  if (!productoId) return { error: "Seleccione el producto." };
  if (!Number.isFinite(rendimientoKg) || rendimientoKg <= 0) {
    return { error: "El rendimiento en kg debe ser mayor a 0." };
  }
  detalles = detalles.filter((d) => d.insumoId && Number.isFinite(d.cantidad) && d.cantidad > 0);
  if (detalles.length === 0) {
    return { error: "Agregue al menos un insumo con cantidad mayor a 0." };
  }
  const insumosUnicos = new Set(detalles.map((d) => d.insumoId));
  if (insumosUnicos.size !== detalles.length) {
    return { error: "Hay insumos repetidos en el detalle." };
  }

  await prisma.$transaction(async (tx) => {
    const ultima = await tx.formula.findFirst({
      where: { productoId },
      orderBy: { version: "desc" },
    });
    await tx.formula.create({
      data: {
        productoId,
        version: (ultima?.version ?? 0) + 1,
        rendimientoKg,
        notas,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: { create: detalles.map((d) => ({ insumoId: d.insumoId, cantidad: d.cantidad })) },
      },
    });
  });

  revalidatePath("/produccion/formulas");
  redirect("/produccion/formulas");
}

export async function alternarActivoFormula(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.formula.update({ where: { id }, data: { activo } });
  revalidatePath("/produccion/formulas");
}
