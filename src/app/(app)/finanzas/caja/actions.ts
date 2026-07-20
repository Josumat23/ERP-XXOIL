"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

export type EstadoFormulario = { error?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

// Movimiento manual de caja (gastos operativos, aportes, etc.).
// Los cobros y pagos a proveedores se registran solos desde sus módulos.
export async function crearMovimientoCaja(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Finanzas." };
  }

  const tipo = String(formData.get("tipo") ?? "");
  const concepto = String(formData.get("concepto") ?? "").trim();
  const monto = Number(formData.get("monto"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;

  if (tipo !== "INGRESO" && tipo !== "EGRESO") return { error: "Seleccione ingreso o egreso." };
  if (!concepto) return { error: "El concepto es obligatorio." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de pago." };

  await prisma.movimientoCaja.create({
    data: {
      tipo,
      concepto,
      monto,
      medioPago,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath("/finanzas/caja");
  return {};
}
