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
import { puedeLiberarOrden } from "@/lib/cicloOrdenProduccion";

export type EstadoFormulario = { error?: string };

export async function iniciarOperacion(id: string): Promise<void> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth || !(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const operacion = await tx.loteOperacion.findUnique({ where: { id }, include: { loteGranel: true } });
    if (!operacion || operacion.loteGranel.estado !== "EN_PROCESO") throw new Error("La operación no está disponible.");
    const anteriorPendiente = await tx.loteOperacion.count({ where: { loteGranelId: operacion.loteGranelId, secuencia: { lt: operacion.secuencia }, estado: { not: "COMPLETADA" } } });
    const otraEnProceso = await tx.loteOperacion.count({ where: { loteGranelId: operacion.loteGranelId, estado: "EN_PROCESO" } });
    if (anteriorPendiente > 0 || otraEnProceso > 0) throw new Error("Complete la operación anterior antes de iniciar esta operación.");
    const resultado = await tx.loteOperacion.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "EN_PROCESO", inicioEn: new Date(), usuarioInicioId: auth.usuario.id, usuarioInicioNombre: auth.usuario.nombre } });
    if (resultado.count !== 1) throw new Error("La operación fue actualizada por otro usuario.");
  });
  revalidatePath(`/produccion/lotes`);
}

export async function completarOperacion(id: string, _prevState: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) return { error: "Sin permiso para confirmar operaciones." };
  const preparacionRealHoras = Number(formData.get("preparacionRealHoras"));
  const maquinaRealHoras = Number(formData.get("maquinaRealHoras"));
  const manoObraRealHoras = Number(formData.get("manoObraRealHoras"));
  const equipoId = String(formData.get("equipoId") ?? "") || null;
  const tiempos = [preparacionRealHoras, maquinaRealHoras, manoObraRealHoras];
  if (tiempos.some((valor) => !Number.isFinite(valor) || valor < 0) || tiempos.every((valor) => valor === 0)) return { error: "Registre tiempos reales válidos; al menos uno debe ser mayor a cero." };
  try {
    const operacion = await prisma.$transaction(async (tx) => {
      const actual = await tx.loteOperacion.findUnique({ where: { id }, include: { loteGranel: true } });
      if (!actual || actual.estado !== "EN_PROCESO" || actual.loteGranel.estado !== "EN_PROCESO") throw new Error("Solo puede completar una operación en proceso.");
      if (equipoId) {
        const equipo = await tx.equipo.findFirst({ where: { id: equipoId, centroTrabajoId: actual.centroTrabajoId, activo: true }, select: { id: true } });
        if (!equipo) throw new Error("El equipo no está activo o no pertenece al centro de trabajo de la operación.");
      }
      const resultado = await tx.loteOperacion.updateMany({ where: { id, estado: "EN_PROCESO" }, data: { equipoId, preparacionRealHoras, maquinaRealHoras, manoObraRealHoras, estado: "COMPLETADA", finEn: new Date(), usuarioFinId: auth.usuario.id, usuarioFinNombre: auth.usuario.nombre } });
      if (resultado.count !== 1) throw new Error("La operación fue actualizada por otro usuario.");
      return actual;
    });
    revalidatePath(`/produccion/lotes/${operacion.loteGranelId}`);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo completar la operación." };
  }
}

// Crear la orden congela fórmula, cantidades planificadas y costo estándar.
// El inventario y WIP se mueven recién al liberarla.
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
        include: { detalles: true, producto: true, operaciones: { orderBy: { secuencia: "asc" } } },
      });
      if (!formula || !formula.activo) throw new Error("La fórmula no existe o está inactiva.");

      if (loteOrigenId) {
        const origen = await tx.loteGranel.findUnique({ where: { id: loteOrigenId } });
        if (!origen) throw new Error("El lote de origen del reproceso no existe.");
        if (origen.estado !== "RECHAZADO" || origen.disposicionRechazo) {
          throw new Error("El lote rechazado ya fue dispuesto o no está disponible para reproceso.");
        }
      }

      const codigo = await siguienteCodigoLote(tx);
      const factor = kgObjetivo / formula.rendimientoKg.toNumber();

      let costoEstandarInsumos = 0;
      for (const detalle of formula.detalles) {
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: detalle.insumoId } });
        costoEstandarInsumos += detalle.cantidad.toNumber() * factor * insumo.costoUnitario.toNumber();
      }
      const costoEstandarManoObra = formula.horasEstandar === null ? null : formula.horasEstandar.toNumber() * factor * tarifaHoraManoObra.toNumber();
      await tx.loteGranel.create({
        data: {
          codigo,
          formulaId,
          loteOrigenId,
          kgObjetivo,
          estado: "PLANIFICADO",
          fechaCreacion: new Date(),
          costoEstandarInsumos,
          costoEstandarManoObra,
          costoEstandarTotal: costoEstandarManoObra === null ? null : costoEstandarInsumos + costoEstandarManoObra,
          observaciones,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          operaciones: {
            create: formula.operaciones.map((operacion) => ({
              formulaOperacionId: operacion.id,
              centroTrabajoId: operacion.centroTrabajoId,
              secuencia: operacion.secuencia,
              nombre: operacion.nombre,
              preparacionPlanHoras: operacion.preparacionHoras.toNumber() * factor,
              maquinaPlanHoras: operacion.maquinaHoras.toNumber() * factor,
              manoObraPlanHoras: operacion.manoObraHoras.toNumber() * factor,
            })),
          },
        },
      });

    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/lotes");
  redirect("/produccion/lotes");
}

