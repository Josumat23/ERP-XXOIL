"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";

export type EstadoFormulario = { error?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

export async function registrarPagoProveedor(
  cuentaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;

  const monto = Number(formData.get("monto"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de pago." };

  try {
    await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaPorPagar.findUnique({
        where: { id: cuentaId },
        include: { proveedor: true },
      });
      if (!cuenta) throw new Error("La cuenta por pagar no existe.");

      const saldo = cuenta.saldo.toNumber();
      if (monto > saldo + 1e-9) {
        throw new Error(`El monto supera el saldo pendiente (${saldo.toFixed(2)}).`);
      }

      await tx.pagoProveedor.create({
        data: {
          cuentaPorPagarId: cuentaId,
          monto,
          medioPago,
          referencia,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Egreso automático en el libro de caja
      await tx.movimientoCaja.create({
        data: {
          tipo: "EGRESO",
          concepto: `Pago a ${cuenta.proveedor.razonSocial} (doc. ${cuenta.numeroDocumento})`,
          monto,
          medioPago,
          referencia: cuenta.numeroDocumento,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      const nuevoSaldo = saldo - monto;
      await tx.cuentaPorPagar.update({
        where: { id: cuentaId },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE" },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath(`/finanzas/cuentas-por-pagar/${cuentaId}`);
  revalidatePath("/finanzas/caja");
  return {};
}
