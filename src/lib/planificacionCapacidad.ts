export type CalendarioCentro = {
  centroTrabajoId: string;
  capacidadEfectivaHoras: number;
  horasSemana: [number, number, number, number, number, number, number];
  diasNoLaborables: Set<string>;
};

export type OperacionPorProgramar = {
  id: string;
  centroTrabajoId: string;
  cargaHoras: number;
  noAntesDe: Date;
  predecesoraId?: string;
};

export type ProgramacionOperacion = { id: string; fechaPlanInicio: Date; fechaPlanFin: Date };

export function claveFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function inicioDia(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function cargaPlanOperacion(preparacion: number, maquina: number, manoObra: number): number {
  return preparacion + Math.max(maquina, manoObra);
}

export function programarCapacidadFinita(operaciones: OperacionPorProgramar[], calendarios: CalendarioCentro[]): ProgramacionOperacion[] {
  const porCentro = new Map(calendarios.map((calendario) => [calendario.centroTrabajoId, calendario]));
  const consumido = new Map<string, number>();
  const resultado: ProgramacionOperacion[] = [];
  const finPorOperacion = new Map<string, Date>();
  for (const operacion of operaciones) {
    const calendario = porCentro.get(operacion.centroTrabajoId);
    if (!calendario || !Number.isFinite(operacion.cargaHoras) || operacion.cargaHoras <= 0) continue;
    let restante = operacion.cargaHoras;
    const finPredecesora = operacion.predecesoraId ? finPorOperacion.get(operacion.predecesoraId) : undefined;
    const cursor = inicioDia(finPredecesora && finPredecesora > operacion.noAntesDe ? finPredecesora : operacion.noAntesDe);
    let inicio: Date | null = null;
    let guardia = 0;
    while (restante > 0.000001 && guardia < 3660) {
      const clave = `${operacion.centroTrabajoId}:${claveFecha(cursor)}`;
      const horasDia = calendario.diasNoLaborables.has(claveFecha(cursor)) ? 0 : Math.min(calendario.capacidadEfectivaHoras, calendario.horasSemana[cursor.getDay()]);
      const disponible = Math.max(0, horasDia - (consumido.get(clave) ?? 0));
      if (disponible > 0) {
        inicio ??= new Date(cursor);
        const asignado = Math.min(disponible, restante);
        consumido.set(clave, (consumido.get(clave) ?? 0) + asignado);
        restante -= asignado;
      }
      if (restante > 0.000001) cursor.setDate(cursor.getDate() + 1);
      guardia += 1;
    }
    if (inicio && restante <= 0.000001) {
      const programacion = { id: operacion.id, fechaPlanInicio: inicio, fechaPlanFin: new Date(cursor) };
      resultado.push(programacion);
      finPorOperacion.set(operacion.id, programacion.fechaPlanFin);
    }
  }
  return resultado;
}
