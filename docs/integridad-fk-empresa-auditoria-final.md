# Integridad FK de empresa: auditoría final del ítem 0.2

Diez migraciones aditivas convirtieron `empresaId` en una relación física hacia `Empresa` en los **76 de 76** modelos que llevan ese campo. Todas declaran `onDelete: Restrict`, de modo que ninguna compañía con datos puede borrarse dejando filas huérfanas.

## Qué garantiza la auditoría automatizada

La prueba `todo modelo con empresaId declara la relación física hacia Empresa` lee `prisma/schema.prisma`, recorre cada bloque `model`, y falla si alguno declara `empresaId` sin el campo `empresa Empresa @relation(fields: [empresaId], ...)`. Comprueba además que sigan existiendo al menos 76 modelos con `empresaId`, para que la prueba no se vuelva trivial si alguien quita el campo en lote.

Es una auditoría de esquema, no de datos: se ejecuta sobre el archivo fuente y por eso protege también a los modelos que todavía no tienen filas.

## Qué no cubre

La FK impide apuntar a una compañía inexistente; **no** impide que un módulo escriba en la compañía equivocada. Ese es el filtro de aplicación, la otra mitad del ítem 0.2, que sigue pendiente en cinco módulos de Configuración (almacenes, unidades de medida, grupos de seguridad, usuarios y series de documento).

## Etapas

| Etapa | Migración | Tablas |
| --- | --- | --- |
| Identidad, auditoría, cuentas bancarias, catálogo e inventario | `20260910212000_company_relations_catalog_inventory` | 11 |
| Producción y calidad | `20260910230000_company_relations_production_quality` | 7 |
| Núcleo comercial | `20260911020000_company_relations_commercial_core` | 7 |
| Finanzas de clientes | `20260911030000_company_relations_customer_finance` | 9 |
| Compras y proveedores | `20260911050000_company_relations_procure_to_pay` | 13 |
| Tesorería, rutas y series de documento | `20260911070000_company_relations_treasury_documents` | 4 |
| Configuración y contabilidad general | `20260911090000_company_relations_config_accounting` | 8 |
| Costos, activos fijos y proyectos | `20260911110000_company_relations_cost_assets_projects` | 5 |
| Centros de trabajo, mantenimiento y proyecciones | `20260911130000_company_relations_workcenters_maintenance` | 5 |
| RR. HH., asistencia, planilla y adjuntos | `20260911150000_company_relations_hcm_payroll` | 7 |
| **Total** | | **76** |
