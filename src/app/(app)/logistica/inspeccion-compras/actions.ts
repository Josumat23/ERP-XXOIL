"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { actualizarCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import { normalizarLecturasCalidad, resultadosDelEnsayo, type ResultadoDeEnsayo } from "@/lib/planesCalidad";
import { ResultadoInspeccion } from "@/generated/prisma/client";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

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
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const inspeccion = await tx.inspeccionCompra.findFirst({
        where: { id: inspeccionId, recepcionDetalle: { recepcion: { ordenCompra: { empresaId } } } },
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
      const plan = await tx.planInspeccionInsumo.findFirst({ where: { empresaId, insumoId: inspeccion.recepcionDetalle.insumoId, activo: true }, include: { caracteristicas: { orderBy: { secuencia: "asc" } } } });
      if (plan && plan.id !== planId) throw new Error("Debe usar el plan de inspección vigente. Actualice la página.");
      if (!plan && planId) throw new Error("El plan de inspección ya no está vigente.");
      // Misma operación que el ensayo de liberación y que el re-análisis del
      // envasado, con la misma librería: estaba copiada a mano acá, y una regla
      // de negocio copiada es cómo dos ensayos terminan aplicando criterios
      // distintos sin que nadie lo decida.
      let mediciones: ResultadoDeEnsayo[] = [];
      if (plan) {
        const lecturas = normalizarLecturasCalidad(String(formData.get("lecturas") ?? ""));
        mediciones = resultadosDelEnsayo(plan.caracteristicas.map(c => ({
          ...c,
          limiteInferior: c.limiteInferior?.toNumber() ?? null,
          limiteSuperior: c.limiteSuperior?.toNumber() ?? null,
        })), lecturas);
        resultado = mediciones.every(m => m.conforme) ? ResultadoInspeccion.APROBADO : ResultadoInspeccion.RECHAZADO;

        // Los instrumentos llegan del navegador: se comprueban antes de
        // asentar la inspección.
        const instrumentos = [...new Set(mediciones.map(m => m.instrumentoId).filter((x): x is string => x !== null))];
        if (instrumentos.length > 0) {
          const propios = await tx.instrumentoMedicion.count({ where: { id: { in: instrumentos }, empresaId } });
          if (propios !== instrumentos.length) throw new Error("Algún instrumento no pertenece a la compañía activa.");
        }
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
      // Campo por campo y no con el objeto entero: el tipo que devuelve la
      // librería lo comparten tres ensayos con modelos distintos, y un campo
      // nuevo en uno de ellos rompía este create en silencio. Ya pasó.
      if (mediciones.length > 0) await tx.medicionInspeccionCompra.createMany({ data: mediciones.map(m => ({
        inspeccionCompraId: inspeccion.id,
        secuencia: m.secuencia,
        nombre: m.nombre,
        unidadMedida: m.unidadMedida,
        limiteInferior: m.limiteInferior,
        limiteSuperior: m.limiteSuperior,
        metodoEnsayo: m.metodoEnsayo,
        valorMedido: m.valorMedido,
        conforme: m.conforme,
        instrumentoId: m.instrumentoId,
      })) });

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
