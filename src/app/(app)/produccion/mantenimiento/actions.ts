"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteCodigoOrdenMantenimiento } from "@/lib/correlativos";
import { postearMantenimiento } from "@/lib/contabilidad";
import { registrarMovimiento } from "@/lib/inventario";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoMantenimiento[] = ["PREVENTIVO", "CORRECTIVO"];
const MEDIOS_VALIDOS: $Enums.MedioPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "DEPOSITO",
  "YAPE",
  "PLIN",
  "OTRO",
];

function diasDeVentana(fechaProgramada: Date, duracionDias: number): Date[] {
  const dias: Date[] = [];
  for (let i = 0; i < duracionDias; i++) {
    const d = new Date(fechaProgramada);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }
  return dias;
}

// Al programar la orden, bloquea la ventana de días en el CalendarioProduccion
// del almacén del equipo (si existe) para que Proyecciones vea la parada.
// Best-effort: si el almacén todavía no tiene calendario configurado, la
// orden se crea igual y simplemente no bloquea nada.
export async function crearOrdenMantenimiento(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Producción." };
  }

  const equipoId = String(formData.get("equipoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoMantenimiento;
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const fechaProgramadaRaw = String(formData.get("fechaProgramada") ?? "");
  const duracionDias = Number(formData.get("duracionDias") ?? 1);
  const centroCostoId = String(formData.get("centroCostoId") ?? "") || null;

  if (!equipoId) return { error: "Seleccione el equipo." };
  if (!TIPOS_VALIDOS.includes(tipo)) return { error: "Seleccione el tipo de mantenimiento." };
  if (!descripcion) return { error: "La descripción es obligatoria." };
  const fechaProgramada = fechaProgramadaRaw ? new Date(fechaProgramadaRaw) : null;
  if (!fechaProgramada || Number.isNaN(fechaProgramada.getTime())) {
    return { error: "La fecha programada es obligatoria." };
  }
  if (!Number.isInteger(duracionDias) || duracionDias < 1) {
    return { error: "La duración en días debe ser un entero mayor a 0." };
  }

  await prisma.$transaction(async (tx) => {
    const equipo = await tx.equipo.findUniqueOrThrow({ where: { id: equipoId } });
    const codigo = await siguienteCodigoOrdenMantenimiento(tx);

    await tx.ordenMantenimiento.create({
      data: {
        codigo,
        equipoId,
        tipo,
        descripcion,
        fechaProgramada,
        duracionDias,
        centroCostoId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
      },
    });

    const calendario = await tx.calendarioProduccion.findUnique({
      where: { almacenId: equipo.almacenId },
    });
    if (calendario) {
      for (const dia of diasDeVentana(fechaProgramada, duracionDias)) {
        await tx.diaNoLaborable.upsert({
          where: { calendarioId_fecha: { calendarioId: calendario.id, fecha: dia } },
          update: {},
          create: { calendarioId: calendario.id, fecha: dia, motivo: `Mantenimiento ${codigo}` },
        });
      }
    }
  });

  revalidatePath("/produccion/mantenimiento");
  revalidatePath(`/produccion/equipos/${equipoId}`);
  redirect("/produccion/mantenimiento");
}

export async function iniciarOrdenMantenimiento(id: string) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;

  const existe = await prisma.ordenMantenimiento.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return { error: "La orden no existe." };

  const resultado = await prisma.ordenMantenimiento.updateMany({
    where: { id, estado: "PROGRAMADA" },
    data: { estado: "EN_PROCESO", fechaInicio: new Date() },
  });
  if (resultado.count !== 1) return { error: "La orden ya fue iniciada o cerrada." };

  revalidatePath("/produccion/mantenimiento");
  revalidatePath(`/produccion/mantenimiento/${id}`);
  return {};
}

