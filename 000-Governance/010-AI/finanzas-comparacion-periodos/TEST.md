# TEST — Verificación — finanzas-comparacion-periodos

## Escenario 1 — Comparación con datos reales, modo "mes anterior"
- **Datos usados:** 2 facturas sintéticas insertadas por SQL (`F-TEST-AGO`: S/125 en agosto 2026; `F-TEST-JUL`: S/75 en julio 2026, mismo cliente/presentación, costoUnitario 5).
- **Pasos:** `GET /finanzas/resultados?mes=2026-08&comparar=mes`.
- **Resultado esperado:** Ventas facturadas 125 vs 75, variación +66.7%; costo -50 vs -30, variación -66.7% (rojo, porque el gasto subió); utilidad operativa 75 vs 45, +66.7%.
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 2 — Mismo dato, modo "mismo mes año anterior"
- **Pasos:** `GET /finanzas/resultados?mes=2026-08&comparar=anio`.
- **Resultado esperado:** compara contra agosto 2025 (sin datos) → variación "nuevo" en las filas con valor actual positivo.
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 3 — Rentabilidad con los mismos datos
- **Pasos:** `GET /finanzas/rentabilidad?anio=2026&mes=8&comparar=mes`.
- **Resultado esperado:** KPIs y fila "Sin segmento asignado" / "Sin canal asignado" (producto de prueba sin segmento/canal configurado) muestran +66.7% consistente con resultados.
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 4 — Sin datos (estado real de la base antes/después de la prueba)
- **Pasos:** `GET /finanzas/resultados` y `/finanzas/rentabilidad` sin facturas en la base.
- **Resultado esperado:** todo en S/ 0.00, variación "—", sin errores de consola.
- **Resultado obtenido:** exacto a lo esperado.

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios (confirmado antes y después).

## Datos de prueba a limpiar
- 2 facturas (`F-TEST-AGO`, `F-TEST-JUL`) + sus `Pedido`/`PedidoDetalle` asociados, insertados y eliminados directo por SQL. Confirmado post-limpieza: 0 facturas, 0 pedidos en la base (estado previo a la prueba).
