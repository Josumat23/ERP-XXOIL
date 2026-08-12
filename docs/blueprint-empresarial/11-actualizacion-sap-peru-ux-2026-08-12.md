# 11 — Actualización SAP Business One, localización Perú y estrategia UX

Fecha de corte: 2026-08-12. Esta actualización contrasta el código actual con SAP Business One 10.0 como referencia de procesos para una fabricante y distribuidora peruana. No afirma certificación SAP ni conformidad tributaria/legal: la configuración concreta de la empresa, su RUC, régimen, condición de principal contribuyente, canales y volumen determinan qué brechas aplican.

## 1. Evidencia y alcance actuales

- Código medido: 104 modelos Prisma, 54 enums, 130 páginas funcionales y 166 Server Actions.
- Flujos verificados en código: cotización a cobro/nota de crédito; proyección a compra/recepción/inspección/pago; fórmula a lote/calidad/envasado; activos, mantenimiento, proyectos, planilla y contabilidad.
- Referencia SAP: Business Partner Master Data, Item Master Data, compras, ventas, inventario, producción y MRP de SAP Business One.
- Referencia peruana: portales y resoluciones oficiales de SUNAT listados al final.

## 2. Resultado ejecutivo: no es “igual a SAP”

El ERP cubre de manera material los ciclos principales de SAP Business One, pero no tiene paridad completa. La comparación correcta es por capacidad y control, no por copiar nombres o ventanas.

| Área | Cobertura actual | Diferencia material |
|---|---|---|
| Socios de negocio | Clientes y proveedores separados, contactos, direcciones, crédito y condiciones básicas | SAP B1 centraliza roles y tiene más datos fiscales, logísticos, contables y por organización |
| Artículos/materiales | Producto, presentación/SKU, insumo, UoM, precios, stock, costo, lotes y fórmulas | Faltan proveedor preferido/condiciones por artículo, múltiples UoM completas y planificación configurable por material |
| Ventas | Cotización, pedido, reserva, factura, CPE, NC, cobro, comisión y despacho | Boleta y nota de débito dependen del canal; acuerdos marco y aprobación de crédito al pedido siguen pendientes |
| Compras | OC, aprobación por umbral, recepción parcial, inspección, devolución, CxP y pago | Faltan RFQ/comparación formal y liberación multinivel |
| Inventario | Kardex inmutable, saldo por almacén, conteo, ajuste, traslado y ATP | La zona sigue siendo ubicación principal, no cantidad repartida por bin |
| Producción | Fórmula versionada, lote, consumo, merma, calidad, envasado y costo | No hay centro de trabajo/capacidad por recurso ni receta de proceso al nivel PP-PI |
| Calidad | Inspección de compra, calidad de lote, causas y reclamos | Faltan resultados medidos por parámetro, certificado de análisis y SPC |
| Mantenimiento | Equipo, contador, plan preventivo, orden y repuestos | Falta jerarquía de ubicación técnica y calibración cuando aplique |
| Finanzas/contabilidad | Asientos, reversos, PCGE, centros de costo, activos, caja, CxC/CxP y reportes | Multiempresa real, conciliación bancaria formal, auditoría de maestros y SoD no están completos |
| RR. HH. | Empleado, vacaciones, planilla, CTS, gratificación y liquidación | PLAME/T-Registro no son una integración completa; el cálculo legal requiere validación profesional |
| Proyectos | WBS, actividades, precedencias, ruta crítica y costos | Es un PS reducido, adecuado para proyectos de capital simples |

## 3. Correcciones verificadas durante esta actualización

1. PR #61, merge 86dc20a: el XML UBL usa la tasa de IGV congelada en la factura/NC en vez de 18% fijo por línea.
2. PR #62, merge b524c24: MRP calcula disponibilidad como stock físico menos stock reservado, consistente con ATP y pedidos.
3. El hallazgo histórico de autorización de envío SUNAT ya estaba corregido: factura y NC exigen sesión, rol y permiso.
4. PR #64, merge 6509cdd: suite permanente con SQLite efímero fuera del repositorio para kardex, venta/cobro, compra/pago, producción/calidad/envasado, MRP y UBL.
5. PR #65, merge 7bab3f6: cookies de sesión y empresa activa limitadas a HTTPS en producción mediante `secure`.
6. PR #66, merge d5bd652: CI en cada PR y push a `main`, con Prisma, lint, TypeScript, suite crítica y build; ejecución Linux verificada.
7. PR #68, merge 8bda85c: cálculo y contabilización de planilla cubiertos con parámetros ficticios versionados, advertencias por configuración incompleta y rechazo de duplicados.
8. PR #69, merge 0e5fe2b: ledger de trazabilidad para recall cubierto con asignación, devolución parcial, liberación restante e idempotencia.
9. PR #70, merge be3ff73: verificación de login con costo `scrypt` uniforme para evitar enumeración temporal; el rate limiting persistente sigue pendiente de migración.

