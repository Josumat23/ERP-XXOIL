# RF — Requisitos funcionales — proyectos

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-PS-EXC-001 | Debe existir un objeto `Proyecto` con código correlativo, nombre, presupuesto total, fechas planificadas/reales, responsable y estado (Planificado/En progreso/Cerrado/Cancelado). | Alta | Construido y verificado |
| RF-PS-EXC-002 | Un proyecto debe soportar una WBS (Estructura de Desglose del Trabajo) multinivel: fases y subfases con código jerárquico (1, 1.1, 1.1.1...) y presupuesto informativo por fase. | Alta | Construido y verificado |
| RF-PS-EXC-003 | Cada fase debe soportar actividades con duración en días, responsable y equipo opcionales. | Alta | Construido y verificado |
| RF-PS-EXC-004 | Las actividades deben soportar precedencias Fin-a-Inicio entre sí, sin permitir ciclos. | Alta | Construido y verificado |
| RF-PS-EXC-005 | El sistema debe calcular automáticamente, con cada cambio a la red, la ruta crítica (Método de la Ruta Crítica — CPM): fecha de inicio/fin planificada, si la actividad es crítica y su holgura en días. | Alta | Construido y verificado |
| RF-PS-EXC-006 | El proyecto debe acumular costo real desde dos fuentes sin doble registro: un ledger manual de costos y las Órdenes de Compra etiquetadas al proyecto/fase. | Alta | Construido y verificado |
| RF-PS-EXC-007 | Al finalizar, el proyecto debe poder capitalizarse como un Activo Fijo, con el costo real acumulado sugerido como costo de adquisición (editable). | Alta | Construido y verificado |

## Notas
- Origen: `docs/gobernanza/02-cruce-rf/PS.md` — el módulo completo fue descartado (53/53 RF no aplican) por no tener caso de uso, dejando una única excepción documentada a vigilar: una obra de capital propio de gran envergadura. El usuario confirmó esa excepción (ampliación de planta próxima + otros proyectos) y pidió expresamente gestión completa (WBS + ruta crítica + integración), no la salida mínima ("hoja de cálculo de apoyo") que el propio documento sugería como piso.
- Alcance deliberadamente acotado frente al PS completo de SAP — ver `RN.md` para las exclusiones explícitas.
