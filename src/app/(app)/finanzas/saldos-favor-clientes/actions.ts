"use server";

import { revalidatePath } from "next/cache";
import type { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";
import {
  aplicarCreditoCliente,
  aprobarReembolsoCliente,
  solicitarReembolsoCliente,
} from "@/lib/creditosCliente";
import { validarTipoCambio } from "@/lib/multimoneda";

export type EstadoFormularioCredito = { error?: string; exito?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

function revalidarSaldosFavor() {
  revalidatePath("/finanzas/saldos-favor-clientes");
  revalidatePath("/finanzas/caja");
  revalidatePath("/finanzas/cuentas-por-cobrar");
  revalidatePath("/comercial/facturas");
}

export async function compensarCreditoCliente(
  creditoId: string,
  _estado: EstadoFormularioCredito,
  formData: FormData
): Promise<EstadoFormularioCredito> {
  const auth = await requerirRol(["ALMACEN", "VENTAS", "GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite compensar saldos de clientes." };
  }
  const facturaId = String(formData.get("facturaId") ?? "");
  const monto = Number(formData.get("monto"));
  if (!facturaId) return { error: "Seleccione una factura pendiente." };
  try {
    await prisma.$transaction((tx) =>
      aplicarCreditoCliente(
        tx,
        { creditoId, facturaId, monto },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      )
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidarSaldosFavor();
  return { exito: "Saldo a favor aplicado a la factura." };
}

export async function solicitarReembolso(
  creditoId: string,
  _estado: EstadoFormularioCredito,
  formData: FormData
): Promise<EstadoFormularioCredito> {
  const auth = await requerirRol(["ALMACEN", "GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite solicitar reembolsos." };
  }
  const monto = Number(formData.get("monto"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;
  const credito = await prisma.creditoCliente.findUnique({
    where: { id: creditoId },
    select: { moneda: true },
  });
  if (!credito) return { error: "El crédito no existe." };
  const tipoCambio = credito.moneda === "PEN" ? 1 : Number(formData.get("tipoCambio"));
  if (!MEDIOS_VALIDOS.includes(medioPago)) return { error: "Seleccione el medio de pago." };
  if (!validarTipoCambio(credito.moneda, tipoCambio)) {
    return { error: "Ingrese un tipo de cambio válido para el reembolso." };
  }
  const config = await obtenerConfiguracionEmpresa();
  try {
    await prisma.$transaction((tx) =>
      solicitarReembolsoCliente(
        tx,
        {
          creditoId,
          monto,
          tipoCambio,
          medioPago,
          referencia,
          montoAprobacionPagos: config.montoAprobacionPagos.toNumber(),
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      )
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidarSaldosFavor();
  return { exito: "Reembolso registrado o enviado a aprobación según el umbral." };
}

export async function aprobarReembolso(reembolsoId: string): Promise<EstadoFormularioCredito> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite aprobar reembolsos." };
  }
  const reembolso = await prisma.reembolsoCliente.findUnique({ where: { id: reembolsoId } });
  if (!reembolso) return { error: "El reembolso no existe." };
  if (!puedeResolverSolicitud(reembolso.usuarioId, auth.usuario.id)) {
    return { error: "La persona solicitante no puede aprobar su propio reembolso." };
  }
  try {
    await prisma.$transaction((tx) =>
      aprobarReembolsoCliente(
        tx,
        reembolsoId,
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      )
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidarSaldosFavor();
  return {};
}

export async function rechazarReembolso(
  reembolsoId: string,
  _estado: EstadoFormularioCredito,
  formData: FormData
): Promise<EstadoFormularioCredito> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite resolver reembolsos." };
  }
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { error: "Explique el rechazo con al menos 5 caracteres." };
  const reembolso = await prisma.reembolsoCliente.findUnique({ where: { id: reembolsoId } });
  if (!reembolso || reembolso.estadoAprobacion !== "PENDIENTE") {
    return { error: "El reembolso no está pendiente." };
  }
  if (!puedeResolverSolicitud(reembolso.usuarioId, auth.usuario.id)) {
    return { error: "La persona solicitante no puede rechazar su propia solicitud." };
  }
  const actualizado = await prisma.reembolsoCliente.updateMany({
    where: { id: reembolso.id, estadoAprobacion: "PENDIENTE" },
    data: {
      estadoAprobacion: "RECHAZADA",
      aprobadoPor: auth.usuario.nombre,
      aprobadoEn: new Date(),
      motivoRechazo: motivo,
    },
  });
  if (actualizado.count !== 1) return { error: "La solicitud cambió mientras se resolvía." };
  revalidarSaldosFavor();
  return { exito: "Reembolso rechazado con trazabilidad." };
}