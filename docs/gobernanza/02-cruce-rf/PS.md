# Cruce RF genérico → XXOil: PS (Project System)

**Fuente:** `Requerimientos_Funcionales_SAP_PS.md` (53 RF). **Resultado:** 0 Obligatorio, 0 Deseable, 53 No aplica (M8).

XXOil fabrica y vende un catálogo de productos estándar de forma continua (grasas, aceites, silicona) — no ejecuta proyectos de cliente con estructura de desglose de trabajo (WBS), redes de actividades con relaciones de precedencia, ruta crítica ni liquidación multi-elemento. PS es el módulo "central de integración" de SAP para negocios de ingeniería, construcción o consultoría por proyecto — ninguno de esos es el modelo de negocio de XXOil.

**No se produce tabla RF-por-RF fila por fila para este módulo** porque las 53 filas serían idénticas en su "por qué" (M8) y no aportarían señal — sería ruido puro. Se deja constancia explícita del análisis:

- **Datos maestros y WBS (RF-PS-001 a 007):** no aplica — XXOil no crea "proyectos" con fases/entregables por cliente.
- **Redes de proyecto y actividades (RF-PS-008 a 015):** no aplica — no hay secuenciación de actividades con precedencia que gestionar.
- **Presupuestación (RF-PS-016 a 020):** la necesidad real de "presupuesto vs. real" de XXOil ya está cubierta por el módulo de Centros de Costo (`PresupuestoCentroCosto`), sin necesitar la capa de WBS de PS.
- **Planificación económica, costos e ingresos (RF-PS-021 a 027):** no aplica — no hay "proyecto de venta" que facturar contra hitos o avance; XXOil factura contra pedido estándar.
- **Materiales de proyecto (RF-PS-028 a 031):** no aplica — no hay stock especial de proyecto; el inventario de XXOil es general.
- **Capacidad y recursos (RF-PS-032 a 035):** no aplica — no hay asignación de personal a actividades de proyecto.
- **Gestión documental (RF-PS-036, 037):** no aplica como capacidad de PS; los adjuntos de XXOil (`Adjunto`) ya cubren la necesidad genérica de vincular documentos a cualquier entidad.
- **Sistema de información de proyectos (RF-PS-038 a 042):** no aplica — no hay proyectos que reportar.
- **Integración (RF-PS-043 a 049):** no aplica.
- **Transversales (RF-PS-050 a 053):** no aplica.

**Única excepción a vigilar (pregunta abierta, ver Paso 4):** si XXOil alguna vez ejecuta una obra de capital propio de gran envergadura (ej. ampliación de planta, nueva línea de envasado) que amerite seguimiento de presupuesto de inversión con fases, eso sería un caso de uso puntual y aislado — no justifica construir PS completo, se resolvería con una hoja de cálculo de apoyo o, como mucho, extendiendo `PresupuestoCentroCosto`/`ActivoFijo` (ya existentes) para ese caso concreto cuando ocurra.

**Resumen:** de 53 RF, **53 no aplican**. Módulo descartado en su totalidad para el horizonte de este documento.
