// Etiquetas del rol organizativo del almacén.
//
// Módulo aparte de `@/lib/almacenes` a propósito: aquél importa Prisma, así
// que un componente cliente no puede usarlo. Y tampoco puede vivir dentro del
// componente cliente de la pantalla: si un Server Component importa un valor
// desde un módulo `"use client"`, recibe una referencia de cliente en lugar
// del objeto, y cualquier acceso a sus propiedades devuelve `undefined` — sin
// error de TypeScript, sin fallo de build, y visible solo en pantalla.
export const ETIQUETA_TIPO_ALMACEN: Record<string, string> = {
  PLANTA: "Planta",
  ALMACEN_DISTRIBUCION: "Almacén de distribución",
  ALMACEN_TRANSITO: "Almacén de tránsito",
};
