# CU — Casos de uso — finanzas-comparacion-periodos

## CU-COMP-001 — Ver el estado de resultados con comparación

- **Actor:** GERENCIA, ADMIN (cualquier rol con acceso a `/finanzas/resultados`)
- **Precondición:** ninguna — funciona incluso sin facturas (todo en 0/"—")
- **Flujo principal:**
  1. El usuario abre `/finanzas/resultados`.
  2. Por defecto ve el mes actual comparado contra el mes calendario anterior.
  3. Elige "vs. mismo mes año anterior" para cambiar el modo de comparación.
  4. Navega con ← / → a otros meses; el modo de comparación elegido se mantiene en la URL.
- **Flujos alternativos:**
  - Sin ventas en el período actual → todas las filas en S/ 0.00, variación "—".
  - Período de comparación sin ventas pero actual con ventas → variación "nuevo".
- **Postcondición:** el usuario ve la variación línea por línea sin tener que abrir dos pestañas o anotar números a mano.

## CU-COMP-002 — Ver rentabilidad con variación por segmento/canal

- **Actor:** GERENCIA, ADMIN (acceso a `/finanzas/rentabilidad`)
- **Precondición:** ninguna
- **Flujo principal:**
  1. El usuario abre `/finanzas/rentabilidad`, elige mes/año con el selector existente.
  2. Ve 3 KPIs (ventas, costo, margen) con su variación vs. período anterior.
  3. Ve las tablas por segmento y por canal, cada fila con su columna "vs. anterior".
- **Postcondición:** el usuario identifica qué segmento/canal mejoró o empeoró sin calcular a mano.
