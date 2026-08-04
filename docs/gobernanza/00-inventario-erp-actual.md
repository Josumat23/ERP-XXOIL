# Paso 0 — Inventario del ERP actual (ERP-XXOIL)

**Fecha del inventario:** 2026-08-01
**Método:** exploración directa del repositorio (`D:\Escritorio\ERP`), no de documentación previa — porque no existe documentación previa (ver punto 4).

---

## 0.1 Veredicto rápido: no es greenfield, y no es un esqueleto

El código es **maduro y funcional**, no un prototipo. Cifras concretas:

- **85 modelos** en `prisma/schema.prisma`, con **16 migraciones** aplicadas de forma incremental sobre datos reales (no un `db push` de un solo golpe).
- **~112 páginas** (`page.tsx`) bajo `src/app/(app)/`, cada una con su(s) `actions.ts` de server actions detrás (create/editar/aprobar/anular), no solo lectura.
- **~33,000 líneas** de código de aplicación real (sin contar el cliente Prisma generado).
- Motor contable automático (`src/lib/contabilidad.ts`) que postea asientos reales a un libro mayor de verdad (no una tabla de log) para cada transacción operativa: venta, cobro, nota de crédito, compra, depreciación, mantenimiento, pago a proveedor, venta de activo fijo.
- Seguridad real: roles (`ADMIN/ALMACEN/PRODUCCION/VENTAS/GERENCIA`) + grupos de seguridad con permisos granulares por módulo y acción (crear/editar/aprobar), no solo un login.

Lo que **no** existe es documentación formal de requerimientos (RF/RN/CU/API/SQL/UI/TEST) — ver punto 4. El desarrollo se hizo directo de conversación → código, con verificación en navegador en cada entrega, sin pasar por documentos de especificación previos.

---

## 0.2 Módulos/dominios que existen en el código, con estado real

Todos los módulos listados están **funcionales de punta a punta** (UI + server action + modelo de base de datos +, cuando aplica, asiento contable automático). No hay módulos "a medio hacer" en el sentido de pantallas sin lógica detrás — el patrón de este proyecto ha sido no dejar nada a medias.

| Módulo (carpeta) | Alcance real implementado |
|---|---|
| **Catálogo** (`catalogo/`) | Productos (con segmento de mercado, ficha técnica/SDS), Presentaciones (con conversión de unidades, envases retornables/casco), Insumos, Categorías, Proveedores (con datos bancarios, multi-moneda) |
| **Comercial** (`comercial/`) | Cotizaciones → Pedidos (reserva de stock, control de crédito) → Facturas (SUNAT, condición de pago) → Cobros (parciales) → Notas de crédito; Comisiones por vendedor (con/sin básico); Zonas; Hojas de ruta (reparto con flota propia); Descuento por canal; Cascos pendientes |
| **Inventario** (`inventario/`) | Kardex por almacén, Ajustes, Traslados entre almacenes, Conteo cíclico |
| **Producción** (`produccion/`) | Fórmulas (recetas por lote — proceso, no ensamblaje discreto), Lotes granel, Control de calidad (con no conformidad/acción correctiva/causa raíz), Envasados, Trazabilidad/recall por lote, Equipos, Mantenimiento (con repuestos que descuentan stock real) |
| **Logística** (`logistica/`) | MRP simple (sugiere compras desde Proyecciones), Órdenes de compra (aprobación por monto, multi-moneda USD), Recepciones (costo promedio ponderado), Inspección de calidad de compras, Guías de remisión |
| **Finanzas** (`finanzas/`) | Cuentas por cobrar/pagar, Gestión de cobranza (avisos escalonados + bloqueo cruzado con Ventas), Propuesta de pago en lote, Libro de caja, Asientos contables (con reversión), Balance de comprobación, Estado de Situación Financiera (clasificado corriente/no corriente), Estado de resultados, Costos y márgenes, Rentabilidad por segmento/canal, Plan de cuentas, Centros de costo (presupuesto vs. real, reglas de prorrateo), Activos fijos (depreciación línea recta automática, venta con utilidad/pérdida), Libros electrónicos PLE (Registro de Compras/Ventas SUNAT) |
| **RRHH** (`rrhh/`) | Empleados (con profundidad internacional: tipo doc., nacionalidad, banco), Solicitudes de vacaciones (con aprobación) |
| **Proyecciones** (`proyecciones/`) | Proyección trimestral Marketing/Operaciones/Finanzas, simulador de precios y meta de utilidad |
| **Configuración** (`configuracion/`) | Empresa (datos fiscales, IGV), Compañías (multi-empresa fase 1), Usuarios, Series de documentos, Almacenes y zonas, Unidades de medida, Grupos de seguridad, Calendario fiscal (cierre de período), Monitoreo (tiempo real), Tareas programadas |
| **Reportes** (`reportes/`) | Hub consolidado de todos los reportes anteriores |
| **Transversales** | Adjuntos (DMS reducido), Direcciones y Contactos (genéricos, reutilizados en Cliente/Proveedor/Empleado) |

