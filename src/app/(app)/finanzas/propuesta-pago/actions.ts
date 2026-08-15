"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { ejecutarPagoProveedor } from "@/lib/pagosProveedor";

export type EstadoFormulario = { error?: string; resultado?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

type LineaPropuesta = { cuentaId: string; monto: number };

// Ejecuta el pago de varias cuentas por pagar de una vez (equivalente
// reducido al "programa de pago automático" F110 de SAP): cada cuenta se
// paga en su propia transacción, reutilizando exactamente el mismo motor
// que el pago individual (mismo umbral de aprobación, mismo asiento
// contable) — si una falla (ej. ya tiene un pago pendiente de aprobación),
// las demás igual se procesan; el resultado final lista qué pasó con cada
// una.
export async function ejecutarPropuestaPago(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de pago." };

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "La selección de cuentas es inválida." };
  }
  if (!Array.isArray(lineasRaw)) {
    return { error: "La selección de cuentas es inválida." };
  }

  const lineas: LineaPropuesta[] = [];
  for (const linea of lineasRaw) {
    if (
      typeof linea !== "object" ||
      linea === null ||
      !("cuentaId" in linea) ||
      !("monto" in linea) ||
      typeof linea.cuentaId !== "string" ||
      typeof linea.monto !== "number" ||
      !linea.cuentaId ||
      !Number.isFinite(linea.monto) ||
      linea.monto <= 0
    ) {
      continue;
    }
    lineas.push({ cuentaId: linea.cuentaId, monto: linea.monto });
  }
  if (lineas.length === 0) {
    return { error: "Seleccione al menos una cuenta por pagar con un monto mayor a 0." };
  }
  if (new Set(lineas.map((linea) => linea.cuentaId)).size !== lineas.length) {
    return { error: "La propuesta contiene cuentas por pagar repetidas." };
  }

  const { montoAprobacionPagos } = await obtenerConfiguracionEmpresa();
  const montoAprobacion = montoAprobacionPagos.toNumber();

  const exitosas: string[] = [];
  const fallidas: string[] = [];

  for (const linea of lineas) {
    try {
      await prisma.$transaction(async (tx) => {
        const resultado = await ejecutarPagoProveedor(
          tx,
          {
            cuentaId: linea.cuentaId,
            monto: linea.monto,
            medioPago,
            referencia: "Propuesta de pago en lote",
            montoAprobacionPagos: montoAprobacion,
          },
          { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
        );
        if (!resultado.ok) throw new Error(resultado.error);
        exitosas.push(linea.cuentaId);
      });
    } catch (e) {
      fallidas.push(e instanceof Error ? e.message : "Error desconocido");
    }
  }

  revalidatePath("/finanzas/propuesta-pago");
  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath("/finanzas/caja");

  if (fallidas.length > 0) {
    return {
      error: `${fallidas.length} cuenta(s) no se pudieron pagar: ${fallidas.join(" · ")}`,
      resultado: exitosas.length > 0 ? `${exitosas.length} pago(s) registrados correctamente.` : undefined,
    };
  }
  return { resultado: `${exitosas.length} pago(s) registrados correctamente.` };
}
