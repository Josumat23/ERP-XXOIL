"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import {
  siguienteNumeroOrdenCompra,
  siguienteNumeroRecepcion,
} from "@/lib/correlativos";
import { postearRecepcionCompra } from "@/lib/contabilidad";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";

export type EstadoFormulario = { error?: string };

type LineaOC = { insumoId: string; cantidad: number; costoUnitario: number };

export async function crearOrdenCompra(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const proveedorId = String(formData.get("proveedorId") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineas: LineaOC[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la orden es inválido." };
  }

  if (!proveedorId) return { error: "Seleccione el proveedor." };
  lineas = lineas.filter(
    (l) =>
      l.insumoId &&
      Number.isFinite(l.cantidad) &&
      l.cantidad > 0 &&
      Number.isFinite(l.costoUnitario) &&
      l.costoUnitario >= 0
  );
  if (lineas.length === 0) {
    return { error: "Agregue al menos una línea con cantidad y costo válidos." };
  }

  const { montoAprobacionCompras } = await obtenerConfiguracionEmpresa();

  let ocId = "";
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroOrdenCompra(tx);
    const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
    const oc = await tx.ordenCompra.create({
      data: {
        numero,
        proveedorId,
        total,
        notas,
        estadoAprobacion: total >= montoAprobacionCompras.toNumber() ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        detalles: {
          create: lineas.map((l) => ({
            insumoId: l.insumoId,
            cantidad: l.cantidad,
            costoUnitario: l.costoUnitario,
            subtotal: l.cantidad * l.costoUnitario,
          })),
        },
      },
    });
    ocId = oc.id;
  });

  revalidatePath("/logistica/ordenes-compra");
  redirect(`/logistica/ordenes-compra/${ocId}`);
}

export async function anularOrdenCompra(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo de anulación es obligatorio." };

  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { recepciones: true },
  });
  if (!oc) return { error: "La orden no existe." };
  if (oc.estado !== "PENDIENTE" || oc.recepciones.length > 0) {
    return { error: "Solo se puede anular una orden pendiente sin recepciones." };
  }

  await prisma.ordenCompra.update({
    where: { id },
    data: { estado: "ANULADA", motivoAnulacion: motivo },
  });

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}

type LineaRecepcion = {
  detalleId: string;
  cantidad: number;
  costoUnitario: number;
  numeroLoteProveedor?: string;
};

