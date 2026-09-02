"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { asignarLoteInsumo } from "@/lib/trazabilidad";
import { siguienteCodigoLote } from "@/lib/correlativos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { postearAsiento } from "@/lib/contabilidad";
import { calcularVariacionProduccion } from "@/lib/costeoProduccion";

export type EstadoFormulario = { error?: string };

// Crear lote: consume insumos según la fórmula (escalados al kg objetivo)
// y deja el lote EN_PROCESO. El consumo queda en el kardex con el código del lote.
export async function crearLote(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const formulaId = String(formData.get("formulaId") ?? "");
  const kgObjetivo = Number(formData.get("kgObjetivo"));
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const loteOrigenId = String(formData.get("loteOrigenId") ?? "") || null;

  if (!formulaId) return { error: "Seleccione la fórmula." };
  if (!Number.isFinite(kgObjetivo) || kgObjetivo <= 0) {
    return { error: "Los kg objetivo deben ser mayores a 0." };
  }

  const { tarifaHoraManoObra } = await obtenerConfiguracionEmpresa();

  try {
    await prisma.$transaction(async (tx) => {
      const formula = await tx.formula.findUnique({
        where: { id: formulaId },
        include: { detalles: true, producto: true },
      });
      if (!formula || !formula.activo) throw new Error("La fórmula no existe o está inactiva.");

      let costoReproceso = 0;
      if (loteOrigenId) {
        const origen = await tx.loteGranel.findUnique({ where: { id: loteOrigenId } });
        if (!origen) throw new Error("El lote de origen del reproceso no existe.");
        if (origen.estado !== "RECHAZADO" || origen.disposicionRechazo) {
          throw new Error("El lote rechazado ya fue dispuesto o no está disponible para reproceso.");
        }
        costoReproceso = origen.costoInsumos.toNumber() + origen.costoManoObra.toNumber() + origen.costoReproceso.toNumber();
        const disposicion = await tx.loteGranel.updateMany({
          where: { id: loteOrigenId, estado: "RECHAZADO", disposicionRechazo: null },
          data: {
            disposicionRechazo: "REPROCESADO",
            motivoDisposicion: "Costo y material incorporados a un nuevo lote de reproceso",
            fechaDisposicion: new Date(),
            usuarioDisposicionId: auth.usuario.id,
            usuarioDisposicionNombre: auth.usuario.nombre,
          },
        });
        if (disposicion.count !== 1) throw new Error("El lote rechazado fue dispuesto por otro usuario.");
      }

      const codigo = await siguienteCodigoLote(tx);
      const factor = kgObjetivo / formula.rendimientoKg.toNumber();

      const lote = await tx.loteGranel.create({
        data: {
          codigo,
          formulaId,
          loteOrigenId,
          costoReproceso,
          kgObjetivo,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        },
      });

      // Consume insumos y acumula su costo (al costo promedio vigente)
      let costoInsumos = 0;
      for (const detalle of formula.detalles) {
        const cantidad = detalle.cantidad.toNumber() * factor;
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: detalle.insumoId } });
        costoInsumos += cantidad * insumo.costoUnitario.toNumber();

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: detalle.insumoId,
          tipoMovimiento: "SALIDA",
          origen: "PRODUCCION",
          cantidad,
          referencia: `Lote ${lote.codigo} (${formula.producto.nombre} v${formula.version})`,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);

        // Trazabilidad: qué recepción(es) de compra (lote del proveedor)
        // cubrieron este consumo (FIFO por fecha de recepción).
        await asignarLoteInsumo(tx, {
          loteGranelId: lote.id,
          insumoId: detalle.insumoId,
          cantidad,
        });
      }

      const costoEstandarManoObra =
        formula.horasEstandar === null
          ? null
          : formula.horasEstandar.toNumber() * factor * tarifaHoraManoObra.toNumber();
      await tx.loteGranel.update({
        where: { id: lote.id },
        data: {
          costoInsumos,
          ...(costoEstandarManoObra === null
            ? {}
            : {
                costoEstandarInsumos: costoInsumos,
                costoEstandarManoObra,
                costoEstandarTotal: costoInsumos + costoEstandarManoObra,
              }),
        },
      });
      if (costoInsumos > 0) {
        await postearAsiento(tx, {
          origen: "INICIO_PRODUCCION",
          glosa: `Consumo de materias primas para ${lote.codigo}`,
          referencia: lote.codigo,
          lineas: [
            { clave: "WIP_PRODUCCION", debe: costoInsumos },
            { clave: "INVENTARIO_INSUMOS", haber: costoInsumos },
          ],
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/lotes");
  redirect("/produccion/lotes");
}

// Finalizar cocción: registra kg producidos y merma; pasa a control de calidad.
export async function finalizarLote(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const kgProducidos = Number(formData.get("kgProducidos"));
  if (!Number.isFinite(kgProducidos) || kgProducidos <= 0) {
    return { error: "Los kg producidos deben ser mayores a 0." };
  }
  const horasManoObra = Number(formData.get("horasManoObra") ?? 0);
  if (!Number.isFinite(horasManoObra) || horasManoObra < 0) {
    return { error: "Las horas de mano de obra deben ser mayores o iguales a 0." };
  }

  const { tarifaHoraManoObra } = await obtenerConfiguracionEmpresa();
  const costoManoObra = horasManoObra * tarifaHoraManoObra.toNumber();

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findUnique({ where: { id } });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "EN_PROCESO") throw new Error("Solo se puede finalizar un lote en proceso.");
      const merma = Math.max(0, lote.kgObjetivo.toNumber() - kgProducidos);
      const variaciones =
        lote.costoEstandarInsumos !== null && lote.costoEstandarManoObra !== null
          ? calcularVariacionProduccion({
              kgObjetivo: lote.kgObjetivo.toNumber(),
              kgProducidos,
              costoEstandarInsumos: lote.costoEstandarInsumos.toNumber(),
              costoEstandarManoObra: lote.costoEstandarManoObra.toNumber(),
              costoRealInsumos: lote.costoInsumos.toNumber(),
              costoRealManoObra: costoManoObra,
              costoReproceso: lote.costoReproceso.toNumber(),
            })
          : null;
      const resultado = await tx.loteGranel.updateMany({
        where: { id, estado: "EN_PROCESO" },
        data: {
          kgProducidos,
          mermaKg: merma,
          horasManoObra,
          costoManoObra,
          costoKg: (lote.costoInsumos.toNumber() + lote.costoReproceso.toNumber() + costoManoObra) / kgProducidos,
          ...(variaciones ?? {}),
          estado: "PENDIENTE_CALIDAD",
          fechaFin: new Date(),
        },
      });
      if (resultado.count !== 1) throw new Error("El lote cambió mientras se finalizaba. Actualice la página e intente nuevamente.");
      if (costoManoObra > 0) {
        await postearAsiento(tx, {
          origen: "MANO_OBRA_PRODUCCION",
          glosa: `Mano de obra aplicada a ${lote.codigo}`,
          referencia: lote.codigo,
          lineas: [
            { clave: "WIP_PRODUCCION", debe: costoManoObra },
            { clave: "COSTOS_PRODUCCION_APLICADOS", haber: costoManoObra },
          ],
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
  revalidatePath("/produccion/lotes");
  revalidatePath(`/produccion/lotes/${id}`);
  revalidatePath("/produccion/calidad");
  redirect(`/produccion/lotes/${id}`);
}
