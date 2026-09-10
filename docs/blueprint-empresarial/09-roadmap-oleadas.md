# 09 — Roadmap por oleadas

> **Entregado 2026-09-09:** aislamiento multiempresa de subledgers CxC/CxP, pagos, caja, propuestas, saldos a favor y reportes de costos, rentabilidad y resultados.

> **Entregado 2026-09-09:** aislamiento multiempresa de órdenes de compra, recepciones, devoluciones a proveedor e inspecciones de entrada; selección de compañía activa aplicada también a RFQ.

> **Entregado 2026-09-09:** migración y aislamiento multiempresa real de descuentos por canal y movimientos de envases retornables.

> **Entregado 2026-09-09:** aislamiento multiempresa de guías de remisión, despacho, devoluciones de clientes, backlog, comisiones, series legales y ledger de comprobantes electrónicos.

> **Entregado 2026-09-09:** aislamiento multiempresa de facturación, cobranza y hojas de ruta, incluidas sus mutaciones financieras, devoluciones y reenvíos electrónicos.

> **Entregado 2026-09-09:** aislamiento multiempresa de pedidos, cotizaciones, pipeline y ATP asociado.

> **Entregado 2026-09-09:** aislamiento multiempresa de clientes, vendedores y zonas comerciales.

> **Entregado 2026-09-09:** aislamiento multiempresa de categorías, proveedores y evaluación de desempeño.

> **Entregado 2026-09-09:** aislamiento multiempresa de productos, presentaciones, categorías relacionadas, ubicaciones y escalones de precio.

> **Entregado 2026-09-09:** aislamiento multiempresa completo del catálogo de insumos y validación cruzada de proveedores/ubicaciones.

> **Entregado 2026-09-09:** MRP con plazo de abastecimiento, compra mínima, múltiplo y fecha esperada en la orden sugerida.

> **Entregado 2026-09-09:** acuerdos marco de suministro con consumo parcial y control transaccional de saldo.
>
> **Entregado 2026-09-09:** determinación automática de fuente en MRP por costo normalizado y cobertura contractual, con trazabilidad a la orden de compra.

> **Entregado 2026-09-08 (valoración):** reporte de inventario valorizado a fecha de corte con snapshot de costo y aislamiento multiempresa.

> **Entregado 2026-09-08 (tres vías):** bloqueo efectivo de pago por discrepancia OC–recepción–factura y liberación excepcional auditada.

> **Entregado 2026-09-08 (proveedores):** score ponderado y clasificación automática con aislamiento multiempresa.

> **Entregado 2026-09-08 (liberación):** aprobación multinivel de compras con rechazo motivado y bloqueo de recepción.

> **Entregado 2026-09-08:** RFQ y comparación de proveedores con trazabilidad a la orden de compra.