export async function liberarLote(id: string): Promise<void> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth || !(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  await prisma.$transaction(async (tx) => {
    const lote = await tx.loteGranel.findUnique({ where: { id }, include: { formula: { include: { detalles: true, producto: true } }, loteOrigen: true } });
    if (!lote || !puedeLiberarOrden(lote.estado)) throw new Error("Solo se puede liberar una orden planificada.");
    const ahora = new Date();
    const cambio = await tx.loteGranel.updateMany({ where: { id, estado: "PLANIFICADO" }, data: { estado: "EN_PROCESO", fechaInicio: ahora, fechaLiberacion: ahora, usuarioLiberacionId: auth.usuario.id, usuarioLiberacionNombre: auth.usuario.nombre } });
    if (cambio.count !== 1) throw new Error("La orden fue liberada por otro usuario.");
    let costoReproceso = 0;
    if (lote.loteOrigenId) {
      const origen = lote.loteOrigen;
      if (!origen || origen.estado !== "RECHAZADO" || origen.disposicionRechazo) throw new Error("El lote de reproceso ya no está disponible.");
      costoReproceso = origen.costoInsumos.toNumber() + origen.costoManoObra.toNumber() + origen.costoReproceso.toNumber();
      const disposicion = await tx.loteGranel.updateMany({ where: { id: origen.id, estado: "RECHAZADO", disposicionRechazo: null }, data: { disposicionRechazo: "REPROCESADO", motivoDisposicion: `Incorporado a ${lote.codigo}`, fechaDisposicion: new Date(), usuarioDisposicionId: auth.usuario.id, usuarioDisposicionNombre: auth.usuario.nombre } });
      if (disposicion.count !== 1) throw new Error("El lote rechazado fue dispuesto por otro usuario.");
    }
    const factor = lote.kgObjetivo.toNumber() / lote.formula.rendimientoKg.toNumber();
    let costoInsumos = 0;
    for (const detalle of lote.formula.detalles) {
      const cantidad = detalle.cantidad.toNumber() * factor;
      const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: detalle.insumoId } });
      costoInsumos += cantidad * insumo.costoUnitario.toNumber();
      const movimiento = await registrarMovimiento(tx, { tipoItem: "INSUMO", insumoId: detalle.insumoId, tipoMovimiento: "SALIDA", origen: "PRODUCCION", cantidad, referencia: `Lote ${lote.codigo} (${lote.formula.producto.nombre} v${lote.formula.version})`, usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre });
      if (!movimiento.ok) throw new Error(movimiento.error);
      await asignarLoteInsumo(tx, { loteGranelId: lote.id, insumoId: detalle.insumoId, cantidad });
    }
    await tx.loteGranel.update({ where: { id }, data: { costoInsumos, costoReproceso } });
    if (costoInsumos > 0) await postearAsiento(tx, { origen: "INICIO_PRODUCCION", glosa: `Liberación y consumo de materias primas para ${lote.codigo}`, referencia: lote.codigo, lineas: [{ clave: "WIP_PRODUCCION", debe: costoInsumos }, { clave: "INVENTARIO_INSUMOS", haber: costoInsumos }], usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre });
  });
  revalidatePath("/produccion/lotes");
  revalidatePath(`/produccion/lotes/${id}`);
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
  const horasManoObraIngresadas = Number(formData.get("horasManoObra") ?? 0);
  if (!Number.isFinite(horasManoObraIngresadas) || horasManoObraIngresadas < 0) {
    return { error: "Las horas de mano de obra deben ser mayores o iguales a 0." };
  }

  const { tarifaHoraManoObra } = await obtenerConfiguracionEmpresa();
  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.loteGranel.findUnique({ where: { id }, include: { operaciones: true } });
      if (!lote) throw new Error("El lote no existe.");
      if (lote.estado !== "EN_PROCESO") throw new Error("Solo se puede finalizar un lote en proceso.");
      if (lote.operaciones.some((operacion) => operacion.estado !== "COMPLETADA")) throw new Error("Complete todas las operaciones de la ruta antes de finalizar el lote.");
      const horasManoObra = lote.operaciones.length > 0
        ? lote.operaciones.reduce((total, operacion) => total + operacion.manoObraRealHoras.toNumber(), 0)
        : horasManoObraIngresadas;
      const costoManoObra = horasManoObra * tarifaHoraManoObra.toNumber();
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
