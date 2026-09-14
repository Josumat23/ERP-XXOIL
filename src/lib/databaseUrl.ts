// De dónde sale la base, en un solo lugar.
//
// Cada punto de entrada que corre en su propio proceso —el servidor, los
// sembradores, el respaldo— necesita resolver `DATABASE_URL`, y hasta el
// 2026-09-14 cada uno lo hacía por su cuenta con la misma línea:
//
//     process.env.DATABASE_URL ?? "file:./dev.db"
//
// Ese nombre es, en la copia de trabajo original, una base PROTEGIDA. El
// valor por defecto convertía el olvido de configurar en una escritura
// silenciosa sobre la base que no se debe tocar: `npm run seed:demo` habría
// volcado seis meses de datos inventados ahí dentro sin decir nada.
//
// Adivinar la base es peor que no arrancar. Quien olvida configurarla ve un
// error inmediato que dice qué hacer.

export const MENSAJE_SIN_BASE =
  "Falta DATABASE_URL. Defínala en `.env` (por ejemplo `file:./local.db`) o en el " +
  "entorno del proceso. No hay base por defecto: adivinarla puede escribir en la " +
  "base equivocada.";

/** La URL configurada, o un error que dice qué configurar. Nunca un supuesto. */
export function urlBaseRequerida(url: string | undefined = process.env.DATABASE_URL): string {
  if (!url || url.trim() === "") throw new Error(MENSAJE_SIN_BASE);
  return url;
}
