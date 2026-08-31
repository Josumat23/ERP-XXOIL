"use server";

import { revalidatePath } from "next/cache";
import type { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { aplicarCreditoProveedor, registrarReembolsoProveedor } from "@/lib/creditosProveedor";

export type EstadoFormularioCreditoProveedor = { error?: string; exito?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO", "TRANSFERENCIA", "DEPOSITO", "YAPE", "PLIN", "OTRO",
];

function revalidar() {
  revalidatePath("/finanzas/saldos-favor-proveedores");
  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath("/finanzas/caja");
}

export async function compensarCreditoProveedor(
  creditoId: string,
  _estado: EstadoFormularioCreditoProveedor,
  formData: FormData
): Promise<EstadoFormularioCreditoProveedor> {
  const auth = await requerirRol(["ALMACEN", "GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite compensar saldos de proveedores." };
  }
  const cuentaPorPagarId = String(formData.get("cuentaPorPagarId") ?? "");
  const montoFuncional = Number(formData.get("montoFuncional"));
  if (!cuentaPorPagarId) return { error: "Seleccione una cuenta por pagar." };
  try {
    await prisma.$transaction((tx) =>
      aplicarCreditoProveedor(
        tx,
        { creditoId, cuentaPorPagarId, montoFuncional },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      )
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidar();
  return { exito: "Saldo aplicado a la cuenta por pagar." };
}

export async function registrarReembolsoRecibido(
  creditoId: string,
  _estado: EstadoFormularioCreditoProveedor,
  formData: FormData
): Promise<EstadoFormularioCreditoProveedor> {
  const auth = await requerirRol(["ALMACEN", "GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite registrar reembolsos de proveedores." };
  }
  const montoFuncional = Number(formData.get("montoFuncional"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim();
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de recepción." };
  try {
    await prisma.$transaction((tx) =>
      registrarReembolsoProveedor(
        tx,
        { creditoId, montoFuncional, medioPago, referencia },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      )
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidar();
  return { exito: "Reembolso recibido y conciliado con el saldo." };
}
