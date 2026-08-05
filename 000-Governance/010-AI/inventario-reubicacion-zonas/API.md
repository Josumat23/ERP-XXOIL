# API — Server actions — inventario-reubicacion-zonas

## `reubicarZona(prevState, formData)` (nueva)
- **Archivo:** `src/app/(app)/inventario/traslados/actions.ts`
- **Auth:** `requerirRol(["ALMACEN"])` + `puedeRealizar(usuario, "materiales", "editar")`.
- **Parámetros de formulario:**
  - `item`: string compuesto `"PRESENTACION:<id>"` o `"INSUMO:<id>"`.
  - `zonaDestinoId`: id de `ZonaAlmacen`.
- **Validaciones:**
  1. `item` bien formado y de tipo válido.
  2. `zonaDestinoId` no vacío y existe.
  3. Si el ítem tiene `zonaAlmacenId` actual, su `almacenId` debe coincidir con el de la zona destino.
  4. No debe ser la misma zona actual.
- **Efecto:** `prisma.presentacion.update` o `prisma.insumo.update` con `data: { zonaAlmacenId }` (sin transacción — es una sola escritura).
- **Revalida:** `/inventario/traslados`.
