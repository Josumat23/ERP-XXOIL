export type TramosSobretiempo = {
  minutos: number;
  minutosPrimerTramo: number;
  minutosSegundoTramo: number;
  importePrimerTramo: number;
  importeSegundoTramo: number;
  total: number;
};

export function calcularPagoSobretiempoDiario(
  remuneracionMensual: number,
  minutosSobretiempo: number,
  politica: { horasJornadaDiaria: number; primerasHorasRecargo: number; recargoPrimerTramo: number; recargoSegundoTramo: number }
): TramosSobretiempo | null {
  const valores = [remuneracionMensual, minutosSobretiempo, politica.horasJornadaDiaria, politica.primerasHorasRecargo, politica.recargoPrimerTramo, politica.recargoSegundoTramo];
  if (valores.some((valor) => !Number.isFinite(valor) || valor < 0) || remuneracionMensual <= 0 || politica.horasJornadaDiaria <= 0) return null;
  const limitePrimerTramo = Math.round(politica.primerasHorasRecargo * 60);
  const minutosPrimerTramo = Math.min(minutosSobretiempo, limitePrimerTramo);
  const minutosSegundoTramo = Math.max(0, minutosSobretiempo - limitePrimerTramo);
  const valorHora = remuneracionMensual / 30 / politica.horasJornadaDiaria;
  const importePrimerTramo = valorHora * (minutosPrimerTramo / 60) * (1 + politica.recargoPrimerTramo / 100);
  const importeSegundoTramo = valorHora * (minutosSegundoTramo / 60) * (1 + politica.recargoSegundoTramo / 100);
  const redondear = (valor: number) => Math.round(valor * 100) / 100;
  return { minutos: minutosSobretiempo, minutosPrimerTramo, minutosSegundoTramo, importePrimerTramo: redondear(importePrimerTramo), importeSegundoTramo: redondear(importeSegundoTramo), total: redondear(importePrimerTramo + importeSegundoTramo) };
}
