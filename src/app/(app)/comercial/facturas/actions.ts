"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

export async function registrarCobro(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const monto = Number(formData.get("monto"));
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;

  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto debe ser mayor a 0." };
  }
  if (!MEDIOS_VALIDOS.includes(medioPago)) {
    return { error: "Seleccione el medio de pago." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({ where: { id: facturaId } });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const saldo = factura.saldo.toNumber();
      if (monto > saldo + 1e-9) {
        throw new Error(`El monto supera el saldo pendiente (${saldo.toFixed(2)}).`);
      }

      await tx.cobro.create({
        data: {
          facturaId,
          monto,
          medioPago,
          referencia,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Ingreso automático en el libro de caja
      await tx.movimientoCaja.create({
        data: {
          tipo: "INGRESO",
          concepto: `Cobro factura ${factura.numero}`,
          monto,
          medioPago,
          referencia: factura.numero,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      const nuevoSaldo = saldo - monto;
      await tx.factura.update({
        where: { id: facturaId },
        data: {
          saldo: nuevoSaldo,
          estado: nuevoSaldo <= 1e-9 ? "PAGADA" : "PENDIENTE",
        },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/finanzas/caja");
  return {};
}

// Nota de crédito: reduce el saldo de la factura y revierte la comisión
// en forma proporcional con un registro nuevo (nunca se edita la original).
export async function crearNotaCredito(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase();
  const monto = Number(formData.get("monto"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!numero) return { error: "Ingrese el número de la nota de crédito (SUNAT)." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!motivo) return { error: "El motivo es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: { notasCredito: true, comisiones: true },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura está anulada.");

      const totalNC = factura.notasCredito.reduce((acc, nc) => acc + nc.monto.toNumber(), 0);
      const maximo = factura.total.toNumber() - totalNC;
      if (monto > maximo + 1e-9) {
        throw new Error(
          `El monto supera lo disponible para notas de crédito (${maximo.toFixed(2)}).`
        );
      }

      await tx.notaCredito.create({
        data: {
          numero,
          facturaId,
          monto,
          motivo,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // El saldo por cobrar baja hasta un mínimo de cero.
      const nuevoSaldo = Math.max(0, factura.saldo.toNumber() - monto);
      await tx.factura.update({
        where: { id: facturaId },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 1e-9 ? "PAGADA" : factura.estado },
      });

      // Reversión proporcional de la comisión generada.
      const generada = factura.comisiones.find((c) => c.tipo === "GENERADA");
      if (generada) {
        const tasa = generada.tasa.toNumber();
        await tx.comision.create({
          data: {
            vendedorId: factura.vendedorId,
            facturaId,
            tipo: "REVERSION",
            tasa,
            monto: -(monto * tasa) / 100,
            motivo: `Nota de crédito ${numero}`,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una nota de crédito con el número ${numero}.` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/comercial/comisiones");
  return {};
}

// Anular factura: solo sin cobros; reingresa el stock por kardex y revierte
// la comisión completa. Queda registrado quién, cuándo y por qué.
export async function anularFactura(
  facturaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo de anulación es obligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const factura = await tx.factura.findUnique({
        where: { id: facturaId },
        include: {
          cobros: true,
          comisiones: true,
          notasCredito: true,
          pedido: { include: { detalles: true } },
        },
      });
      if (!factura) throw new Error("La factura no existe.");
      if (factura.estado === "ANULADA") throw new Error("La factura ya está anulada.");
      if (factura.cobros.length > 0) {
        throw new Error("No se puede anular una factura con cobros registrados.");
      }
      if (factura.notasCredito.length > 0) {
        throw new Error("No se puede anular una factura con notas de crédito.");
      }

      // Reingreso del stock vendido
      for (const d of factura.pedido.detalles) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: d.presentacionId,
          tipoMovimiento: "ENTRADA",
          origen: "ANULACION_VENTA",
          cantidad: d.cantidad,
          motivo,
          referencia: `Anulación factura ${factura.numero}`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      // Reversión total de la comisión generada
      const generada = factura.comisiones.find((c) => c.tipo === "GENERADA");
      if (generada) {
        await tx.comision.create({
          data: {
            vendedorId: factura.vendedorId,
            facturaId,
            tipo: "REVERSION",
            tasa: generada.tasa,
            monto: -generada.monto.toNumber(),
            motivo: `Anulación de factura: ${motivo}`,
          },
        });
      }

      await tx.factura.update({
        where: { id: facturaId },
        data: {
          estado: "ANULADA",
          saldo: 0,
          motivoAnulacion: motivo,
          anuladaEn: new Date(),
          anuladaPor: auth.usuario.nombre,
        },
      });

      // El pedido queda anulado junto con su factura; si la venta se
      // retoma, se registra un pedido nuevo (la historia no se reutiliza).
      await tx.pedido.update({
        where: { id: factura.pedidoId },
        data: { estado: "ANULADO" },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath(`/comercial/facturas/${facturaId}`);
  revalidatePath("/comercial/facturas");
  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial/comisiones");
  return {};
}
