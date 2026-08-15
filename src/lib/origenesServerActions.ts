const ORIGENES_DESARROLLO = ["*.app.github.dev", "localhost:3000"];

export function obtenerOrigenesServerActions(entorno: NodeJS.ProcessEnv): string[] {
  const configurados = entorno.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);

  if (configurados?.length) return [...new Set(configurados)];
  return entorno.NODE_ENV === "development" ? ORIGENES_DESARROLLO : [];
}