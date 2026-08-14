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
  const probabilidadRaw = formData.get("probabilidad");
  const probabilidad = probabilidadRaw !== null && probabilidadRaw !== "" ? Number(probabilidadRaw) : 50;

  let lineas: LineaCotizacion[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la cotización es inválido." };
  }

  if (!clienteId) return { error: "Seleccione el cliente." };
  if (!vendedorId) return { error: "Seleccione el vendedor." };
  if (!validaHastaRaw) return { error: "Indique hasta cuándo es válida la cotización." };
  if (!Number.isInteger(probabilidad) || probabilidad < 0 || probabilidad > 100) {
    return { error: "La probabilidad debe ser un número entero entre 0 y 100." };
  }
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
        probabilidad,
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

  // El cierre real (ganada/perdida) fija la probabilidad al valor obvio —
  // ya no es una estimación, es el resultado.
  const actualizada = await prisma.cotizacion.updateMany({
    where: { id, estado: "PENDIENTE" },
    data: { estado, probabilidad: estado === "ACEPTADA" ? 100 : 0 },
  });
  if (actualizada.count !== 1) return;
  revalidatePath("/comercial/cotizaciones");
  revalidatePath(`/comercial/cotizaciones/${id}`);
  revalidatePath("/comercial/pipeline");
}

// Embudo de ventas simple: mientras la cotización sigue PENDIENTE, el
// vendedor ajusta su estimado de probabilidad de cierre a criterio.
export async function actualizarProbabilidad(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const probabilidad = Number(formData.get("probabilidad"));
  if (!Number.isInteger(probabilidad) || probabilidad < 0 || probabilidad > 100) {
    return { error: "La probabilidad debe ser un número entero entre 0 y 100." };
  }

  const actualizada = await prisma.cotizacion.updateMany({
    where: { id, estado: "PENDIENTE" },
    data: { probabilidad },
  });
  if (actualizada.count !== 1) {
    const existe = await prisma.cotizacion.findUnique({ where: { id }, select: { id: true } });
    return {
      error: existe
        ? "Solo se puede ajustar la probabilidad de una cotización pendiente."
        : "La cotización no existe.",
    };
  }
  revalidatePath(`/comercial/cotizaciones/${id}`);
  revalidatePath("/comercial/cotizaciones");
  revalidatePath("/comercial/pipeline");
  return {};
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
      await tx.cotizacion.updateMany({
        where: { id, estado: { in: ["PENDIENTE", "ACEPTADA"] }, pedidoId: null },
        data: { probabilidad: { increment: 0 } },
      });

      const cotizacion = await tx.cotizacion.findUnique({ where: { id }, include: { detalles: true } });
      if (!cotizacion) throw new Error("La cotización no existe.");
      if (cotizacion.estado === "CONVERTIDA") throw new Error("Esta cotización ya fue convertida a pedido.");
      if (cotizacion.estado !== "ACEPTADA" && cotizacion.estado !== "PENDIENTE") {
        throw new Error("Solo se puede convertir una cotización pendiente o aceptada.");
      }

      // Al convertirse en pedido pendiente, las líneas pasan de ser una
      // propuesta comercial a comprometer inventario real disponible.
      for (const detalle of [...cotizacion.detalles].sort((a, b) =>
        a.presentacionId.localeCompare(b.presentacionId)
      )) {
        // Comparte el protocolo de bloqueo y el orden determinista con la
        // creación manual de pedidos para impedir reservas concurrentes.
        const presentacion = await tx.presentacion.update({
          where: { id: detalle.presentacionId },
          data: { stockReservado: { increment: 0 } },
        });

        const disponible = presentacion.stock.toNumber() - presentacion.stockReservado.toNumber();
        if (detalle.cantidad > disponible) {
          throw new Error(
            `Stock disponible insuficiente de "${presentacion.nombre}": disponible ${disponible}, se requiere ${detalle.cantidad}.`
          );
        }

        await tx.presentacion.update({
          where: { id: detalle.presentacionId },
          data: { stockReservado: { increment: detalle.cantidad } },
        });
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

      const convertida = await tx.cotizacion.updateMany({
        where: { id, estado: cotizacion.estado, pedidoId: null },
        data: { estado: "CONVERTIDA", pedidoId: pedido.id },
      });
      if (convertida.count !== 1) {
        throw new Error("La cotización cambió mientras se convertía. Intente nuevamente.");
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/comercial/cotizaciones");
  revalidatePath("/comercial/pedidos");
  redirect(`/comercial/pedidos/${pedidoId}`);
}
