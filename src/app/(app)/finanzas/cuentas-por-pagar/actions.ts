"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { postearPagoProveedor } from "@/lib/contabilidad";
import { ejecutarPagoProveedor } from "@/lib/pagosProveedor";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";

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
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const monto = Number(formData.get("monto"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de pago." };

  const { montoAprobacionPagos } = await obtenerConfiguracionEmpresa();

  try {
    await prisma.$transaction(async (tx) => {
      const resultado = await ejecutarPagoProveedor(
        tx,
        {
          cuentaId,
          monto,
          medioPago,
          referencia,
          montoAprobacionPagos: montoAprobacionPagos.toNumber(),
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
      if (!resultado.ok) throw new Error(resultado.error);
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

// Aprobación por monto: ejecuta recién ahora el egreso de caja y el
// descuento del saldo (separa "quien pide el pago" de "quien dispone
// del dinero").
export async function aprobarPagoProveedor(pagoId: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite aprobar pagos a proveedores." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pago = await tx.pagoProveedor.findUnique({
        where: { id: pagoId },
        include: { cuentaPorPagar: { include: { proveedor: true } } },
      });
      if (!pago) throw new Error("El pago no existe.");
      if (pago.estadoAprobacion !== "PENDIENTE") {
        throw new Error("Este pago no está pendiente de aprobación.");
      }
      if (!puedeResolverSolicitud(pago.usuarioId, auth.usuario.id)) {
        throw new Error("La persona que solicitó el pago no puede aprobarlo.");
      }

      const reclamo = await tx.pagoProveedor.updateMany({
        where: { id: pagoId, estadoAprobacion: "PENDIENTE", usuarioId: { not: auth.usuario.id } },
        data: { estadoAprobacion: "APROBADA", aprobadoPor: auth.usuario.nombre, aprobadoEn: new Date() },
      });
      if (reclamo.count !== 1) throw new Error("Este pago ya fue resuelto.");

      const cuenta = pago.cuentaPorPagar;
      const monto = pago.monto.toNumber();

      await tx.movimientoCaja.create({
        data: {
          tipo: "EGRESO",
          concepto: `Pago a ${cuenta.proveedor.razonSocial} (doc. ${cuenta.numeroDocumento})`,
          monto,
          medioPago: pago.medioPago,
          referencia: cuenta.numeroDocumento,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      const nuevoSaldo = cuenta.saldo.toNumber() - monto;
      const saldoActualizado = await tx.cuentaPorPagar.updateMany({
        where: { id: cuenta.id, saldo: cuenta.saldo },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE" },
      });
      if (saldoActualizado.count !== 1 || nuevoSaldo < -1e-9) {
        throw new Error("El saldo de la cuenta cambi\u00f3 y ya no cubre este pago.");
      }

      await postearPagoProveedor(
        tx,
        { documentoProveedor: cuenta.numeroDocumento, proveedor: cuenta.proveedor.razonSocial, monto },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath("/finanzas/caja");
  return {};
}

export async function rechazarPagoProveedor(
  pagoId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver pagos a proveedores." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };

  const pago = await prisma.pagoProveedor.findUnique({ where: { id: pagoId } });
  if (!pago) return { error: "El pago no existe." };
  if (pago.estadoAprobacion !== "PENDIENTE") {
    return { error: "Este pago no está pendiente de aprobación." };
  }

  if (!puedeResolverSolicitud(pago.usuarioId, auth.usuario.id)) {
    return { error: "La persona que solicitó el pago no puede rechazarlo." };
  }

  const reclamo = await prisma.pagoProveedor.updateMany({
    where: { id: pagoId, estadoAprobacion: "PENDIENTE", usuarioId: { not: auth.usuario.id } },
    data: {
      estadoAprobacion: "RECHAZADA",
      aprobadoPor: auth.usuario.nombre,
      aprobadoEn: new Date(),
      motivoRechazo: motivo,
    },
  });
  if (reclamo.count !== 1) return { error: "Este pago ya fue resuelto." };

  revalidatePath("/finanzas/cuentas-por-pagar");
  return {};
}
