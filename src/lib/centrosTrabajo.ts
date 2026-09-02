import { TipoCentroTrabajo } from "@/generated/prisma/client";

export const TIPOS_CENTRO_TRABAJO = Object.values(TipoCentroTrabajo);

export function normalizarCodigoCentroTrabajo(valor: unknown): string | null {
  const codigo = String(valor ?? "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(codigo) ? codigo : null;
}

export function esCapacidadCentroTrabajoValida(capacidadHorasDia: number, eficienciaPct: number): boolean {
  return Number.isFinite(capacidadHorasDia) && capacidadHorasDia > 0 && capacidadHorasDia <= 24 &&
    Number.isFinite(eficienciaPct) && eficienciaPct > 0 && eficienciaPct <= 100;
}

export function capacidadEfectivaDiaria(capacidadHorasDia: number, eficienciaPct: number): number {
  return Math.round(capacidadHorasDia * eficienciaPct) / 100;
}