// Recepción de mercadería: entra al kardex (origen COMPRA), actualiza el costo
// promedio ponderado del insumo y genera la cuenta por pagar al proveedor.
export async function registrarRecepcion(
  ordenCompraId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const numeroDocumento = String(formData.get("numeroDocumento") ?? "").trim();
  const diasCredito = Number(formData.get("diasCredito") ?? 0);
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let lineas: LineaRecepcion[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "El detalle de la recepción es inválido." };
  }

  if (!numeroDocumento) {
    return { error: "Ingrese el número de la factura o guía del proveedor." };
  }
  lineas = lineas.filter(
    (l) => l.detalleId && Number.isFinite(l.cantidad) && l.cantidad > 0
  );
  if (lineas.length === 0) {
    return { error: "Ingrese al menos una cantidad recibida mayor a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({
        where: { id: ordenCompraId },
        include: { detalles: { include: { insumo: true } }, proveedor: true },
      });
      if (!oc) throw new Error("La orden de compra no existe.");
      if (oc.estado === "ANULADA" || oc.estado === "RECIBIDA") {
        throw new Error("La orden no admite más recepciones.");
      }
      if (oc.estadoAprobacion === "PENDIENTE") {
        throw new Error("Esta orden supera el monto de aprobación y todavía no fue aprobada por Gerencia.");
      }
      if (oc.estadoAprobacion === "RECHAZADA") {
        throw new Error("Esta orden fue rechazada por Gerencia y no admite recepciones.");
      }

      const numero = await siguienteNumeroRecepcion(tx);
      const recepcion = await tx.recepcionCompra.create({
        data: {
          numero,
          ordenCompraId,
          notas,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      let totalRecepcion = 0;

      for (const linea of lineas) {
        const detalle = oc.detalles.find((d) => d.id === linea.detalleId);
        if (!detalle) throw new Error("Línea de recepción inválida.");

        const pendiente = detalle.cantidad.toNumber() - detalle.cantidadRecibida.toNumber();
        if (linea.cantidad > pendiente + 1e-9) {
          throw new Error(
            `"${detalle.insumo.nombre}": se intenta recibir ${linea.cantidad} pero quedan ${pendiente} pendientes.`
          );
        }

        const costo = Number.isFinite(linea.costoUnitario) && linea.costoUnitario >= 0
          ? linea.costoUnitario
          : detalle.costoUnitario.toNumber();

        const detalleRecepcion = await tx.recepcionCompraDetalle.create({
          data: {
            recepcionId: recepcion.id,
            insumoId: detalle.insumoId,
            cantidad: linea.cantidad,
            costoUnitario: costo,
            numeroLoteProveedor: linea.numeroLoteProveedor?.trim() || null,
          },
        });

        const insumo = detalle.insumo;
        if (insumo.requiereInspeccion) {
          // No suma stock ni recalcula costo promedio hasta que calidad
          // apruebe — cantidadDisponible se activa recién ahí (ver
          // resolverInspeccionCompra).
          await tx.inspeccionCompra.create({
            data: { recepcionCompraDetalleId: detalleRecepcion.id },
          });
        } else {
          await tx.recepcionCompraDetalle.update({
            where: { id: detalleRecepcion.id },
            data: { cantidadDisponible: linea.cantidad },
          });
          // Costo promedio ponderado ANTES de mover el stock
          const stockActual = insumo.stock.toNumber();
          const costoActual = insumo.costoUnitario.toNumber();
          const nuevoCosto =
            stockActual + linea.cantidad > 0
              ? (stockActual * costoActual + linea.cantidad * costo) / (stockActual + linea.cantidad)
              : costo;
          await tx.insumo.update({
            where: { id: insumo.id },
            data: { costoUnitario: nuevoCosto },
          });

          const mov = await registrarMovimiento(tx, {
            tipoItem: "INSUMO",
            insumoId: detalle.insumoId,
            tipoMovimiento: "ENTRADA",
            origen: "COMPRA",
            cantidad: linea.cantidad,
            referencia: `Recepción ${numero} (${oc.numero}, doc. ${numeroDocumento})`,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          });
          if (!mov.ok) throw new Error(mov.error);
        }

        await tx.ordenCompraDetalle.update({
          where: { id: detalle.id },
          data: { cantidadRecibida: detalle.cantidadRecibida.toNumber() + linea.cantidad },
        });

        totalRecepcion += linea.cantidad * costo;
      }

      // Estado de la OC según lo recibido acumulado
      const detallesActualizados = await tx.ordenCompraDetalle.findMany({
        where: { ordenCompraId },
      });
      const completa = detallesActualizados.every(
        (d) => d.cantidadRecibida.toNumber() >= d.cantidad.toNumber() - 1e-9
      );
      await tx.ordenCompra.update({
        where: { id: ordenCompraId },
        data: { estado: completa ? "RECIBIDA" : "PARCIAL" },
      });

      // Cuenta por pagar por lo efectivamente recibido
      const fechaVencimiento =
        diasCredito > 0
          ? new Date(Date.now() + diasCredito * 24 * 60 * 60 * 1000)
          : null;
      await tx.cuentaPorPagar.create({
        data: {
          proveedorId: oc.proveedorId,
          ordenCompraId,
          numeroDocumento,
          fechaVencimiento,
          total: totalRecepcion,
          saldo: totalRecepcion,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      await postearRecepcionCompra(
        tx,
        {
          numeroRecepcion: numero,
          documentoProveedor: numeroDocumento,
          proveedor: oc.proveedor.razonSocial,
          total: totalRecepcion,
        },
        { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
      );
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${ordenCompraId}`);
  revalidatePath("/finanzas/cuentas-por-pagar");
  revalidatePath("/inventario/kardex");
  return {};
}

// Aprobación por monto: solo Gerencia (o un Administrador) puede resolver
// una orden que superó el umbral configurado en Configuración → Empresa.
export async function aprobarOrdenCompra(id: string) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;

  const oc = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!oc) return { error: "La orden no existe." };
  if (oc.estadoAprobacion !== "PENDIENTE") {
    return { error: "Esta orden no está pendiente de aprobación." };
  }

  await prisma.ordenCompra.update({
    where: { id },
    data: { estadoAprobacion: "APROBADA", aprobadaPor: auth.usuario.nombre, aprobadaEn: new Date() },
  });

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}

export async function rechazarOrdenCompra(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "El motivo del rechazo es obligatorio." };

  const oc = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!oc) return { error: "La orden no existe." };
  if (oc.estadoAprobacion !== "PENDIENTE") {
    return { error: "Esta orden no está pendiente de aprobación." };
  }

  await prisma.ordenCompra.update({
    where: { id },
    data: {
      estadoAprobacion: "RECHAZADA",
      aprobadaPor: auth.usuario.nombre,
      aprobadaEn: new Date(),
      motivoRechazo: motivo,
    },
  });

  revalidatePath("/logistica/ordenes-compra");
  revalidatePath(`/logistica/ordenes-compra/${id}`);
  return {};
}
