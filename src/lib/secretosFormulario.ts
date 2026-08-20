export function resolverSecretoFormulario(
  valor: FormDataEntryValue | null,
  existente: string | null
): string | null {
  if (typeof valor !== "string") return existente;
  return valor.trim() || existente;
}