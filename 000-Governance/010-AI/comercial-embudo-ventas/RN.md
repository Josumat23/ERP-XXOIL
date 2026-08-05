# RN — Reglas de negocio — comercial-embudo-ventas

| ID | Regla | Por qué |
|---|---|---|
| RN-EMB-001 | La probabilidad solo se puede editar mientras `Cotizacion.estado === "PENDIENTE"`. Aceptada/Rechazada/Vencida/Convertida no la aceptan. | El embudo describe incertidumbre; una vez resuelta la cotización (en cualquier sentido) ya no hay nada que estimar. |
| RN-EMB-002 | `marcarCotizacion(id, "ACEPTADA")` fija `probabilidad = 100`; `marcarCotizacion(id, "RECHAZADA")` fija `probabilidad = 0`. | El resultado real siempre es más confiable que la última estimación manual — evita que quede una cotización "Aceptada" con probabilidad histórica de 40%, que confundiría cualquier reporte que sume valor ponderado. |
| RN-EMB-003 | El pipeline (`/comercial/pipeline`) solo incluye cotizaciones `PENDIENTE` con `validaHasta >= hoy` — una cotización vencida no cuenta como oportunidad real, aunque técnicamente su `estado` en base siga en PENDIENTE hasta que alguien la gestione. | Evitar inflar el pipeline con cotizaciones que en la práctica ya no son accionables. |
| RN-EMB-004 | El valor ponderado se calcula como `total × (probabilidad / 100)`, redondeado por `formatMoneda` al mostrarse — no se persiste como columna, se calcula al vuelo. | Es un dato derivado; persistirlo arriesgaría desincronizarlo si `total` o `probabilidad` cambian sin recalcularlo. |

## Casos borde considerados
- Probabilidad fuera de rango (validado 0-100 entero, tanto en creación como en actualización).
- Cotización sin cambios de probabilidad manual (queda en el default 50%).
