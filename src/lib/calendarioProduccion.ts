import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Calendario de producción: horas laborables por día de semana + excepciones
// (feriados, mantenimiento) por almacén/planta. Reemplaza el número único que
// usaba antes Proyecciones para el chequeo de capacidad.
// ---------------------------------------------------------------------------

const HORAS_POR_DIA: Record<number, keyof HorasSemana> = {
  0: "horasDomingo",
  1: "horasLunes",
  2: "horasMartes",
  3: "horasMiercoles",
  4: "horasJueves",
  5: "horasViernes",
  6: "horasSabado",
};

type HorasSemana = {
  horasLunes: number;
  horasMartes: number;
  horasMiercoles: number;
  horasJueves: number;
  horasViernes: number;
  horasSabado: number;
  horasDomingo: number;
};

function aFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/** Horas disponibles de UN calendario entre [inicio, fin). */
function horasDeCalendario(
  horas: HorasSemana,
  diasNoLaborables: Set<string>,
  inicio: Date,
  fin: Date
): number {
  let total = 0;
  const cursor = new Date(inicio);
  while (cursor < fin) {
    if (!diasNoLaborables.has(aFecha(cursor))) {
      total += horas[HORAS_POR_DIA[cursor.getDay()]];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export type ResumenCalendario = {
  almacenId: string;
  almacenNombre: string;
  horasDisponibles: number;
};

/**
 * Horas-hombre disponibles entre [inicio, fin), sumadas entre todos los
 * almacenes que tengan calendario configurado. Como los lotes de producción
 * todavía no se asignan a un almacén específico, esto es una agregación de
 * la capacidad total de planta configurada — no un chequeo por planta.
 */
export async function horasDisponiblesEnRango(
  inicio: Date,
  fin: Date
): Promise<{ total: number; porAlmacen: ResumenCalendario[] }> {
  const calendarios = await prisma.calendarioProduccion.findMany({
    include: { almacen: true, diasNoLaborables: true },
  });

  const porAlmacen: ResumenCalendario[] = calendarios.map((c) => {
    const horas: HorasSemana = {
      horasLunes: c.horasLunes.toNumber(),
      horasMartes: c.horasMartes.toNumber(),
      horasMiercoles: c.horasMiercoles.toNumber(),
      horasJueves: c.horasJueves.toNumber(),
      horasViernes: c.horasViernes.toNumber(),
      horasSabado: c.horasSabado.toNumber(),
      horasDomingo: c.horasDomingo.toNumber(),
    };
    const diasNoLaborables = new Set(c.diasNoLaborables.map((d) => aFecha(d.fecha)));
    return {
      almacenId: c.almacenId,
      almacenNombre: c.almacen.nombre,
      horasDisponibles: horasDeCalendario(horas, diasNoLaborables, inicio, fin),
    };
  });

  return { total: porAlmacen.reduce((acc, a) => acc + a.horasDisponibles, 0), porAlmacen };
}

// --- Feriados nacionales del Perú (para el botón de carga rápida) ----------

function pascua(anio: number): Date {
  // Algoritmo de Gauss/Meeus para calcular el Domingo de Pascua (calendario gregoriano).
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

export function feriadosPeru(anio: number): { fecha: Date; motivo: string }[] {
  const domingoPascua = pascua(anio);
  const restar = (dias: number) => {
    const f = new Date(domingoPascua);
    f.setDate(f.getDate() - dias);
    return f;
  };
  return [
    { fecha: new Date(anio, 0, 1), motivo: "Año Nuevo" },
    { fecha: restar(3), motivo: "Jueves Santo" },
    { fecha: restar(2), motivo: "Viernes Santo" },
    { fecha: new Date(anio, 4, 1), motivo: "Día del Trabajo" },
    { fecha: new Date(anio, 5, 29), motivo: "San Pedro y San Pablo" },
    { fecha: new Date(anio, 6, 28), motivo: "Fiestas Patrias" },
    { fecha: new Date(anio, 6, 29), motivo: "Fiestas Patrias" },
    { fecha: new Date(anio, 7, 30), motivo: "Santa Rosa de Lima" },
    { fecha: new Date(anio, 9, 8), motivo: "Combate de Angamos" },
    { fecha: new Date(anio, 10, 1), motivo: "Todos los Santos" },
    { fecha: new Date(anio, 11, 8), motivo: "Inmaculada Concepción" },
    { fecha: new Date(anio, 11, 25), motivo: "Navidad" },
  ];
}
