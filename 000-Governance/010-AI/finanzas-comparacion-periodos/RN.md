# RN — Reglas de negocio — finanzas-comparacion-periodos

| ID | Regla | Por qué |
|---|---|---|
| RN-COMP-001 | La variación % se calcula como `(actual - anterior) / |anterior|`. Si el período anterior es 0 y el actual no, se muestra "nuevo" en vez de un porcentaje infinito. Si ambos son 0, se muestra "—". | Evitar `Infinity`/`NaN` en pantalla; un período sin actividad previa no tiene una "variación porcentual" con sentido. |
| RN-COMP-002 | Para líneas de gasto (costo de ventas, gastos operativos), la variación se calcula sobre el valor negado (`-actual`, `-anterior`) antes de determinar el color. | Un aumento en un gasto es semánticamente negativo aunque el número absoluto "suba" — el color rojo/verde debe reflejar si es favorable para el negocio, no solo el signo aritmético. |
| RN-COMP-003 | En Rentabilidad, si un segmento/canal existe en el período actual pero no en el anterior (o viceversa), igual aparece en la tabla combinada, con el valor faltante en 0. | No ocultar una categoría nueva o discontinuada — es información relevante, no un error de datos. |

## Casos borde considerados
- Período de comparación completamente sin facturas (ver RN-COMP-001).
- Categoría (segmento/canal) presente solo en uno de los dos períodos.
- Costo de ventas que sube (variación debe mostrarse en rojo, no verde).
