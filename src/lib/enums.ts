export function esValorEnum<T extends string>(
  valores: readonly T[],
  valor: string
): valor is T {
  return valores.some((permitido) => permitido === valor);
}