# Aislamiento multiempresa de maestros financieros

Este bloque completa el aislamiento de activos fijos, depreciación, centros de costo y órdenes internas.

## Alcance

- Listados, detalles y formularios filtran almacenes, centros, proyectos, activos y órdenes por empresa activa.
- Altas, bajas, ventas y depreciaciones de activos validan la empresa antes de escribir.
- La venta de activos registra caja y contabilidad en la empresa propietaria.
- Presupuestos, jerarquías, reglas de prorrateo, asignaciones y reclasificaciones validan centros de la empresa activa.
- Las órdenes internas y sus costos, liquidaciones y anulaciones quedan protegidos contra identificadores de otra empresa.
- La tarea mensual de depreciación recorre separadamente todas las empresas activas.

Las reglas de prorrateo no tienen `empresaId` propio en el esquema actual; su pertenencia se determina por los centros incluidos y los controles que las referencian, que sí están aislados por empresa.
