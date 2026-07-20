"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoLote } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

// Crear lote: consume insumos según la fórmula (escalados al kg objetivo)
// y deja el lote EN_PROCESO. El consumo queda en el kardex con el código del lote.
export async function crearLote(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const formulaId = String(formData.get("formulaId") ?? "");
  const kgObjetivo = Number(formData.get("kgObjetivo"));
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (!formulaId) return { error: "Seleccione la fórmula." };
  if (!Number.isFinite(kgObjetivo) || kgObjetivo <= 0) {
    return { error: "Los kg objetivo deben ser mayores a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const formula = await tx.formula.findUnique({
        where: { id: formulaId },
        include: { detalles: true, producto: true },
      });
      if (!formula || !formula.activo) throw new Error("La fórmula no existe o está inactiva.");

      const codigo = await siguienteCodigoLote(tx);
      const factor = kgObjetivo / formula.rendimientoKg.toNumber();

      const lote = await tx.loteGranel.create({
        data: {
          codigo,
          formulaId,
          kgObjetivo,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Consume insumos y acumula su costo (al costo promedio vigente)
      let costoInsumos = 0;
      for (const detalle of formula.detalles) {
        const cantidad = detalle.cantidad.toNumber() * factor;
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: detalle.insumoId } });
        costoInsumos += cantidad * insumo.costoUnitario.toNumber();

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: detalle.insumoId,
          tipoMovimiento: "SALIDA",
          origen: "PRODUCCION",
          cantidad,
          referencia: `Lote ${lote.codigo} (${formula.producto.nombre} v${formula.version})`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      await tx.loteGranel.update({ where: { id: lote.id }, data: { costoInsumos } });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/lotes");
  redirect("/produccion/lotes");
}

// Finalizar cocción: registra kg producidos y merma; pasa a control de calidad.
export async function finalizarLote(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const kgProducidos = Number(formData.get("kgProducidos"));
  if (!Number.isFinite(kgProducidos) || kgProducidos <= 0) {
    return { error: "Los kg producidos deben ser mayores a 0." };
  }

  const lote = await prisma.loteGranel.findUnique({ where: { id } });
  if (!lote) return { error: "El lote no existe." };
  if (lote.estado !== "EN_PROCESO") {
    return { error: "Solo se puede finalizar un lote en proceso." };
  }

  const merma = Math.max(0, lote.kgObjetivo.toNumber() - kgProducidos);

  await prisma.loteGranel.update({
    where: { id },
    data: {
      kgProducidos,
      mermaKg: merma,
      // La merma encarece el kg: el costo total se reparte entre lo realmente producido.
      costoKg: lote.costoInsumos.toNumber() / kgProducidos,
      estado: "PENDIENTE_CALIDAD",
      fechaFin: new Date(),
    },
  });

  revalidatePath("/produccion/lotes");
  revalidatePath(`/produccion/lotes/${id}`);
  revalidatePath("/produccion/calidad");
  redirect(`/produccion/lotes/${id}`);
}
