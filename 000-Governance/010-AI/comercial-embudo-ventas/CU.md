# CU — Casos de uso — comercial-embudo-ventas

## CU-EMB-001 — Crear cotización con probabilidad estimada
- **Actor:** VENTAS
- **Flujo:** al crear la cotización en `/comercial/cotizaciones/nuevo`, ajusta el slider de probabilidad (default 50%) antes de enviar.
- **Postcondición:** la cotización nace con esa probabilidad; aparece en el pipeline si queda PENDIENTE.

## CU-EMB-002 — Ajustar probabilidad mientras se negocia
- **Actor:** VENTAS
- **Precondición:** cotización en estado PENDIENTE y vigente.
- **Flujo:** desde el detalle de la cotización, mueve el slider y confirma "Actualizar probabilidad".
- **Postcondición:** el pipeline refleja el nuevo valor ponderado inmediatamente.

## CU-EMB-003 — Ver el embudo de ventas
- **Actor:** VENTAS, GERENCIA
- **Flujo:** abre `/comercial/pipeline`, ve el total y valor ponderado del pipeline, desglosado por rango de probabilidad y por vendedor, y la lista completa ordenada por valor ponderado descendente.
- **Postcondición:** Gerencia identifica qué vendedor tiene más pipeline "caliente" sin tener que abrir cada cotización.

## CU-EMB-004 — Cierre real fija la probabilidad
- **Actor:** VENTAS
- **Flujo:** marca la cotización como aceptada o rechazada (flujo ya existente).
- **Postcondición:** la probabilidad pasa a 100% o 0% automáticamente, sin acción manual adicional.
