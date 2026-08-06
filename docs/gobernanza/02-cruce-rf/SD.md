# Cruce RF genérico → XXOil: SD (Ventas y Distribución)

**Actualización (2026-08-05):** RF-SD-050 (comprobante electrónico SUNAT) tenía 7 brechas reales frente a los 3 documentos que XXOil emite hoy (Factura, Nota de Crédito, Guía de Remisión vía su OSE contratado) — la Guía nunca se enviaba a SUNAT, la Nota de Crédito enviaba un ítem fabricado en vez de las líneas reales, unidad de medida hardcodeada, sin datos bancarios, sin catálogo de motivo de NC, sin peso/modalidad/RUC de transportista/ubigeo en la guía. Las 7 se corrigieron, y además se construyó un segundo adaptador de comunicación directa a SUNAT (SEE - Del Contribuyente, sin OSE intermediario) — ver `000-Governance/010-AI/sunat-facturacion-electronica/`.

**Fuente:** `Requerimientos_Funcionales_SAP_SD.md` (65 RF). **Resultado:** 33 Obligatorio (29 ya construidos — el módulo más completo de todo el cruce, como corresponde al ciclo Order-to-Cash), 6 Deseable, 26 No aplica.

Este es el módulo donde el usuario dio instrucciones más específicas y todas están verificadas en el código: condición contado/15/30 (`CondicionPago` enum), comisión con/sin básico (`Vendedor.tipoVendedor`), 4 zonas (`Zona`), y **"regularizaciones sobre la marcha" ya es obligatorio y ya está construido**: anulación de factura, devoluciones de venta, notas de crédito, reversión de asientos — nada en este sistema es rígido al punto de bloquear una corrección operativa real.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-SD-001 a 003 (cliente con roles múltiples, direcciones, clasificación por grupo/canal/zona) | Sí (mayormente ya hecho) | `Cliente` con `canal`, `Zona`; no distingue roles múltiples (solicitante/pagador/receptor) porque en XXOil el cliente es una sola entidad para todo | **Obligatorio (ya hecho, simplificado)** | `Cliente` (M11, M1 para roles múltiples) |
| RF-SD-004 (material de venta: unidad, textos, grupo) | Sí (ya hecho) | `Presentacion` con unidad de venta y conversión | **Obligatorio (ya hecho)** | M11 |
| RF-SD-005 (listas de precios, escalas, descuentos con vigencia) | Sí (ya hecho) | `EscalonPrecio`, `DescuentoCanal` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-006 (datos de crédito por cliente) | Sí (ya hecho) | `Cliente.limiteCredito` + validación al facturar | **Obligatorio (ya hecho)** | M11 |
| RF-SD-007 (acuerdos cliente-material específicos) | No | M1 — no hay volumen de acuerdos individuales por cliente-material más allá del precio por canal ya cubierto | — | No aplica |
| RF-SD-008 (histórico de cambios en datos maestros/condiciones) | No | Bajo volumen | Fase 3+ | No existe |
| RF-SD-009 (carga masiva de clientes/condiciones) | No | Volumen bajo (decenas de clientes, no miles) — el alta manual es viable | — | No aplica |
| RF-SD-010, 011 (cálculo automático de precio, descuentos/recargos/impuestos) | Sí (ya hecho) | Precio por canal + IGV congelado al facturar | **Obligatorio (ya hecho)** | M11 |
| RF-SD-012 (simulación de precio antes de confirmar) | Sí (ya hecho) | La cotización cumple ese rol — se puede cotizar sin comprometer nada hasta convertir a pedido | **Obligatorio (ya hecho)** | `Cotizacion` (M11) |
| RF-SD-013 (ATP contra stock/producción/entradas previstas) | Parcial | Se valida contra stock disponible (`stockReservado`); no contra producción planificada futura (eso lo cubre el MRP, en una pantalla separada, no integrado a la validación del pedido) | Media | `Presentacion.stockReservado` (M11 parcial) |
| RF-SD-014 (fechas de entrega alternativas si no hay disponibilidad) | No | XXOil no promete fecha de entrega futura — si no hay stock, no se completa el pedido con esa línea | — | No aplica al flujo actual |
| RF-SD-015 a 017 (verificación de crédito, bloqueo/aprobación, liberación manual) | Sí (ya hecho) | Control de crédito al facturar + bloqueo por cobranza (más estricto que el RF genérico, que solo habla de crédito) | **Obligatorio (ya hecho)** | `Cliente.limiteCredito`, `Cliente.bloqueadoCobranza` (M11) |
| RF-SD-018 (determinación automática de impuestos) | Sí (ya hecho) | IGV congelado desde `ConfiguracionEmpresa.tasaIgv` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-019, 020 (contactos/campañas comerciales) | No | Vive en CRM.md — descartado por el mismo motivo (M6) | — | Ver `CRM.md` |
| RF-SD-021, 022 (cotización con validez, conversión a pedido sin reingreso) | Sí (ya hecho) | `Cotizacion`→`Pedido` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-023 (pedido con múltiples posiciones, fecha/precio propio) | Sí (ya hecho) | `Pedido`+`PedidoDetalle` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-024 (tipos de documento: urgente, devolución, gratuito, reposición) | Parcial | Solo existe el pedido estándar y la devolución de venta; no hay "pedido urgente" ni "entrega gratuita" como tipos formales | Baja | `Pedido` estándar + devolución (M6 parcial) |
| RF-SD-025 (contratos de venta, programas de entrega) | No | XXOil no maneja contratos marco de cantidad/valor con clientes | Fase 3+ | No existe |
| RF-SD-026 (bloqueo de pedido/posición) | Sí (ya hecho, vía crédito/cobranza) | El bloqueo por cobranza ya impide crear pedidos nuevos | **Obligatorio (ya hecho)** | `bloqueadoCobranza` (M11) |
| RF-SD-027 (devolución de cliente vinculada a pedido/entrega) | Sí (ya hecho) | Devolución física de mercadería ya construida | **Obligatorio (ya hecho)** | M11 |
| RF-SD-028 (estado del pedido en todas sus etapas) | Sí (ya hecho) | `Pedido.estado`, `Factura.estado` visibles | **Obligatorio (ya hecho)** | M11 |
| RF-SD-029 (copiar pedido existente) | No | Bajo esfuerzo pero no solicitado ni bloqueante | Baja | No existe |
| RF-SD-030 (flujo de aprobación de pedidos por monto) | No | El control de crédito ya cumple el propósito real (bloquear si excede límite); no hay aprobación gerencial adicional por monto de pedido | — | Cubierto por control de crédito (M6) |
| RF-SD-031 (propuesta de entrega desde pedidos liberados) | No | XXOil no separa "entrega" de "factura" como documentos distintos — factura y despacho van juntos | — | No aplica al modelo actual |
| RF-SD-032 (agrupar entregas de varios pedidos) | No | Ligado al RF anterior | — | No aplica |
| RF-SD-033 (picking con orden de transporte interno) | No | Ver `WM-EWM.md` — no aplica (M4) | — | No aplica |
| RF-SD-034 (salida de mercancía de la entrega) | Sí (ya hecho) | Ocurre al facturar/despachar | **Obligatorio (ya hecho)** | `postearVenta` (M11) |
| RF-SD-035 (packing/handling units) | No | M4 | — | No aplica |
| RF-SD-036 (modificar/anular entrega antes de salida) | Sí (ya hecho, vía anulación de pedido/factura) | `anularPedido` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-037 (guía de remisión) | Sí (ya hecho) | `GuiaRemision` electrónica | **Obligatorio (ya hecho)** | M11 |
| RF-SD-038 a 040 (planificación de rutas de transporte, transportista/vehículo/flete, seguimiento) | Parcial | Ver `TM.md` — hay gaps reales ahí (vincular despacho a `Equipo`, estado de ejecución) | Ver `TM.md` | `GuiaRemision` (M11 parcial) |
| RF-SD-041 a 043 (comercio exterior: exportación, licencias, incoterms) | No | XXOil opera 100% doméstico (Perú), sin exportaciones hoy — aunque la visión de expansión internacional existe, no está en alcance de esta fase | Fase 3+ (ligado a expansión internacional) | No existe |
| RF-SD-044 (factura desde entrega o pedido) | Sí (ya hecho) | `facturarPedido` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-045 (facturación colectiva de varios pedidos) | No | XXOil factura pedido por pedido — bajo volumen no justifica consolidación | Fase 3+ | No existe |
| RF-SD-046 (notas de crédito/débito referenciadas) | Sí (ya hecho, NC) | `NotaCredito`; nota de débito no existe como documento propio (el recargo por mora incrementa el saldo directo, decisión de diseño ya validada en sesiones anteriores) | **Obligatorio (ya hecho, NC); ND no aplica por diseño** | `NotaCredito` (M11) |
| RF-SD-047 (cálculo automático de impuestos en factura) | Sí (ya hecho) | M11 | **Obligatorio (ya hecho)** | M11 |
| RF-SD-048 (documento contable de factura integrado con FI) | Sí (ya hecho) | `postearVenta` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-049 (bloqueo de facturación por disputa/calidad) | No | No existe un bloqueo formal de facturación; se resolvería no facturando manualmente | Baja | No existe |
| RF-SD-050 (comprobante electrónico SUNAT) | Sí (ya hecho) | `ComprobanteElectronico` (adapter OSE) | **Obligatorio (ya hecho)** | M11 |
| RF-SD-051 (historial de facturación por cliente/pedido) | Sí (ya hecho) | `comercial/facturas` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-052 (anulación/reverso de factura) | Sí (ya hecho) | `postearAnulacionFactura` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-053 (backlog de pedidos pendientes de entrega/facturación) | Deseable | Reporte de bajo esfuerzo sobre datos existentes | Media | No existe como reporte dedicado |
| RF-SD-054 (ventas por cliente/material/zona/vendedor) | Sí (ya hecho) | Dashboard ejecutivo + reportes ya cubren esto | **Obligatorio (ya hecho)** | M11 |
| RF-SD-055 (análisis de márgenes: precio/costo/descuento) | Sí (ya hecho) | `finanzas/costos`, `finanzas/rentabilidad` | **Obligatorio (ya hecho)** | M11 |
| RF-SD-056 (extracción a BI) | No | M7 | — | No existe |
| RF-SD-057 a 061 (integración MM, FI, CO, PP, WM/EWM) | Sí (ya hecho, salvo WM/EWM que no aplica) | Todo integrado | **Obligatorio (ya hecho)** | M11 |
| RF-SD-062 a 065 (transversales: SoD, trazabilidad oferta→cobro, no eliminación física, multi-moneda/idioma/organización) | Sí (ya hecho, salvo multi-org) | El flujo completo Cotización→Pedido→Factura→Cobro es trazable; multi-organización de ventas no aplica (una sola fuerza de ventas) | **Obligatorio (ya hecho)** | M11 |

**Resumen:** de 65 RF, **29 ya están construidos** (el ciclo Order-to-Cash completo, incluidas las regularizaciones explícitamente pedidas por el usuario), **1 tiene un gap real menor** (ATP no considera producción planificada), **6 son deseables de fase 2**, y **29 no aplican** por ser comercio exterior/multi-organización/logística avanzada que no corresponde hoy.