## 4. Localización peruana: estado vigente y límites

| Tema | Estado del ERP | Decisión |
|---|---|---|
| Factura, NC y GRE electrónicas | Generación UBL/firma/envío implementada; no homologada con credenciales reales | No usar como emisor productivo hasta validar con certificado y cuenta real |
| Boleta electrónica | Ausente | Construir solo si existe venta a consumidor final |
| Nota de débito | Ausente | Construir si se recuperan gastos/costos después de facturar |
| SIRE | Ausente; hoy solo PLE 8.1/14.1 | Determinar obligación por RUC. RS 000125-2026/SUNAT posterga a octubre de 2026 al grupo específico de principales contribuyentes con ingresos 2024 superiores a 2300 UIT |
| Detracciones/retenciones/percepciones | No hay motor completo | El contador debe definir aplicabilidad por operación, bien/servicio y condición de agente |
| Planilla | Motor interno con parámetros; quinta categoría declarada simplificada | Validar resultados con especialista y herramienta oficial antes de pagar planilla real |
| SST/SCTR | Catálogo GHS parcial; no hay sistema SST integral | Diseñar con responsable SST/legal; no inventar campos ni flujos sin matriz IPERC y obligaciones reales |
| Datos personales | Se almacenan datos de clientes, proveedores y empleados | Definir base legal, conservación, derechos y seguridad con asesoría legal |
| OSINERGMIN | Registro informativo | Confirmar obligaciones según actividades e instalaciones reales |

## 5. Estrategia UX recomendada

No se recomienda copiar literalmente SAP GUI. Deben preservarse su trazabilidad, estados, documento base/destino, autorización e inmutabilidad, con patrones web más claros.

### 5.1 Cuándo usar cada patrón

| Patrón | Usar cuando | No usar cuando |
|---|---|---|
| Modal | Confirmación o captura auxiliar de hasta 3–5 campos, sin líneas ni navegación dependiente | Maestro principal, documento con detalle, adjuntos, direcciones o estados |
| Panel lateral | Edición contextual breve de 5–10 campos mientras la lista sigue visible | Flujo que requiere ancho, tablas, cálculos o impresión |
| Maestro-detalle | Catálogo frecuente: buscar/seleccionar a la izquierda y editar una ficha estable | Documento transaccional inmutable o proceso multiestado |
| Página completa | Documento con cabecera+líneas, pestañas, totales, adjuntos, impresión o trazabilidad | Confirmación de una sola acción |
| Asistente | Proceso largo con dependencias y validaciones entre etapas | Alta simple o edición frecuente de pocos campos |
| Bandeja | Trabajo operativo por estado, prioridad, responsable y vencimiento | Configuración esporádica sin volumen |

### 5.2 Clasificación por maestros

| Maestro | Patrón recomendado | Motivo |
|---|---|---|
| Categorías, zonas comerciales, causas de calidad | Maestro-detalle; modal opcional solo para alta rápida | Son simples, pero la edición visible reduce pérdida de contexto |
| Unidades de medida, series, descuentos por canal | Panel lateral o edición inline controlada | Pocos campos y uso de configuración |
| Clientes y proveedores | Página completa con pestañas | Identidad fiscal, crédito, contactos, direcciones, adjuntos e historial |
| Productos, presentaciones e insumos | Página completa/maestro-detalle | Datos comerciales, inventario, logística, SUNAT, costos y peligrosidad |
| Fórmulas | Página completa versionada | Cabecera, componentes, rendimiento y vigencia; no debe ocultarse en modal |
| Almacenes y zonas | Maestro-detalle | Jerarquía y calendario deben permanecer visibles |
| Equipos y activos fijos | Página completa con pestañas | Historial, contador, mantenimiento, depreciación y documentos |
| Empleados | Página completa con pestañas y control de acceso | Datos sensibles, laborales, vacaciones y planilla |
| Plan de cuentas y centros de costo | Maestro-detalle jerárquico | El contexto contable importa más que la rapidez de un modal |

