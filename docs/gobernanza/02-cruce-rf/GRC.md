# Cruce RF genérico → XXOil: GRC (Governance, Risk and Compliance)

**Fuente:** `Requerimientos_Funcionales_SAP_GRC.md` (49 RF). **Resultado:** 0 Obligatorio, 3 Parcial (cubiertos informalmente por seguridad/auditoría ya construida), 46 No aplica.

XXOil no tiene comité de auditoría, no cotiza en bolsa, no está sujeta a SOX ni regulación equivalente, y no tiene un área de Riesgos/Cumplimiento dedicada. GRC completo (M2) no aplica hoy ni en el horizonte de 3 fases de este documento. Lo único real y ya presente es segregación de funciones básica (grupos de seguridad) y trazabilidad de auditoría (usuarioId/usuarioNombre/fecha en cada transacción), que cubren el *espíritu* mínimo de GRC-AC sin el aparataje de SAP.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-GRC-001 a 005 (matriz SoD, análisis de conflictos, simulación, reportes, clasificación) | No | M2 — no hay volumen de roles/usuarios que justifique un motor de análisis SoD; los conflictos se previenen a mano en el diseño de los ~5 roles existentes | — | No existe |
| RF-GRC-006 (diseño centralizado de roles) | Parcial | Ya existe `GrupoSeguridad`+`PermisoGrupo`, pero sin el aparataje de "diseño y documentación" formal de SAP | Baja | `GrupoSeguridad`/`PermisoGrupo` (M11) |
| RF-GRC-007, 008 (workflow de solicitud/aprobación de acceso con validación SoD) | No | M2 — el alta de usuario la hace un ADMIN directo, no hay volumen para justificar un flujo de aprobación de accesos | — | No existe |
| RF-GRC-009 (certificación periódica de accesos) | No | M2 | — | No existe |
| RF-GRC-010 (acceso de emergencia/firefighter) | No | M2 — no hay superusuarios temporales; el rol ADMIN es permanente y limitado a 1-2 personas | — | No existe |
| RF-GRC-011 (desactivación automática de accesos por baja) | Parcial | Necesidad real y pequeña (dar de baja `Usuario.activo` al desvincular empleado); no requiere GRC-AC, es una acción manual de 1 clic | Media (mejora simple, no GRC) | `Usuario.activo` existe; el vínculo automático con baja de `Empleado` no |
| RF-GRC-012 a 014 (controles de mitigación de riesgo de acceso) | No | M2 | — | No existe |
| RF-GRC-015 a 023 (marco de control interno, monitoreo continuo, autoevaluación, deficiencias, efectividad) | No | M2 — no hay función de Auditoría Interna ni obligación normativa que lo exija | — | No existe |
| RF-GRC-024 a 030 (Risk Management formal: registro de riesgos, heat map, KRI) | No | M2 — la gestión de riesgo hoy es informal (gerencia general), correcto para el tamaño de la empresa | — | No existe |
| RF-GRC-031 a 035 (Audit Management: plan anual, papeles de trabajo, hallazgos) | No | M2 | — | No existe |
| RF-GRC-036 a 038 (Fraud Management: detección de patrones, alertas, investigación) | No | M2 — el control de fraude hoy pasa por segregación de funciones (aprobación de pagos por monto, ya construida) | — | Cubierto indirectamente por `PagoProveedor.estadoAprobacion` (M11) |
| RF-GRC-039 a 041 (dashboard GRC, reportes de cumplimiento, extracción a BI) | No | M2 + M7 | — | No existe |
| RF-GRC-042 a 045 (integración con gestión de usuarios, HCM, procesos transaccionales) | No | M2 — no hay GRC con quien integrar | — | No existe |
| RF-GRC-046 (restringir acceso a config. de GRC) | No | M2 | — | No existe |
| RF-GRC-047 (trazabilidad de decisiones GRC) | Parcial | El *patrón* de trazabilidad (usuarioId/usuarioNombre/fecha, aprobadoPor/aprobadoEn) ya es transversal a todo el sistema, aunque no exista GRC formal | — | Patrón ya aplicado en Pedido, Factura, PagoProveedor, OrdenCompra, etc. (M11) |
| RF-GRC-048 (no eliminar físicamente registros de auditoría cerrados) | Parcial | Ya es el patrón general del sistema (anular, no borrar) para las entidades transaccionales | — | Aplicado en Factura (anulación), AsientoContable (reversión), Pedido (anulación) (M11) |
| RF-GRC-049 (multi-idioma/multi-jurisdicción) | No | XXOil opera solo en Perú, en español | — | No existe |

**Resumen:** de 49 RF, **46 no aplican**, **3 son parciales** y ya están informalmente cubiertos por el sistema de seguridad y el patrón de auditoría transversal que XXOil ya tiene — no ameritan construir un "módulo GRC", solo consolidar lo que ya existe de forma dispersa si se documenta formalmente más adelante (Fase 3+).
