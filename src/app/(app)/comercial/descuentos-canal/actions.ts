"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

export async function guardarDescuentoCanal(
  canal: $Enums.CanalCliente,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const descuentoPct = Number(formData.get("descuentoPct") ?? 0);
  if (!Number.isFinite(descuentoPct) || descuentoPct < 0 || descuentoPct > 100) {
    return { error: "El descuento debe ser un porcentaje entre 0 y 100." };
  }

  await prisma.descuentoCanal.upsert({
    where: { canal },
    update: { descuentoPct },
    create: { canal, descuentoPct },
  });

  revalidatePath("/comercial/descuentos-canal");
  revalidatePath("/comercial/pedidos/nuevo");
  revalidatePath("/comercial/cotizaciones/nuevo");
  return {};
}
