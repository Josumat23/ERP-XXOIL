export const ANIO_OPERATIVO_MINIMO = 2000;
export const ANIO_OPERATIVO_MAXIMO = 2100;

export function esAnioOperativoValido(anio: number): boolean {
  return (
    Number.isInteger(anio) &&
    anio >= ANIO_OPERATIVO_MINIMO &&
    anio <= ANIO_OPERATIVO_MAXIMO
  );
}

export function esPeriodoMensualValido(anio: number, mes: number): boolean {
  return esAnioOperativoValido(anio) && Number.isInteger(mes) && mes >= 1 && mes <= 12;
}