### Infraestructura no funcional (fuera del código de negocio)
- Servidor custom con WebSockets para monitoreo en tiempo real (`server.ts`).
- Despliegue Docker (`Dockerfile`, `docker-compose.yml`).
- Tareas programadas tipo "System Agent" reducido (depreciación mensual, recargo por mora, ejecutadas por `src/lib/tareasProgramadas.ts`).

---

## 0.3 Entidades de datos existentes (85 modelos)

Agrupadas por dominio (nombres tal cual en `prisma/schema.prisma`; campos principales resumidos, no exhaustivos):

**Configuración/Sistema:** `ConfiguracionEmpresa` (razón social, RUC, IGV, límite crédito corto plazo, OSINERGMIN), `Usuario`, `Sesion`, `Empresa` (multi-empresa), `GrupoSeguridad`, `PermisoGrupo`, `SerieDocumento`, `UnidadMedida`, `ClaseUnidadMedida`, `Adjunto`, `Direccion`, `Contacto`, `TareaProgramada`.

**Catálogo/Maestros:** `Categoria`, `Producto` (segmentoMercado, gradoNlgi, viscosidad, fichaTecnicaUrl), `Presentacion`, `EscalonPrecio`, `Proveedor` (banco/numeroCuenta/cci/swift/iban), `Insumo`, `Cliente` (canal, límite crédito, bloqueadoCobranza), `Vendedor`, `Zona`, `DescuentoCanal`.

**Comercial:** `Cotizacion`+`CotizacionDetalle`, `Pedido`+`PedidoDetalle` (con costoUnitario snapshot), `Factura`, `ComprobanteElectronico` (adapter SUNAT/OSE), `Cobro`, `NotaCredito`, `RecargoMora`, `AvisoCobranza`, `Comision`, `HojaRuta`+`HojaRutaVisita`, `MovimientoCasco`.

**Producción/Calidad:** `Formula`+`FormulaDetalle`, `LoteGranel`, `ControlCalidad`, `Envasado`+`EnvasadoInsumo`, `AsignacionLoteVenta`, `AsignacionLoteInsumo` (trazabilidad de materia prima del proveedor).

**Inventario/Almacén:** `MovimientoKardex`, `SaldoAlmacen`, `ConteoInventario`+`ConteoInventarioDetalle`, `Almacen`, `ZonaAlmacen`, `CalendarioProduccion`, `DiaNoLaborable`.

**Logística/Compras:** `OrdenCompra`+`OrdenCompraDetalle`, `RecepcionCompra`+`RecepcionCompraDetalle`, `InspeccionCompra`, `GuiaRemision`+`GuiaRemisionDetalle`.

