"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroCotizacion, siguienteNumeroPedido } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

type LineaCotizacion = { presentacionId: string; cantidad: number; precioUnitario: number };

export async function crearCotizacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const clienteId = String(formData.get("clienteId") ?? "");
  const vendedorId = String(formData.get("vendedorId") ?? "");
  const validaHastaRaw = String(formData.get("validaHasta") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineas: LineaCotizacion[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la cotización es inválido." };
  }

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!vendedorId) return { error: "Seleccione el vendedor." };
  if (!validaHastaRaw) return { error: "Indique hasta cuándo es válida la cotización." };
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

  let cotizacionId = "";
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroCotizacion(tx);
    const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
    const cotizacion = await tx.cotizacion.create({
      data: {
        numero,
        clienteId,
        vendedorId,
        validaHasta: new Date(`${validaHastaRaw}T00:00:00`),
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
    cotizacionId = cotizacion.id;
  });

  revalidatePath("/comercial/cotizaciones");
  redirect(`/comercial/cotizaciones/${cotizacionId}`);
}

export async function marcarCotizacion(id: string, estado: "ACEPTADA" | "RECHAZADA") {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion || cotizacion.estado !== "PENDIENTE") return;

  await prisma.cotizacion.update({ where: { id }, data: { estado } });
  revalidatePath("/comercial/cotizaciones");
  revalidatePath(`/comercial/cotizaciones/${id}`);
}

// Convierte una cotización aceptada en un Pedido real (mismas líneas y
// precios). A partir de ahí sigue el flujo normal: Pedido → Facturar.
export async function convertirCotizacionAPedido(id: string): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  let pedidoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacion.findUnique({ where: { id }, include: { detalles: true } });
      if (!cotizacion) throw new Error("La cotización no existe.");
      if (cotizacion.estado === "CONVERTIDA") throw new Error("Esta cotización ya fue convertida a pedido.");
      if (cotizacion.estado !== "ACEPTADA" && cotizacion.estado !== "PENDIENTE") {
        throw new Error("Solo se puede convertir una cotización pendiente o aceptada.");
      }

      const numero = await siguienteNumeroPedido(tx);
      const pedido = await tx.pedido.create({
        data: {
          numero,
          clienteId: cotizacion.clienteId,
          vendedorId: cotizacion.vendedorId,
          total: cotizacion.total,
          notas: cotizacion.notas ? `Desde cotización ${cotizacion.numero}: ${cotizacion.notas}` : `Desde cotización ${cotizacion.numero}`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          detalles: {
            create: cotizacion.detalles.map((d) => ({
              presentacionId: d.presentacionId,
              cantidad: d.cantidad,
              precioUnitario: d.precioUnitario,
              subtotal: d.subtotal,
            })),
          },
        },
      });
      pedidoId = pedido.id;

      await tx.cotizacion.update({
        where: { id },
        data: { estado: "CONVERTIDA", pedidoId: pedido.id },
      });
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/comercial/cotizaciones");
  revalidatePath("/comercial/pedidos");
  redirect(`/comercial/pedidos/${pedidoId}`);
}
