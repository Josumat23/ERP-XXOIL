# API — Server actions — comercial-embudo-ventas

## `crearCotizacion` (extendida)
- **Archivo:** `src/app/(app)/comercial/cotizaciones/actions.ts`
- **Nuevo campo de formulario:** `probabilidad` (string numérica, 0-100, default 50 si se omite).
- **Validación agregada:** entero, 0 ≤ probabilidad ≤ 100.

## `marcarCotizacion(id, estado)` (extendida)
- Ahora también fija `probabilidad: estado === "ACEPTADA" ? 100 : 0` en el mismo `update`.

## `actualizarProbabilidad(id, prevState, formData)` (nueva)
- **Auth:** `requerirRol(["VENTAS"])` + `puedeRealizar(usuario, "ventas", "editar")`.
- **Parámetros:** `id` (bind), `formData.probabilidad` (entero 0-100).
- **Precondición de negocio:** `Cotizacion.estado === "PENDIENTE"`, si no retorna error.
- **Efecto:** `prisma.cotizacion.update({ where: { id }, data: { probabilidad } })`.
- **Revalida:** `/comercial/cotizaciones/[id]`, `/comercial/cotizaciones`, `/comercial/pipeline`.

## `/comercial/pipeline` (página, solo lectura)
- **Archivo:** `src/app/(app)/comercial/pipeline/page.tsx`
- Sin Server Actions — agrega `prisma.cotizacion.findMany({ where: { estado: "PENDIENTE", validaHasta: { gte: new Date() } } })` y agrupa en memoria por bucket de probabilidad y por vendedor.
