export type LineaAsientoManual = {
  cuentaId: string;
  glosa: string;
  debe: number;
  haber: number;
};

function redondearImporte(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function normalizarLineasAsientoManual(valor: unknown): LineaAsientoManual[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaAsientoManual[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("cuentaId" in candidata) ||
      !("glosa" in candidata) ||
      !("debe" in candidata) ||
      !("haber" in candidata) ||
      typeof candidata.cuentaId !== "string" ||
      typeof candidata.glosa !== "string" ||
      typeof candidata.debe !== "number" ||
      typeof candidata.haber !== "number" ||
      !Number.isFinite(candidata.debe) ||
      !Number.isFinite(candidata.haber) ||
      candidata.debe < 0 ||
      candidata.haber < 0
    ) {
      return null;
    }

    lineas.push({
      cuentaId: candidata.cuentaId,
      glosa: candidata.glosa,
      debe: redondearImporte(candidata.debe),
      haber: redondearImporte(candidata.haber),
    });
  }

  return lineas;
}

export function crearFechaAsientoManual(valor: string): Date | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!coincidencia) return null;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }

  return fecha;
}
