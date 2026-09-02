"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { cargaPlanOperacion, programarCapacidadFinita } from "@/lib/planificacionCapacidad";

export async function nivelarCapacidad(): Promise<void> {
  const auth = await requerirRol(["PRODUCCION"]);
  if ("error" in auth || !(await puedeRealizar(auth.usuario, "produccion", "editar"))) return;
  const [centros, lotes] = await Promise.all([
    prisma.centroTrabajo.findMany({ where: { activo: true }, include: { almacen: { include: { calendarioProduccion: { include: { diasNoLaborables: true } } } } } }),
    prisma.loteGranel.findMany({ where: { estado: "EN_PROCESO" }, include: { operaciones: { where: { estado: { not: "COMPLETADA" } }, orderBy: { secuencia: "asc" } } }, orderBy: { fechaInicio: "asc" } }),
  ]);
  const calendarios = centros.flatMap((centro) => {
    const calendario = centro.almacen.calendarioProduccion;
    if (!calendario) return [];
    return [{
      centroTrabajoId: centro.id,
      capacidadEfectivaHoras: centro.capacidadHorasDia.toNumber() * centro.eficienciaPct.toNumber() / 100,
      horasSemana: [calendario.horasDomingo, calendario.horasLunes, calendario.horasMartes, calendario.horasMiercoles, calendario.horasJueves, calendario.horasViernes, calendario.horasSabado].map((valor) => valor.toNumber()) as [number, number, number, number, number, number, number],
      diasNoLaborables: new Set(calendario.diasNoLaborables.map((dia) => `${dia.fecha.getFullYear()}-${String(dia.fecha.getMonth() + 1).padStart(2, "0")}-${String(dia.fecha.getDate()).padStart(2, "0")}`)),
    }];
  });
  const operaciones = lotes.flatMap((lote) => lote.operaciones.map((operacion, indice) => ({
    id: operacion.id,
    centroTrabajoId: operacion.centroTrabajoId,
    cargaHoras: cargaPlanOperacion(operacion.preparacionPlanHoras.toNumber(), operacion.maquinaPlanHoras.toNumber(), operacion.manoObraPlanHoras.toNumber()),
    noAntesDe: lote.fechaInicio > new Date() ? lote.fechaInicio : new Date(),
    predecesoraId: indice > 0 ? lote.operaciones[indice - 1].id : undefined,
  })));
  const programacion = programarCapacidadFinita(operaciones, calendarios);
  if (programacion.length > 0) await prisma.$transaction(programacion.map((item) => prisma.loteOperacion.update({ where: { id: item.id }, data: { fechaPlanInicio: item.fechaPlanInicio, fechaPlanFin: item.fechaPlanFin } })));
  revalidatePath("/produccion/capacidad");
}
