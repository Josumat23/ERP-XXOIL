"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import { normalizarLecturasCalidad, valorCumpleEspecificacion } from "@/lib/planesCalidad";
import { ResultadoInspeccion } from "@/generated/prisma/client";

export type EstadoFormulario = { error?: string };

// Resultado de la inspección de calidad de una recepción de compra: si se
// aprueba, recién aquí entra al kardex y se actualiza el costo promedio
// (quedó pendiente desde la recepción). Si se rechaza, nunca suma stock; la
// devolución/nota de crédito al proveedor se registra después desde la OC;
// cualquier exceso sobre la CxP queda en el subledger de saldos a favor.
export async function resolverInspeccionCompra(
  inspeccionId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN", "PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const resultadoSolicitado = String(formData.get("resultado") ?? "");
  let resultado: ResultadoInspeccion = resultadoSolicitado === ResultadoInspeccion.RECHAZADO ? ResultadoInspeccion.RECHAZADO : ResultadoInspeccion.APROBADO;
  const planId = String(formData.get("planId") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (resultadoSolicitado !== ResultadoInspeccion.APROBADO && resultadoSolicitado !== ResultadoInspeccion.RECHAZADO) {
    return { error: "Seleccione el resultado de la inspección." };
  }
  if (resultado === "RECHAZADO" && !observaciones) {
    return { error: "Al rechazar una recepción, las observaciones son obligatorias." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const inspeccion = await tx.inspeccionCompra.findFirst({
        where: { id: inspeccionId, recepcionDetalle: { recepcion: { ordenCompra: { empresaId: auth.usuario.empresaId } } } },
        include: {
          recepcionDetalle: {
            include: { insumo: true, recepcion: { include: { ordenCompra: true } } },
          },
        },
      });
      if (!inspeccion) throw new Error("La inspección no existe.");
      if (inspeccion.resultado !== "PENDIENTE") {
        throw new Error("Esta recepción ya fue evaluada.");
      }
      const plan = await tx.planInspeccionInsumo.findFirst({ where: { empresaId: auth.usuario.empresaId, insumoId: inspeccion.recepcionDetalle.insumoId, activo: true }, include: { caracteristicas: { orderBy: { secuencia: "asc" } } } });
      if (plan && plan.id !== planId) throw new Error("Debe usar el plan de inspección vigente. Actualice la página.");
      if (!plan && planId) throw new Error("El plan de inspección ya no está vigente.");
      let mediciones: { secuencia: number; nombre: string; unidadMedida: string; limiteInferior: number | null; limiteSuperior: number | null; metodoEnsayo: string | null; valorMedido: number; conforme: boolean }[] = [];
      if (plan) {
        const lecturas = normalizarLecturasCalidad(String(formData.get("lecturas") ?? ""));
        const porId = new Map(lecturas.map(l => [l.caracteristicaId, l.valorMedido]));
        const idsPlan = new Set(plan.caracteristicas.map(c => c.id));
        if (new Set(lecturas.map(l => l.caracteristicaId)).size !== lecturas.length || lecturas.some(l => !idsPlan.has(l.caracteristicaId)) || plan.caracteristicas.some(c => c.obligatoria && !porId.has(c.id))) throw new Error("Las mediciones no corresponden al plan vigente.");
        mediciones = plan.caracteristicas.filter(c => porId.has(c.id)).map(c => { const valorMedido = porId.get(c.id); if (valorMedido === undefined) throw new Error(`Falta ${c.nombre}.`); const minimo = c.limiteInferior?.toNumber() ?? null; const maximo = c.limiteSuperior?.toNumber() ?? null; return { secuencia: c.secuencia, nombre: c.nombre, unidadMedida: c.unidadMedida, limiteInferior: minimo, limiteSuperior: maximo, metodoEnsayo: c.metodoEnsayo, valorMedido, conforme: valorCumpleEspecificacion(valorMedido, minimo, maximo) }; });
        resultado = mediciones.every(m => m.conforme) ? ResultadoInspeccion.APROBADO : ResultadoInspeccion.RECHAZADO;
      }
      if (resultado === ResultadoInspeccion.RECHAZADO && !observaciones) throw new Error("Al rechazar una recepción, las observaciones son obligatorias.");

      const reclamo = await tx.inspeccionCompra.updateMany({
        where: { id: inspeccionId, resultado: "PENDIENTE" },
        data: {
          resultado,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          fecha: new Date(),
          planInspeccionId: plan?.id ?? null,
          planVersion: plan?.version ?? null,
        },
      });
      if (reclamo.count !== 1) {
        throw new Error("Esta recepción cambió mientras se evaluaba. Actualice la página e intente nuevamente.");
      }
      if (mediciones.length > 0) await tx.medicionInspeccionCompra.createMany({ data: mediciones.map(m => ({ ...m, inspeccionCompraId: inspeccion.id })) });

      const detalle = inspeccion.recepcionDetalle;
      const insumo = detalle.insumo;
      const cantidad = detalle.cantidad.toNumber();
      const costo = detalle.costoUnitario.toNumber();

      if (resultado === "APROBADO") {
        await tx.recepcionCompraDetalle.update({
          where: { id: detalle.id },
          data: { cantidadDisponible: cantidad },
        });

        const costoActualizado = await actualizarCostoPromedioEntrada(tx, {
          tipoItem: "INSUMO",
          itemId: insumo.id,
          stockActual: insumo.stock,
          costoActual: insumo.costoUnitario,
          cantidadEntrada: cantidad,
          costoEntrada: costo,
        });
        if (!costoActualizado.ok) throw new Error(costoActualizado.error);

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: insumo.id,
          tipoMovimiento: "ENTRADA",
          origen: "COMPRA",
          cantidad,
          referencia: `Recepción ${detalle.recepcion.numero} (${detalle.recepcion.ordenCompra.numero}) — aprobado en inspección de calidad`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/logistica/inspeccion-compras");
  revalidatePath(`/logistica/inspeccion-compras/${inspeccionId}`);
  revalidatePath("/inventario/kardex");
  revalidatePath("/catalogo/insumos");
  return {};
}
