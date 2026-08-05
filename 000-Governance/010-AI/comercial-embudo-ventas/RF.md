# RF — Requisitos funcionales — comercial-embudo-ventas

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-CRM-014-001 | Cada `Cotizacion` debe tener una probabilidad de cierre estimada (0-100%), editable por el vendedor mientras esté PENDIENTE. | Media | Construido y verificado |
| RF-CRM-014-002 | Al aceptar o rechazar una cotización, la probabilidad debe fijarse automáticamente a 100% o 0% (deja de ser estimación, es resultado). | Media | Construido y verificado |
| RF-CRM-014-003 | Debe existir una vista de embudo de ventas (`/comercial/pipeline`) que agregue las cotizaciones pendientes vigentes por rango de probabilidad y por vendedor, mostrando el total y el valor ponderado (total × probabilidad). | Media | Construido y verificado |

## Notas
- Origen: `docs/gobernanza/02-cruce-rf/CRM.md`, RF-CRM-014 — "oportunidades con etapa/probabilidad/monto". El propio documento concluye que `Cotizacion` ya cumple el 80% del propósito de una "oportunidad" y que construir un objeto `Oportunidad` separado sería duplicación — se extendió `Cotizacion` en vez de crear un modelo nuevo.