### 5.3 Clasificación por transacciones

| Transacción | Patrón recomendado |
|---|---|
| Cotización, pedido, OC, guía, lote, envasado, asiento, proyecto | Página completa; asistente solo si el usuario nuevo necesita guía |
| Recepción de compra | Página completa o panel ancho desde la OC; nunca modal pequeño por sus líneas y discrepancias |
| Inspección, aprobación/rechazo, iniciar/completar/cancelar | Modal accesible de acción con motivo obligatorio y resumen del documento |
| Cobro, pago, ajuste, traslado, movimiento de caja | Panel lateral o modal mediano si son pocos campos; página si contienen múltiples aplicaciones/líneas |
| Nota de crédito y devolución | Página/panel ancho con selección de líneas, cantidades, impuestos y trazabilidad |
| Propuesta de pago y cierres | Asistente con resumen, validación, confirmación y resultado |
| Reportes y dashboards | Página completa con filtros persistentes y exportación |

### 5.4 Reglas obligatorias para modales

- Rol dialog, modalidad y nombre accesible.
- Foco inicial útil, trampa de foco y devolución del foco al disparador.
- Escape solo si no hay operación irreversible en curso.
- No cerrar al pulsar fuera cuando hay información sin guardar.
- Acción principal explícita; acciones destructivas separadas y con motivo.
- En móvil, altura completa o panel inferior; nunca contenido cortado.
- El servidor revalida autorización, estado y montos: el modal no es seguridad.

## 6. Prioridad recomendada

### Antes de producción regulada

1. Homologación real de CPE/GRE con certificado y credenciales.
2. Decisión SIRE por RUC y calendario aplicable.
3. Validación contable/tributaria de detracciones, retenciones, percepciones y libros.
4. Validación de planilla y quinta categoría por especialista.
5. Definición SST/SCTR y protección de datos con responsables profesionales.
6. Backup/restauración probado y migración de SQLite antes de concurrencia o volumen altos.

### Producto y control

1. Multiempresa real solo si operarán dos o más sociedades.
2. Crédito bloqueante o aprobación al crear pedido.
3. RFQ y liberación multinivel de compras.
4. Parámetros de calidad y certificado de análisis si los clientes lo exigen.
5. Auditoría de cambios de maestros y segregación de funciones.
6. Continuar ampliando la suite ya existente hacia documentos completos y los restantes puntos transaccionales; planilla y recall ya tienen regresión automatizada.

### UX

1. Mantener páginas completas para documentos y maestros complejos.
2. Introducir un modal accesible reutilizable para acciones breves, no para rehacer todos los formularios.
3. Convertir primero aprobaciones/rechazos y capturas auxiliares; medir tiempo y errores antes de ampliar.
4. Validar con usuarios de Ventas, Almacén, Producción, Contabilidad y RR. HH.

## 7. Fuentes oficiales consultadas

- SAP Business One — Business Partner Master Data: https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/4070cd76b9ad4839b66aca0e450780d3.html
- SAP Business One — Item Master Data: https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/452365ca9e152b31e10000000a1553f7.html
- SAP Business One — Planning Data: https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/23be7409575445beb8fe50689eb73e86.html
- SUNAT — Tipos de comprobantes electrónicos: https://cpe.sunat.gob.pe/informacion_general/tipos_comprobantes_pago
- SUNAT — RS 000125-2026/SUNAT: https://www.sunat.gob.pe/legislacion/superin/2026/000125-2026.pdf

## 8. Información empresarial que debe confirmarse

Las preguntas de 10-preguntas-abiertas.md siguen siendo condiciones de diseño. Las más urgentes son: sociedades/plantas reales, venta B2C, condición SIRE del RUC, transporte tercerizado, clientes que exigen certificados de análisis, instrumentos sujetos a calibración, volumen de picking, estructura de aprobación y obligaciones SST. Sin esas respuestas no es seguro construir las brechas condicionadas.
