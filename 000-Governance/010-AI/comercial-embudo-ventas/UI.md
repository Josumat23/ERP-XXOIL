# UI — Pantallas — comercial-embudo-ventas

## `/comercial/cotizaciones/nuevo`
- Slider de probabilidad (0-100%, paso 5) con etiqueta en vivo, default 50%.

## `/comercial/cotizaciones/[id]`
- Muestra "Probabilidad de cierre: X% · Valor ponderado: S/ Y" bajo el encabezado.
- Formulario de ajuste (slider + botón) visible solo si `puedeGestionar` (PENDIENTE y no vencida) — mismo criterio que los botones de aceptar/rechazar existentes.

## `/comercial/cotizaciones` (lista)
- Nuevas columnas "Prob." y "Valor ponderado".
- Botón "Embudo de ventas" en el header, junto a Imprimir.

## `/comercial/pipeline` (nueva)
- 3 tarjetas KPI: cotizaciones en pipeline, total, valor ponderado.
- Barra `BarraRanking` por rango de probabilidad (4 buckets: 0-25, 26-50, 51-75, 76-100).
- Barra `BarraRanking` por vendedor, ordenado por valor ponderado descendente.
- Tabla detallada ordenada por valor ponderado descendente, con link a cada cotización.

## Navegación
- `src/lib/navegacion.ts`: nuevo enlace "Embudo de ventas" bajo Ventas, junto a Cotizaciones.
- `src/app/(app)/reportes/page.tsx`: nueva entrada en la categoría Comercial.
