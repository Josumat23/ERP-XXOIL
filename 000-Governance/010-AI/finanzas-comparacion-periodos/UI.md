# UI — Pantallas — finanzas-comparacion-periodos

## /finanzas/resultados

- **Tipo:** reporte de detalle, ya existente, extendido
- **Qué muestra ahora:** tabla de 4 columnas (línea, período actual, período de comparación, variación %); detalle de facturas del mes preservado abajo (drill-down a `/comercial/facturas/[id]`).
- **Interacciones nuevas:** dos links "vs. mes anterior" / "vs. mismo mes año anterior" (estado activo resaltado con `boton-primario`); la navegación ←/→ de mes conserva el modo de comparación elegido.
- **Estados visuales:** variación en verde si es favorable, rojo si no, gris "—" si no aplica, "nuevo" si el período de comparación estaba en cero.
- **Navegación:** sin cambios en `src/lib/navegacion.ts` (ruta ya existente).

## /finanzas/rentabilidad

- **Tipo:** reporte de detalle, ya existente, extendido
- **Qué muestra ahora:** 3 tarjetas KPI con variación debajo del valor; ambas tablas (segmento y canal) con columna "vs. anterior" por fila.
- **Interacciones nuevas:** mismo toggle de comparación que en resultados; 3 selects de filtro (Vendedor, Zona, Cliente) que se aplican junto con mes/año al enviar el formulario; link "Limpiar filtros" visible solo cuando hay algún filtro activo; el toggle de comparación y la navegación de período conservan los filtros en la URL.
- **Estados visuales:** mismo esquema de color verde/rojo/gris/"nuevo".
- **Navegación:** sin cambios.