**Finanzas/Contabilidad:** `CuentaPorPagar`, `PagoProveedor`, `MovimientoCaja`, `PeriodoFiscal`, `PlanCuentas`, `CuentaContable`, `Libro`, `AsientoContable`+`AsientoDetalle`, `ControlContable`, `CentroCosto`, `PresupuestoCentroCosto`, `ReglaAsignacionCosto`+`ReglaAsignacionCostoDetalle`, `CentroCostoControl`, `ActivoFijo`, `DepreciacionActivo`, `TipoCambio`.

**Mantenimiento:** `Equipo`, `OrdenMantenimiento`, `RepuestoOrdenMantenimiento`.

**RRHH:** `Empleado`, `SolicitudVacaciones`.

**Planeamiento:** `Proyeccion`+`ProyeccionDetalle`.

---

## 0.4 Flujos de negocio implementados de punta a punta (UI + acción + BD)

1. **Compra a pago:** MRP sugiere necesidad → Orden de Compra (aprobación por monto si excede umbral) → Recepción (costo promedio ponderado, inspección de calidad opcional, multi-moneda) → Cuenta por Pagar → Pago individual o Propuesta de pago en lote → asiento contable automático.
2. **Venta a cobro:** Cotización → Pedido (reserva de stock, valida límite de crédito y bloqueo por cobranza) → Factura (SUNAT, condición contado/15/30) → Cobro (parcial o total) → si vence: recargo por mora + gestión de cobranza (avisos escalonados, bloqueo cruzado que impide nuevos pedidos).
3. **Producción por lote:** Fórmula/receta → Lote granel → Control de calidad (aprobar/rechazar, con no conformidad y acción correctiva si aplica; reproceso de lote rechazado) → Envasado (consume el lote + insumos de envase) → stock de Presentación con lote y vencimiento → trazabilidad/recall por lote hacia el cliente Y hacia el proveedor de materia prima.
4. **Mantenimiento de flota/equipos:** Equipo → Orden de mantenimiento → repuestos (descuentan stock real) + mano de obra → costo liquidado a centro de costo.
5. **Activo fijo:** alta → depreciación línea recta mensual automática (tarea programada) → venta con cálculo de utilidad/pérdida contable.
6. **Cierre contable:** todo posteo pasa por `postearAsiento()`, que verifica el `PeriodoFiscal` correspondiente y **rechaza automáticamente** cualquier posteo a un período marcado `CERRADO` — control universal, no por módulo.
7. **RRHH:** alta de empleado → solicitud de vacaciones → aprobación/rechazo (con segregación de funciones).

## 0.5 Documentación de requerimientos existente

**No existe.** No hay carpeta `000-Governance`, `010-AI`, ni subcarpetas `RF/RN/CU/API/SQL/UI/TEST` en el repositorio (confirmado por búsqueda directa, cero resultados). El desarrollo de las últimas ~15 sesiones se ha hecho así: el usuario describe una necesidad de negocio o entrega un documento de referencia (manual de Epicor, tutoriales de SAP FI/CO), yo investigo el código actual, propongo qué aplica y qué no, el usuario aprueba, y construyo directo — sin pasar por un documento RF/CU intermedio.

**Esto es la brecha más importante de gobernanza del proyecto, no una brecha funcional.** El sistema funciona; lo que falta es trazabilidad documental formal.

## 0.6 Huecos identificados (documentación vs. código)

- **Documentación sin código:** ninguna (no hay documentación previa que describa algo no construido).
- **Código sin documentación:** el 100% del código — no hay un solo RF/CU escrito hasta este documento.
- **Contradicciones:** ninguna posible, por la misma razón.
- **Ajuste de alcance para el resto de este ejercicio:** dado que no hay documentación previa que auditar, el Paso 2 (cruce RF genérico → XXOil) no es una auditoría de gaps documentales — es la **primera vez que se documenta formalmente** lo que XXOil necesita, contrastado contra catálogos genéricos de SAP y contra lo que el código ya resuelve hoy sin haber pasado por ese proceso formal.
