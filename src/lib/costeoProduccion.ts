export type EntradaVariacionProduccion = {
  kgObjetivo: number;
  kgProducidos: number;
  costoEstandarInsumos: number;
  costoEstandarManoObra: number;
  costoRealInsumos: number;
  costoRealManoObra: number;
  costoReproceso?: number;
};

export type VariacionProduccion = {
  costoEstandarTotal: number;
  costoEstandarPermitido: number;
  variacionInsumos: number;
  variacionManoObra: number;
  variacionRendimiento: number;
  variacionTotal: number;
};

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function calcularVariacionProduccion(entrada: EntradaVariacionProduccion): VariacionProduccion | null {
  const valores = Object.values(entrada);
  if (valores.some((valor) => !Number.isFinite(valor)) || entrada.kgObjetivo <= 0 || entrada.kgProducidos <= 0) {
    return null;
  }
  if (
    entrada.costoEstandarInsumos < 0 ||
    entrada.costoEstandarManoObra < 0 ||
    entrada.costoRealInsumos < 0 ||
    entrada.costoRealManoObra < 0 ||
    (entrada.costoReproceso ?? 0) < 0
  ) return null;

  const costoEstandarTotal = redondear(entrada.costoEstandarInsumos + entrada.costoEstandarManoObra);
  const costoEstandarPermitido = redondear(costoEstandarTotal * entrada.kgProducidos / entrada.kgObjetivo);
  const variacionInsumos = redondear(entrada.costoRealInsumos + (entrada.costoReproceso ?? 0) - entrada.costoEstandarInsumos);
  const variacionManoObra = redondear(entrada.costoRealManoObra - entrada.costoEstandarManoObra);
  const variacionRendimiento = redondear(costoEstandarTotal - costoEstandarPermitido);
  const variacionTotal = redondear(variacionInsumos + variacionManoObra + variacionRendimiento);
  return { costoEstandarTotal, costoEstandarPermitido, variacionInsumos, variacionManoObra, variacionRendimiento, variacionTotal };
}