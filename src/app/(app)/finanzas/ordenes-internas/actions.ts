"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoOrdenInterna } from "@/lib/correlativos";
import { postearOrdenInterna } from "@/lib/contabilidad";

export type EstadoFormulario = { error?: string };

export async function crearOrdenInterna(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Finanzas." };
  }

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;
  const presupuestoRaw = String(formData.get("presupuesto") ?? "").trim();
  const presupuesto = presupuestoRaw ? Number(presupuestoRaw) : null;

  if (!descripcion) return { error: "Ingrese una descripción del propósito de la orden." };
  if (presupuesto !== null && (!Number.isFinite(presupuesto) || presupuesto < 0)) {
    return { error: "El presupuesto debe ser un número válido." };
  }

  let ordenId = "";
  await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoOrdenInterna(tx);
    const orden = await tx.ordenInterna.create({
      data: {
        codigo,
        descripcion,
        centroCostoId,
        presupuesto,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });
    ordenId = orden.id;
  });

  revalidatePath("/finanzas/ordenes-internas");
  redirect(`/finanzas/ordenes-internas/${ordenId}`);
}

export async function agregarCostoOrdenInterna(
  ordenInternaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const concepto = String(formData.get("concepto") ?? "").trim();
  const monto = Number(formData.get("monto"));

  if (!concepto) return { error: "Ingrese el concepto del costo." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };

  try {
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenInterna.findUniqueOrThrow({ where: { id: ordenInternaId } });
      if (orden.estado !== "ABIERTA") {
        throw new Error("Solo se pueden agregar costos a una orden abierta.");
      }
      await tx.ordenInternaCosto.create({
        data: { ordenInternaId, concepto, monto, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre },
      });
      await tx.ordenInterna.update({
        where: { id: ordenInternaId },
        data: { totalAcumulado: { increment: monto } },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/finanzas/ordenes-internas/${ordenInternaId}`);
  return {};
}

export async function liquidarOrdenInterna(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const centroCostoId = String(formData.get("centroCostoId") ?? "");
  if (!centroCostoId) return { error: "Seleccione el centro de costo de destino." };

  try {
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenInterna.findUniqueOrThrow({ where: { id } });
      if (orden.estado !== "ABIERTA") {
        throw new Error("Solo se puede liquidar una orden abierta.");
      }
      const total = orden.totalAcumulado.toNumber();
      if (total <= 0) throw new Error("La orden no tiene costos acumulados que liquidar.");

      await tx.ordenInterna.update({
        where: { id },
        data: { estado: "LIQUIDADA", centroCostoId, fechaLiquidacion: new Date() },
      });

      // Best-effort, igual que el resto del motor: si el control contable no
      // está configurado, la liquidación queda registrada igual, sin asiento.
      await postearOrdenInterna(
        tx,
        { codigoOrden: orden.codigo, descripcion: orden.descripcion, monto: total, centroCostoId },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/finanzas/ordenes-internas");
  revalidatePath(`/finanzas/ordenes-internas/${id}`);
  return {};
}

export async function anularOrdenInterna(id: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) return;

  await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenInterna.findUnique({ where: { id } });
    if (!orden || orden.estado !== "ABIERTA" || orden.totalAcumulado.toNumber() > 0) return;
    await tx.ordenInterna.update({ where: { id }, data: { estado: "ANULADA" } });
  });

  revalidatePath("/finanzas/ordenes-internas");
  revalidatePath(`/finanzas/ordenes-internas/${id}`);
}