> **Actualización 2026-08-12:** los ítems 0.1 (autorización SUNAT), 0.1b (stock reservado en MRP, PR #62, merge b524c24), cookie `secure` en producción (PR #65, merge 7bab3f6) y framework de pruebas + CI (PR #64/#66, merges 6509cdd/d5bd652) están completados. El resto requiere las dependencias y decisiones indicadas; no autoriza cambios de esquema.

**Principio de secuenciación**: la Oleada 0 resuelve los prerrequisitos estructurales de los que dependen casi todos los demás gaps (sin sociedad/planta real, no tiene sentido construir jerarquía de centro de costo "por planta"; sin partición de stock por zona, no tiene sentido construir picking). Las oleadas siguientes se ordenan por impacto/riesgo, no por dominio SAP — varios ítems de distintos dominios conviven en la misma oleada cuando comparten dependencia técnica o urgencia.

Cada ítem indica: **dependencias**, **criterio de aceptación**, **cómo probarlo**, **plan de rollback**.

---

## Oleada 0 — Prerrequisitos estructurales y correcciones críticas inmediatas

### 0.1 — Corregir autorización faltante en envío de comprobantes SUNAT
- **Qué**: agregar `requerirRol(["VENTAS"])` + `puedeRealizar` a `enviarComprobanteFactura` y `enviarComprobanteNotaCredito` (`src/app/(app)/comercial/facturas/actions.ts`), igual que el resto de funciones del mismo archivo.
- **Dependencias**: ninguna — es una corrección aislada de una línea de código por función.
- **Criterio de aceptación**: un usuario sin sesión o con rol no autorizado recibe `{ error: ... }` al invocar la función; un usuario VENTAS/ADMIN sigue funcionando igual que hoy.
- **Prueba**: llamar la función server-side simulando `obtenerUsuario()` retornando `null` y con un usuario de rol ALMACEN; confirmar rechazo en ambos casos.
- **Rollback**: revertir el commit — sin efecto en datos, es solo una guarda de acceso.
- **Prioridad**: **crítica, esfuerzo mínimo — hacer antes que cualquier otra cosa de este documento.**

### 0.1b — ~~Corregir el MRP para incorporar pedidos reales~~ — completado
- **Resultado**: el MRP calcula saldo pendiente por presentación, consume el pronóstico con `max(pronóstico, backlog)` y muestra el neteo. Incluye pedidos parciales, vencidos/sin fecha y productos ausentes del pronóstico, sin doble conteo de `stockReservado`.
- **Verificación**: funciones puras en la suite normal, consultas aisladas por compañía y visualización en MRP/Proyecciones.

### 0.2 — Multi-empresa real: FK completa en el grafo transaccional
- **Qué**: agregar relación real `empresa Empresa @relation(fields: [empresaId], references: [id])` a los modelos transaccionales que hoy solo tienen `empresaId` como string suelto (`Pedido`, `Factura`, `OrdenCompra`, `MovimientoKardex`, `AsientoContable`, `Insumo`, `Producto`, etc. — lista completa en Blueprint 05), y filtrar por `obtenerEmpresaActivaId()` en cada `actions.ts` que hoy no lo hace (confirmado ausente en 7 de 8 módulos muestreados, Blueprint 08).
- **Dependencias**: ninguna técnica, pero es el prerrequisito lógico de 0.3, y de los ítems de jerarquía de planta/centro de costo de la Oleada 1.
- **Criterio de aceptación**: crear una segunda `Empresa`, cambiar la compañía activa, y confirmar que **ningún** dato (insumos, pedidos, facturas, asientos, kardex) de la compañía 1 es visible ni editable desde la compañía 2, y viceversa.
- **Prueba**: script de datos de prueba con 2 empresas, 2 juegos de clientes/insumos/pedidos, verificación cruzada de que cada consulta filtrada por empresa activa no devuelve filas de la otra.
- **Rollback**: mantener `empresaId` como campo (no se elimina, se le agrega la relación) — revertir la migración de Prisma es seguro porque no se borra la columna existente, solo se agrega la FK y el filtro de aplicación.
- **Prioridad**: **P0, el ítem más grande y más bloqueante de todo el roadmap.**

### 0.3 — Planta como unidad organizativa real
- **Qué**: agregar `tipo`/`rol` a `Almacen` (o modelo `Planta` separado si el negocio confirma que una planta puede tener varios almacenes subordinados — ver Blueprint 10, pregunta abierta).
- **Dependencias**: 0.2 (una planta pertenece a una compañía real).
- **Criterio de aceptación**: el sistema puede listar "todas las plantas" distinto de "todos los almacenes de distribución," y el MRP/Proyecciones puede planificar por planta.
- **Prueba**: crear 2 plantas + 1 almacén de distribución, confirmar que los reportes de capacidad y el MRP distinguen correctamente.
- **Rollback**: campo nuevo, opcional — reversible sin pérdida de datos.
- **Prioridad**: P0.

### 0.4 — Partición de stock por zona (bin real, no puntero único)
- **Qué**: nuevo modelo `SaldoZona` (cantidad por combinación almacén+zona+ítem), migrando `Presentacion.zonaAlmacenId`/`Insumo.zonaAlmacenId` de puntero único a una vista derivada ("zona principal") mientras el detalle real vive en `SaldoZona`.
- **Dependencias**: ninguna técnica directa, pero es prerrequisito lógico de picking/oleadas (Oleada 2).
- **Criterio de aceptación**: un ítem puede tener cantidad simultánea en más de una zona del mismo almacén, y la suma de `SaldoZona` por ítem coincide siempre con `SaldoAlmacen`.
- **Prueba**: mover parte de un ítem a una segunda zona, confirmar que ambas zonas muestran cantidad correcta y que el total no cambia.
- **Rollback**: `SaldoZona` es un modelo aditivo — puede desactivarse volviendo a leer solo `SaldoAlmacen` sin perder datos.
- **Prioridad**: **P0** si el volumen de despacho por almacén ya es alto; validar con negocio el volumen real antes de comprometer el esfuerzo (ver Blueprint 10).

### 0.5 — Sistema de gestión de SST (mínimo viable legal)
- **Qué**: modelos para IPERC (matriz de peligros/riesgos), registro de accidentes/incidentes, exámenes médico-ocupacionales, seguimiento de SCTR por empleado en actividad de riesgo.
- **Dependencias**: ninguna técnica — es un módulo nuevo, aditivo.
- **Criterio de aceptación**: definido junto con un responsable de SST/legal — este documento no puede fijar el criterio de aceptación de un requisito legal sin esa validación (ver Blueprint 07, "requiere validación profesional").
- **Prueba**: a definir con el área legal/SST.
- **Rollback**: módulo nuevo, sin impacto en lo existente.
- **Prioridad**: **P0 — obligación legal activa, no una mejora de producto.** Iniciar con asesoría legal/SST en paralelo a cualquier otro desarrollo.

### 0.6 — Validar vigencia SIRE vs. PLE
- **Qué**: no es desarrollo todavía — es una **investigación normativa** (como ya se hizo para HCM en `docs/gobernanza/04-hcm-nomina-investigacion-normativa.md`) para confirmar si esta empresa específica está obligada a SIRE hoy.
- **Dependencias**: ninguna.
- **Criterio de aceptación**: documento de investigación normativa análogo al de HCM, firmado/validado por un contador especializado en SUNAT.
- **Prioridad**: **P0 en términos de urgencia de investigación** (no de esfuerzo de desarrollo, que depende del resultado).

---

## Oleada 1 — Alto impacto, no bloqueante para operar hoy

| Ítem | Dependencias | Criterio de aceptación (resumen) | Prioridad |
|---|---|---|---|
| ~~Jerarquía de centro de costo (`parentId`, mismo patrón que `EdtProyecto`)~~ | 0.2, 0.3 | **Completado:** reportes presupuesto vs. real agregan cada grupo y sus descendientes, con ciclos y cruces de compañía bloqueados | **P1 completado** |
| Verificación de crédito bloqueante en `crearPedido` | ninguna | Un pedido que superaría el límite de crédito del cliente se rechaza o requiere aprobación antes de crearse, no solo al facturar | P1 |
| RFQ / comparación de proveedores antes de la OC | ninguna | Una OC puede referenciar una comparación de 2+ cotizaciones de proveedor | P1 |
| Esquema de liberación de compras multi-nivel | 0.2, 0.3 (si es por organización de compras/planta) | Aprobación de OC configurable por monto Y por planta/organización, no un solo umbral global | P1 |
| Certificado de análisis QM (valores medidos por parámetro) | ninguna | `ControlCalidad` puede registrar valores medidos (viscosidad, punto de goteo, etc.) y generar un certificado imprimible | P1 |
| Jerarquía de ubicación técnica de mantenimiento | 0.3 | Un equipo puede pertenecer a una ubicación técnica multinivel (planta→línea→equipo) | P1 |
| Estructura organizativa jerárquica RR.HH. (`jefeDirectoId`/posición) | ninguna | **Parcialmente construida:** jefe directo, prevención de ciclos y organigrama por compañía. Pendiente una fase de posiciones versionadas y aprobación jefe→reporte. | P1 parcial |
| ~~Motor de conflictos de SoD (GRC)~~ | ninguna | **Completado:** asignar crear/editar junto con aprobar en Materiales, Finanzas, Ventas o RR.HH. se bloquea atómicamente, con código explicativo, reversión de UI y pruebas en la suite normal | **P1 completado** |
| Bloqueo de cuenta / rate limiting en login | migración para persistir intentos/ventana/bloqueo | **Parcial**: PR #70 uniformó el costo `scrypt`, evitó enumeración temporal y limitó entradas; el bloqueo temporal persistente sigue pendiente y no debe implementarse en memoria volátil | P1 parcial |
| Cookie de sesión con flag `secure` en producción | ninguna | **Completado**: sesión y empresa activa usan `secure` cuando `NODE_ENV=production` (PR #65) | P1 completado |
| Change log genérico para catálogos editables | ninguna | Editar `Cliente.limiteCredito` (u otro campo sensible) deja un registro de valor anterior/nuevo/usuario/fecha | P1 |
| Framework de pruebas automatizadas + pipeline CI | ninguna | **Base completada y ampliada**: SQLite efímero cubre ocho escenarios de kardex, contabilidad, producción, calidad, envasado, recall, planilla, MRP, UBL y autenticación; CI ejecuta Prisma, lint, TypeScript, pruebas y build en cada PR (PR #64/#66/#68/#69/#70) | **P1 transversal, en expansión** |
| Estrategia de backup/DR documentada e implementada | ninguna | Backup automatizado programado + procedimiento de restauración probado al menos una vez | **P1, transversal** |
| Consentimiento/retención de datos personales (Ley 29733) | ninguna | Definir con legal qué controles mínimos aplican; implementar lo que se confirme necesario | P1 |

---

## Oleada 2 — Impacto medio, condicionado a volumen/modelo de negocio confirmado

| Ítem | Condición para activarlo |
|---|---|
| Picking/oleadas/HU de almacén | Confirmar que 0.4 (partición por zona) ya está en producción y que el volumen de despacho lo justifica |
| Nota de débito, Boleta electrónica | Confirmar si hay o habrá canal de venta a consumidor final (Boleta) o necesidad de cobro post-facturación (Nota de débito) |
| Centro de beneficio con P&L propio | Confirmar si cada planta/unidad de negocio debe reportar utilidad independiente |
| Multi-moneda con libro paralelo real | Confirmar si habrá operación en el extranjero con moneda funcional distinta |
| Migración a PostgreSQL con controles de concurrencia explícitos (bloqueo optimista, `@@unique` en numeración correlativa) | Cuando el volumen/usuarios concurrentes lo justifiquen — **no migrar sin antes agregar los controles explícitos que hoy dependen implícitamente de SQLite (Blueprint 08)** |
| Separar reportes/BI de la base transaccional (réplica de solo lectura o data mart) | Medir primero si las consultas de reporte ya degradan el sistema operativo a alto volumen |
| Gestión de transportistas terceros / licitación de flete | Confirmar si la distribución seguirá siendo 100% flota propia a esta escala |
| Certificación periódica de accesos (GRC) | Cuando el número de usuarios/grupos crezca lo suficiente para que la revisión manual de 90 días sea insuficiente |

---

## Oleada 3 — Condicional a evento de negocio específico (no construir preventivamente)

Confirmado por el propio repositorio como buena práctica ya establecida (`docs/gobernanza/05-disparadores-fase3-diferida.md`): **no construir sin un disparador real confirmado.**

| Ítem | Disparador |
|---|---|
| Comercio exterior (exportación, incoterms) | Primer pedido real de cliente extranjero |
| Subcontratación de fabricación (maquila) | Decisión confirmada de tercerizar producción de algún SKU |
| Nivelación de recursos y calendario de días hábiles en Proyectos | Portafolio real de proyectos concurrentes que lo justifique |
| Calibración de instrumentos críticos (PM) | Incorporación de instrumentos de medición que la requieran |

---

## Nota metodológica sobre pruebas y rollback transversal

Desde los PR #64 y #66 existe una base permanente de pruebas automatizadas y CI. Cada ítem de este roadmap que toque kardex, contabilidad, planilla o documentos debe ampliar esa suite con el caso afectado; un script manual reproducible sigue siendo útil para exploración, pero ya no sustituye una prueba automatizada de regresión.

Para el rollback de cambios de esquema: el patrón ya establecido en este repositorio (agregar campos/modelos nuevos como opcionales, nunca eliminar ni renombrar en la misma migración que se agrega la funcionalidad) debe mantenerse en todo este roadmap — es consistente con el principio de diseño ya documentado en `prisma/schema.prisma:5-7` ("la historia nunca se edita ni se borra") y reduce el riesgo de cada oleada.
# Actualización: contabilidad general multiempresa

Se aisló por empresa activa el plan de cuentas, los controles, períodos, libros, asientos, balance y exportaciones PLE. Los posteos automáticos ahora pueden transportar la empresa de la transacción hasta el motor contable. Véase `docs/aislamiento-multiempresa-contabilidad-general.md`.
# Actualización: maestros financieros multiempresa

Se aislaron activos fijos, depreciación, centros de costo, reglas de asignación y órdenes internas. Véase `docs/aislamiento-multiempresa-maestros-financieros.md`.
# Actualización: configuración y valorización multiempresa

Se aislaron el calendario fiscal, los niveles de aprobación de compras y la valorización histórica de inventario por empresa activa. Véase `docs/aislamiento-multiempresa-configuracion-reportes.md`.
# Actualización: compras estratégicas multiempresa

Se aislaron el detalle RFQ y el ciclo de acuerdos de suministro por empresa activa. Véase `docs/aislamiento-multiempresa-compras-estrategicas.md`.
