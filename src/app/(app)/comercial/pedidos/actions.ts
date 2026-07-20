"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteNumeroPedido } from "@/lib/correlativos";
import { DIAS_CONDICION } from "@/lib/etiquetas";

export type EstadoFormulario = { error?: string };

type LineaPedido = { presentacionId: string; cantidad: number; precioUnitario: number };

export async function crearPedido(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const clienteId = String(formData.get("clienteId") ?? "");
  const vendedorId = String(formData.get("vendedorId") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineas: LineaPedido[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle del pedido es inválido." };
  }

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!vendedorId) return { error: "Seleccione el vendedor." };
  lineas = lineas.filter(
    (l) =>
      l.presentacionId &&
      Number.isInteger(l.cantidad) &&
      l.cantidad > 0 &&
      Number.isFinite(l.precioUnitario) &&
      l.precioUnitario >= 0
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad y precio válidos." };
  }

  let pedidoId = "";
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroPedido(tx);
    const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
    const pedido = await tx.pedido.create({
      data: {
        numero,
        clienteId,
        vendedorId,
        total,
        notas,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: {
          create: lineas.map((l) => ({
            presentacionId: l.presentacionId,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            subtotal: l.cantidad * l.precioUnitario,
          })),
        },
      },
    });
    pedidoId = pedido.id;
  });

  revalidatePath("/comercial/pedidos");
  redirect(`/comercial/pedidos/${pedidoId}`);
}

export async function anularPedido(id: string) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.estado !== "PENDIENTE") return;

  await prisma.pedido.update({ where: { id }, data: { estado: "ANULADO" } });
  revalidatePath("/comercial/pedidos");
  revalidatePath(`/comercial/pedidos/${id}`);
}

// Facturar: registra el número emitido en SUNAT, descuenta stock por kardex
// y genera la comisión del vendedor con su tasa vigente.
export async function facturarPedido(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase();
  const condicionPago = String(formData.get("condicionPago") ?? "") as $Enums.CondicionPago;

  if (!numero) return { error: "Ingrese el número de factura emitido en SUNAT." };
  if (!["CONTADO", "DIAS_15", "DIAS_30"].includes(condicionPago)) {
    return { error: "Seleccione la condición de pago." };
  }

  let facturaId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: { detalles: { include: { presentacion: true } }, vendedor: true },
      });
      if (!pedido) throw new Error("El pedido no existe.");
      if (pedido.estado !== "PENDIENTE") {
        throw new Error("Solo se puede facturar un pedido pendiente.");
      }

      const fechaEmision = new Date();
      const fechaVencimiento = new Date(
        fechaEmision.getTime() + DIAS_CONDICION[condicionPago] * 24 * 60 * 60 * 1000
      );

      const factura = await tx.factura.create({
        data: {
          numero,
          pedidoId: pedido.id,
          clienteId: pedido.clienteId,
          vendedorId: pedido.vendedorId,
          condicionPago,
          fechaEmision,
          fechaVencimiento,
          total: pedido.total,
          saldo: pedido.total,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });
      facturaId = factura.id;

      // Salida de stock por cada línea, congelando el costo de venta del momento
      for (const d of pedido.detalles) {
        await tx.pedidoDetalle.update({
          where: { id: d.id },
          data: { costoUnitario: d.presentacion.costoPromedio },
        });
        const mov = await registrarMovimiento(tx, {
          tipoItem: "PRESENTACION",
          presentacionId: d.presentacionId,
          tipoMovimiento: "SALIDA",
          origen: "VENTA",
          cantidad: d.cantidad,
          referencia: `Factura ${numero} (pedido ${pedido.numero})`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }

      // Comisión generada con la tasa vigente del vendedor
      const tasa = pedido.vendedor.tasaComision.toNumber();
      await tx.comision.create({
        data: {
          vendedorId: pedido.vendedorId,
          facturaId: factura.id,
          tipo: "GENERADA",
          tasa,
          monto: (pedido.total.toNumber() * tasa) / 100,
        },
      });

      await tx.pedido.update({ where: { id }, data: { estado: "FACTURADO" } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe una factura con el número ${numero}.` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial/facturas");
  redirect(`/comercial/facturas/${facturaId}`);
}