export async function completarOrdenMantenimiento(
  id: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "produccion", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Producción." };
  }

  const costoManoObra = Number(formData.get("costoManoObra") ?? 0);
  const medioPago = String(formData.get("medioPago") ?? "") as $Enums.MedioPago;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const contadorLecturaRaw = String(formData.get("contadorLectura") ?? "").trim();
  const contadorLectura = contadorLecturaRaw ? Number(contadorLecturaRaw) : null;

  let repuestos: { insumoId: string; cantidad: number }[];
  try {
    repuestos = JSON.parse(String(formData.get("repuestos") ?? "[]"));
  } catch {
    return { error: "El detalle de repuestos es inválido." };
  }
  repuestos = repuestos.filter(
    (r) => r.insumoId && Number.isFinite(r.cantidad) && r.cantidad > 0
  );

  if (!Number.isFinite(costoManoObra) || costoManoObra < 0) {
    return { error: "El costo de mano de obra debe ser un número válido." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenMantenimiento.findUnique({
        where: { id },
        include: { equipo: true, planMantenimiento: true },
      });
      if (!orden) throw new Error("La orden no existe.");
      if (orden.estado === "COMPLETADA" || orden.estado === "CANCELADA") {
        throw new Error("Esta orden ya está cerrada.");
      }
      if (orden.planMantenimiento?.tipo === "POR_CONTADOR" && contadorLectura === null) {
        throw new Error("Ingrese la lectura actual del contador para cerrar este plan preventivo.");
      }

      let costoRepuestos = 0;
      for (const r of repuestos) {
        const insumo = await tx.insumo.findUnique({ where: { id: r.insumoId } });
        if (!insumo) throw new Error("Uno de los repuestos seleccionados no existe.");

        const mov = await registrarMovimiento(tx, {
          tipoItem: "INSUMO",
          insumoId: r.insumoId,
          tipoMovimiento: "SALIDA",
          origen: "AJUSTE",
          cantidad: r.cantidad,
          motivo: `Repuesto para mantenimiento ${orden.codigo}`,
          referencia: orden.codigo,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
        });
        if (!mov.ok) throw new Error(mov.error);

        const costoUnitario = insumo.costoUnitario.toNumber();
        await tx.repuestoOrdenMantenimiento.create({
          data: {
            ordenMantenimientoId: id,
            insumoId: r.insumoId,
            cantidad: r.cantidad,
            costoUnitario,
          },
        });
        costoRepuestos += r.cantidad * costoUnitario;
      }

      const total = costoManoObra + costoRepuestos;
      if (total > 0 && !MEDIOS_VALIDOS.includes(medioPago)) {
        throw new Error("Seleccione el medio de pago del gasto de mantenimiento.");
      }

      const fechaFin = new Date();
      await tx.ordenMantenimiento.update({
        where: { id },
        data: {
          estado: "COMPLETADA",
          fechaFin,
          costoManoObra,
          costoRepuestos,
          observaciones,
        },
      });

      if (orden.planMantenimiento) {
        await tx.planMantenimiento.update({
          where: { id: orden.planMantenimiento.id },
          data: {
            ultimaEjecucionFecha: fechaFin,
            ultimaEjecucionContador:
              orden.planMantenimiento.tipo === "POR_CONTADOR" ? contadorLectura : orden.planMantenimiento.ultimaEjecucionContador,
          },
        });
        if (orden.planMantenimiento.tipo === "POR_CONTADOR" && contadorLectura !== null) {
          await tx.equipo.update({ where: { id: orden.equipoId }, data: { contadorActual: contadorLectura } });
        }
      }

      if (total > 0) {
        await tx.movimientoCaja.create({
          data: {
            tipo: "EGRESO",
            concepto: `Mantenimiento ${orden.codigo} — ${orden.equipo.nombre}`,
            monto: total,
            medioPago,
            referencia: orden.codigo,
            usuarioId: auth.usuario.id,
            usuarioNombre: auth.usuario.nombre,
          },
        });
        await postearMantenimiento(
          tx,
          {
            codigoOrden: orden.codigo,
            equipo: orden.equipo.nombre,
            monto: total,
            centroCostoId: orden.centroCostoId ?? orden.equipo.centroCostoId,
          },
          { usuarioId: auth.usuario.id, usuarioNombre: auth.usuario.nombre }
        );
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/mantenimiento");
  revalidatePath(`/produccion/mantenimiento/${id}`);
  revalidatePath("/finanzas/caja");
  return {};
}

// Solo se puede cancelar antes de iniciar (si ya empezó, se cierra con costos
// reales vía completarOrdenMantenimiento). Libera los días bloqueados que esta
// orden había reservado en el calendario.
export async function cancelarOrdenMantenimiento(id: string) {
  const auth = await requerirRol(["PRODUCCION", "ALMACEN"]);
  if ("error" in auth) return auth;

  try {
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenMantenimiento.findUnique({ where: { id }, include: { equipo: true } });
      if (!orden) throw new Error("La orden no existe.");
      if (orden.estado !== "PROGRAMADA") {
        throw new Error("Solo se puede cancelar una orden que aún no se ha iniciado.");
      }

      const reclamo = await tx.ordenMantenimiento.updateMany({
        where: { id, estado: "PROGRAMADA" },
        data: { estado: "CANCELADA" },
      });
      if (reclamo.count !== 1) {
        throw new Error("La orden cambió mientras se cancelaba. Actualice la página e intente nuevamente.");
      }

      const calendario = await tx.calendarioProduccion.findUnique({
        where: { almacenId: orden.equipo.almacenId },
      });
      if (calendario) {
        await tx.diaNoLaborable.deleteMany({
          where: { calendarioId: calendario.id, motivo: `Mantenimiento ${orden.codigo}` },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/produccion/mantenimiento");
  revalidatePath(`/produccion/mantenimiento/${id}`);
  return {};
}
