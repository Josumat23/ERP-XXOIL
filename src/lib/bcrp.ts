// Integración best-effort con el API público del BCRP (Banco Central de
// Reserva del Perú): https://estadisticas.bcrp.gob.pe — igual que la
// contabilización automática, si el servicio falla o cambia de código,
// la proyección sigue funcionando solo sin el factor macro (no bloquea).
//
// Códigos de serie (verificar en estadisticas.bcrp.gob.pe si dejan de
// responder — el BCRP puede reordenar/renombrar series):
//   PN01722AM: PBI Manufactura no primaria, var. % interanual
//   PN01273PM: IPC, var. % interanual (inflación)
//   PN01246PM: Tipo de cambio nominal promedio (S/ por US$)

const SERIES = {
  pbiManufactura: "PN01722AM",
  inflacion: "PN01273PM",
  tipoCambio: "PN01246PM",
} as const;

type RespuestaBcrp = {
  periods?: { name: string; values: (string | null)[] }[];
};

function mesAnio(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

async function obtenerUltimoValor(codigo: string): Promise<number | null> {
  const hoy = new Date();
  const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1);
  const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${codigo}/json/${mesAnio(haceUnAnio)}/${mesAnio(hoy)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const datos: RespuestaBcrp = await res.json();
    const periodos = datos.periods ?? [];
    for (let i = periodos.length - 1; i >= 0; i--) {
      const valor = periodos[i].values?.[0];
      if (valor !== null && valor !== undefined && valor !== "n.d.") {
        const num = Number(valor);
        if (Number.isFinite(num)) return num;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type FactorMacro = {
  pbiManufacturaVar: number | null;
  inflacionVar: number | null;
  tipoCambio: number | null;
};

// Best-effort: si el BCRP no responde (caído, cambió de código, sin
// internet), devuelve null en cada campo en vez de fallar la proyección.
export async function obtenerFactorMacro(): Promise<FactorMacro> {
  const [pbiManufacturaVar, inflacionVar, tipoCambio] = await Promise.all([
    obtenerUltimoValor(SERIES.pbiManufactura),
    obtenerUltimoValor(SERIES.inflacion),
    obtenerUltimoValor(SERIES.tipoCambio),
  ]);
  return { pbiManufacturaVar, inflacionVar, tipoCambio };
}
