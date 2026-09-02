"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { normalizarDetallesFormula, type DetalleFormulaNormalizado } from "@/lib/detallesFormula";

export type EstadoFormulario = { error?: string };


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
  const horasEstandar = Number(formData.get("horasEstandar"));
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let detallesRaw: unknown;
  try {
    detallesRaw = JSON.parse(String(formData.get("detalles") ?? "[]"));
  } catch {
    return { error: "El detalle de insumos es inválido." };
  }

  if (!productoId) return { error: "Seleccione el producto." };
  if (!Number.isFinite(rendimientoKg) || rendimientoKg <= 0) {
    return { error: "El rendimiento en kg debe ser mayor a 0." };
  }
  if (!Number.isFinite(horasEstandar) || horasEstandar <= 0) {
    return { error: "Las horas estándar deben ser mayores a 0." };
  }
  const detalles: DetalleFormulaNormalizado[] | null = normalizarDetallesFormula(detallesRaw);
  if (detalles === null) {
    return { error: "El detalle de insumos es inválido." };
  }
  if (detalles.length === 0) {
    return { error: "Agregue al menos un insumo con cantidad mayor a 0." };
  }
  const insumosUnicos = new Set(detalles.map((d) => d.insumoId));
  if (insumosUnicos.size !== detalles.length) {
    return { error: "Hay insumos repetidos en el detalle." };
  }

  await prisma.$transaction(async (tx) => {
    // Serializa todas las versiones del mismo producto antes de calcular el
    // siguiente número o cambiar cuál queda vigente.
    await tx.producto.update({
      where: { id: productoId },
      data: { id: productoId },
      select: { id: true },
    });
    const ultima = await tx.formula.findFirst({
      where: { productoId },
      orderBy: { version: "desc" },
    });
    const ahora = new Date();
    // La nueva versión nace vigente: cierra la vigencia de cualquier otra versión
    // activa del mismo producto para que nunca haya dos versiones vigentes a la vez.
    const vigentes = await tx.formula.findMany({
      where: { productoId, activo: true },
      include: { detalles: true },
    });
    await tx.formula.updateMany({
      where: { productoId, activo: true },
      data: { activo: false, vigenteHasta: ahora },
    });
    for (const vigente of vigentes) {
      const despuesVigente = await tx.formula.findUniqueOrThrow({ where: { id: vigente.id }, include: { detalles: true } });
      await registrarAuditoriaMaestro(tx, { entidad: "Formula", registroId: vigente.id, accion: "DESACTIVAR", antes: vigente, despues: despuesVigente, usuario: auth.usuario });
    }
    const formula = await tx.formula.create({
      data: {
        productoId,
        version: (ultima?.version ?? 0) + 1,
        rendimientoKg,
        horasEstandar,
        notas,
        vigenteDesde: ahora,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: { create: detalles.map((d) => ({ insumoId: d.insumoId, cantidad: d.cantidad })) },
      },
      include: { detalles: true },
    });
    await registrarAuditoriaMaestro(tx, { entidad: "Formula", registroId: formula.id, accion: "CREAR", despues: formula, usuario: auth.usuario });
  });

  revalidatePath("/produccion/formulas");
  redirect("/produccion/formulas");
}

export async function alternarActivoFormula(id: string, activo: boolean) {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;

  await prisma.$transaction(async (tx) => {
    const referencia = await tx.formula.findUniqueOrThrow({
      where: { id },
      select: { productoId: true },
    });
    await tx.producto.update({
      where: { id: referencia.productoId },
      data: { id: referencia.productoId },
      select: { id: true },
    });
    const ahora = new Date();
    const antes = await tx.formula.findUniqueOrThrow({ where: { id }, include: { detalles: true } });
    if (activo) {
      // Reactivar una versión anterior cierra la vigencia de la que estuviera
      // activa en ese momento para el mismo producto (nunca dos a la vez).
      const vigentes = await tx.formula.findMany({
        where: { productoId: antes.productoId, activo: true, id: { not: id } },
        include: { detalles: true },
      });
      await tx.formula.updateMany({
        where: { productoId: antes.productoId, activo: true, id: { not: id } },
        data: { activo: false, vigenteHasta: ahora },
      });
      for (const vigente of vigentes) {
        const despuesVigente = await tx.formula.findUniqueOrThrow({ where: { id: vigente.id }, include: { detalles: true } });
        await registrarAuditoriaMaestro(tx, { entidad: "Formula", registroId: vigente.id, accion: "DESACTIVAR", antes: vigente, despues: despuesVigente, usuario: auth.usuario });
      }
      const despues = await tx.formula.update({
        where: { id },
        data: { activo: true, vigenteDesde: ahora, vigenteHasta: null },
        include: { detalles: true },
      });
      await registrarAuditoriaMaestro(tx, { entidad: "Formula", registroId: id, accion: "ACTIVAR", antes, despues, usuario: auth.usuario });
    } else {
      const despues = await tx.formula.update({ where: { id }, data: { activo: false, vigenteHasta: ahora }, include: { detalles: true } });
      await registrarAuditoriaMaestro(tx, { entidad: "Formula", registroId: id, accion: "DESACTIVAR", antes, despues, usuario: auth.usuario });
    }
  });

  revalidatePath("/produccion/formulas");
}
