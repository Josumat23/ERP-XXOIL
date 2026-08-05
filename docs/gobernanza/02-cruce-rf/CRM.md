# Cruce RF genérico → XXOil: CRM (Customer Relationship Management)

**Actualización (2026-08-05):** el gap deseable RF-CRM-014 (embudo de ventas con probabilidad/etapa) se construyó — ver `000-Governance/010-AI/comercial-embudo-ventas/`. Se extendió `Cotizacion` con `probabilidad`, sin crear un modelo `Oportunidad` separado, tal como recomendaba este documento. El resto del análisis abajo (recordatorios de actividad, contratos marco, marketing formal, servicio técnico) sigue vigente sin cambios.

**Fuente:** `Requerimientos_Funcionales_SAP_CRM.md` (55 RF). **Resultado:** 5 Obligatorio (todos ya cubiertos o cubiertos por el gap de SD), 3 Deseable, 47 No aplica/vive en SD.

Regla de filtrado del usuario: CRM vive dentro de Comercial (SD), no como módulo aparte. Verificado: XXOil ya tiene `Cliente`, `Vendedor`, `Zona`, `HojaRuta`+`HojaRutaVisita` (visitas de campo del vendedor con objetivo/resultado — esto es, literalmente, la funcionalidad de "ventas de campo" de CRM-SLS, RF-CRM-020, ya construida sin llamarse CRM). Lo que falta y sí tiene valor real es un **embudo de ventas simple** (`Cotizacion` ya existe como preventa, pero no tiene etapa/probabilidad) — bajo prioridad dado el volumen de 4 vendedores.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-CRM-001 a 006 (Business Partner con roles múltiples, sincronización, segmentación, histórico de interacciones) | Parcial | `Cliente` ya cubre datos generales/canal (segmentación); no hay concepto de "Business Partner" multi-rol porque XXOil no necesita esa abstracción (un cliente es un cliente) | — | `Cliente` (M6, M11 parcial) |
| RF-CRM-007 a 013 (marketing: campañas, segmentos, multicanal, leads, ROI, calendario) | No | XXOil no tiene función de marketing formal — Lima "en conquista de mercado" se maneja hoy por decisión comercial directa, no campañas estructuradas | Fase 3+ | No existe |
| RF-CRM-014 (oportunidades con etapa/probabilidad/monto) | Deseable | Sería útil para que Gerencia vea el pipeline de las 4 zonas, pero con 4 vendedores el seguimiento manual es viable hoy; `Cotizacion` ya cumple el 80% del propósito sin el aparataje de "oportunidad" previo | Media | `Cotizacion` cubre el tramo final (M6 parcial) |
| RF-CRM-015 (asignación de oportunidad a vendedor) | Sí (ya hecho) | `Vendedor` ya está vinculado a `Zona` y a cada `Cliente`/`Pedido` | **Obligatorio (ya hecho)** | `Vendedor`, `Cliente.vendedorId` (M11) |
| RF-CRM-016, 017 (cotización→pedido sin reingreso, integrado a disponibilidad/facturación) | Sí (ya hecho) | Es exactamente el flujo Cotización→Pedido→Factura ya construido | **Obligatorio (ya hecho)** | `Cotizacion`→`Pedido`→`Factura` (M11) |
| RF-CRM-018, 019 (pipeline visual, forecast de ventas) | No | Fase futura — bajo volumen de vendedores no justifica un dashboard de pipeline dedicado todavía | Fase 3+ | Parcialmente cubierto por `Proyeccion` (comercial) |
| RF-CRM-020 (ventas de campo con visitas desde móvil) | Sí (ya hecho) | Es literalmente `HojaRuta`+`HojaRutaVisita` | **Obligatorio (ya hecho)** | `HojaRuta`, `HojaRutaVisita` (M11) |
| RF-CRM-021 (actividades comerciales con recordatorios) | Deseable | Los recordatorios automáticos (ej. "llamar en 3 días") no existen; hoy la gestión de seguimiento es manual | Baja | No existe |
| RF-CRM-022 (territorios de venta con asignación automática) | Sí (ya hecho) | `Zona` ya cumple este rol para las 4 zonas de venta | **Obligatorio (ya hecho)** | `Zona` (M11) |
| RF-CRM-023 (contratos marco con clientes) | No | XXOil vende bajo condición estándar (contado/15/30), no maneja contratos marco de precio fijo por volumen anual todavía | Fase 3+ | No existe |
| RF-CRM-024 a 033 (servicio al cliente: tickets, escalación, órdenes de servicio, garantías, SLA, encuestas) | No | XXOil vende producto, no servicio técnico postventa con SLA — no aplica el concepto de "ticket" | — | No aplica |
| RF-CRM-034 a 037 (Interaction Center: interfaz unificada de agente, CTI, enrutamiento) | No | Escala de call center — XXOil no tiene un centro de atención telefónica | — | No aplica |
| RF-CRM-038 a 040 (e-commerce B2B/B2C, autoservicio de cliente) | No | Fase futura — XXOil vende por fuerza de venta de campo, no canal online; podría evaluarse a futuro para conquista de Lima | Fase 3+ | No existe |
| RF-CRM-041 a 045 (CRM Analytics: pipeline, campañas, servicio, satisfacción, extracción BI) | No | M7 + depende de módulos que no existen (campañas, tickets) | Fase 3+ | No existe |
| RF-CRM-046 a 050 (integración con SD, sincronización de maestros, FI, MM, CO) | No | No aplica separar CRM de SD — es el mismo sistema, no hay "sincronización" que hacer entre dos sistemas distintos | — | No aplica (ya es un solo sistema) |
| RF-CRM-051 a 055 (transversales: SoD por territorio, trazabilidad lead→factura→servicio, no eliminación física, protección de datos, multi-idioma) | Parcial | La trazabilidad Cotización→Pedido→Factura→Cobro ya existe; no hay "servicio postventa" que trazar | — | M11 parcial |

**Resumen:** de 55 RF, **5 ya están cubiertos** (viven en Comercial/SD, tal como pidió el usuario), **3 son deseables de fase 2** (embudo de ventas con etapa/probabilidad, recordatorios de actividad, contratos marco), y **47 no aplican** (marketing formal, servicio técnico con SLA, call center, e-commerce) por ser funciones que XXOil no tiene como área ni necesita a este tamaño.
