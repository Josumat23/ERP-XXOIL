# API — Server actions — finanzas-comparacion-periodos

Esta funcionalidad es de solo lectura (páginas Server Component con `searchParams`), no agrega
Server Actions nuevas. La "API" real es el contrato de query params de cada página.

## `/finanzas/resultados`

- **Archivo:** `src/app/(app)/finanzas/resultados/page.tsx`
- **Query params:** `mes` (`YYYY-MM`, opcional, default mes actual), `comparar` (`"mes" | "anio"`, opcional, default `"mes"`).
- **Función interna clave:** `calcularResultados(inicio: Date, fin: Date): Promise<Resultado>` — se llama dos veces (período actual y de comparación) con el mismo query subyacente que ya existía.
- **Efectos secundarios:** ninguno (solo lectura).

## `/finanzas/rentabilidad`

- **Archivo:** `src/app/(app)/finanzas/rentabilidad/page.tsx`
- **Query params:** `anio`, `mes` (numéricos, opcionales, default período actual), `comparar` (`"mes" | "anio"`, opcional, default `"mes"`).
- **Función interna clave:** `calcularAgregados(desde: Date, hasta: Date)` — misma idea, llamada dos veces.
- **Efectos secundarios:** ninguno (solo lectura).
