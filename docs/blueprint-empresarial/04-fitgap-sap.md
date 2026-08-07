# 04 — Matriz fit/gap por dominio SAP

**Cómo leer este documento**: cada dominio SAP S/4HANA tiene una tabla con: requisito de referencia · **aplicabilidad** a la escala objetivo (fabricante grande, varias plantas, varios almacenes, varias compañías, canales múltiples, alto volumen) · evidencia en código (ruta:línea/función) · **estado** (verificado completo / parcial / solo UI / solo documentación / ausente / no aplicable justificado) · riesgo de dejarlo así · solución recomendada (estándar SAP / configuración / extensión propia / integración) · prioridad.

**Regla de re-examen aplicada en todo el documento**: cuando `docs/gobernanza/02-cruce-rf/*.md` marcó un requisito "No aplica" citando volumen/tamaño de la empresa (motivos M1/M2/M4 según la síntesis de gobernanza), este documento **no hereda esa conclusión** — la vuelve a evaluar contra el tamaño objetivo del encargo y declara explícitamente si sigue sin aplicar o si ahora es un gap real. Se cita la fuente original para que quede trazable qué cambió y por qué.

**Cómo distinguir el tipo de cada afirmación en las tablas siguientes** (columna por columna): la columna **Requisito** es siempre una referencia de proceso/control estándar SAP (marco de comparación, no una afirmación sobre este repositorio); la columna **Evidencia** contiene únicamente hallazgos confirmados por lectura directa del código (ruta:línea o función citada) — si una fila no tiene cita de archivo, es porque el propio código no ofrece evidencia (ausencia confirmada por búsqueda, no supuesta); la columna **Riesgo** es siempre una inferencia razonada a partir de la evidencia (nunca un hecho verificado en código, por eso se expresa como Alto/Medio/Bajo y no como cita); y toda fila que dependa de una tasa, umbral o vigencia normativa remite explícitamente a Blueprint 07 con la etiqueta **"requiere validación profesional"** en vez de afirmarse aquí como definitiva.

No se reproducen aquí los ~931 RF ya cruzados en `docs/gobernanza/02-cruce-rf/` fila por fila — sería redundante y no añade señal. Este documento se concentra en los requisitos **materiales a la decisión de diseño para una empresa grande**, con foco deliberado en los dominios donde la síntesis de gobernanza identificó descartes basados en tamaño (WM-EWM, MRP, CO, GRC, PP, HCM, MM, CRM/SD), y trata con más brevedad los dominios donde la evaluación previa fue por modelo de negocio (no por tamaño) y sigue siendo válida.

---

## FI/CO — Finanzas y Controlling

| Requisito | Aplicabilidad a escala grande | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Plan de cuentas único, mayor auto-contabilizado | Sí | `PlanCuentas`, `CuentaContable`, `AsientoContable`/`AsientoDetalle`, `ControlContable` (`prisma/schema.prisma:1814-1937`) | **Verificado completo** | — | — | — |
| Asientos inmutables, corrección por reverso | Sí | `reversarAsiento`, campos `reversadoPor`/`reversaA` | **Verificado completo** | Bajo | — | — |
| **Un plan de cuentas y un mayor por sociedad legal real** | Sí, obligatorio a esta escala | Blueprint 03 §1: `empresaId` no es FK real; `PlanCuentas`/`Libro`/`AsientoContable` no aíslan por sociedad de forma fiable | **Parcial → gap real a esta escala.** Fuente original: `docs/gobernanza/02-cruce-rf/CO.md`, descartado bajo M1 ("una sola sociedad, un solo plan de cuentas"). **Re-examinado: con varias compañías reales, esto deja de ser válido.** | **Alto** — riesgo de mezclar resultados financieros de compañías distintas sin aislamiento | Extensión propia: FK real `empresaId → Empresa.id` en el grafo transaccional completo, filtro obligatorio en cada query | **P0** |
| Centro de costo — jerarquía / grupo de centros de costo | Sí, con múltiples plantas | `CentroCosto` es plano, sin `parentId` (Blueprint 03 §6) | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/CO.md`, descartado bajo M1 ("~5-10 centros de costo" citado como justificación). **Re-examinado: varias plantas implican decenas de centros y necesidad real de agrupación (ej. "Todos los centros de Planta Chiclayo").** | Medio-Alto | Extensión propia: `parentId` auto-relacional en `CentroCosto`, mismo patrón ya usado en `EdtProyecto` (`@relation("EdtJerarquia")`) — **patrón de referencia ya existe en el propio repo** | **P1** |
| Centros de beneficio (profit center) con estado de resultados propio | Solo si se requiere reporte de rentabilidad por unidad de negocio independiente del centro de costo | No existe — `/finanzas/rentabilidad` agrupa por segmento de mercado/canal, no por unidad organizativa con balance propio | **Ausente, no aplicable justificado** si no hay unidades de negocio con P&L independiente; **gap real** si cada planta debe reportar utilidad propia | Medio | Configuración/extensión, evaluar tras confirmar necesidad real (Blueprint 10, pregunta abierta) | P2 |
| Reclasificación de costos, orden interna | Sí | `reclasificarCosto`, `OrdenInterna` (ciclo abierta→liquidada) | **Verificado completo** (alcance reducido: sin categorías de orden interna) | Bajo | — | — |
| Cierre de período formal (checklist, conciliaciones automáticas) | Sí, con volumen alto y varias plantas | `PeriodoFiscal.estado` binario (ABIERTO/CERRADO), sin lista de tareas de cierre | **Ausente** | Medio | Extensión propia: modelo de tareas de cierre con dependencias | P2 |
| Presupuesto y disponibilidad (AVC) | Sí | `PresupuestoCentroCosto`, bloqueo de gasto por exceso de presupuesto (confirmado en inventario funcional — Fase 1 #8 de la hoja de ruta previa) | **Verificado completo**, a nivel centro de costo (no a nivel de posición presupuestaria detallada) | Bajo | — | — |
| Multi-moneda funcional real (varias monedas de libro simultáneas) | Depende de si hay operación en el extranjero | `TipoCambio` (caché diario, `prisma/schema.prisma:2499-2507`), OC en USD con tipo de cambio congelado; PEN sigue siendo la única moneda funcional del mayor | **Parcial** — soporta transacciones puntuales en USD, no un libro paralelo en otra moneda | Bajo-Medio | Configuración si se requiere; ausente hoy | P2/P3 |
| Activos fijos: alta, depreciación, baja, venta | Sí | `ActivoFijo`, `DepreciacionActivo` (línea recta, tarea programada mensual) | **Verificado completo** — solo método de línea recta (sin unidades de producción, saldos decrecientes) | Bajo | Configuración si se requiere otro método | P3 |

---

## SD — Ventas y Distribución

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Ciclo cotización→pedido→factura→cobro | Sí | Ver Blueprint 02, L1.1 completo | **Verificado completo** (dominio más maduro según `docs/gobernanza/02-cruce-rf/SD.md`: 29/33 RF obligatorios ya cubiertos) | Bajo | — | — |
| Verificación de crédito en la toma del pedido | Sí, crítico con más clientes/volumen | Solo se valida `limiteCredito` al facturar (Blueprint 02, L1.1) | **Parcial → gap** | **Alto** a mayor volumen (riesgo de exposición de crédito no controlada entre el pedido y la factura) | Extensión propia: chequeo de crédito en `crearPedido`, no solo en `facturarPedido` | **P1** |
| Organización de ventas / canal de distribución / división como jerarquía formal | Sí, con varios canales reales | `CanalCliente` enum + `Zona`, sin jerarquía SAP formal (Blueprint 03 §5) | **Parcial**, cubierto por analogía, no por estructura equivalente | Medio | Evaluar si el nivel actual basta o se requiere jerarquía real (Blueprint 10) | P2 |
| Multi-organización de ventas (vender el mismo material bajo condiciones distintas por organización) | Solo si hay más de una fuerza de venta/oficina comercial independiente | No existe — `docs/gobernanza/02-cruce-rf/SD.md` lo descarta bajo "una sola fuerza de ventas" | **No aplicable justificado, pendiente de confirmar con negocio** (Blueprint 10) | Bajo, salvo que se confirme la necesidad | — | P3 |
| Nota de débito | Sí | Solo existe `NotaCredito`, sin modelo de nota de débito | **Ausente** | Bajo-Medio (caso de uso: cobro adicional post-facturación, ej. flete no facturado) | Extensión propia, mismo patrón que `NotaCredito` | P2 |
| Exportación / incoterms / factura de exportación | Solo si hay ventas al extranjero | `TipoDocumentoFiscal` ya soporta RUT/NIT/RFC/EIN/VAT/CI (`prisma/schema.prisma:2813-2823`) como base, sin documento de exportación ni incoterm | **Ausente, no aplicable hoy** — trigger documentado en `docs/gobernanza/05-disparadores-fase3-diferida.md` §11 (pedido real de cliente extranjero) | Bajo hasta que ocurra el trigger | Extensión propia cuando se confirme el primer pedido de exportación real — **no inventar formato sin especificación real** (disciplina ya declarada en el propio repo) | P3 (condicional) |
| Contratos/acuerdos marco de venta | Solo si hay clientes con acuerdo de precio/volumen a plazo | No existe — `EscalonPrecio` cubre precio por volumen en una sola línea, no un acuerdo vigente en el tiempo | **Ausente** | Medio, si existen distribuidores con contrato anual | Extensión propia | P2 |

---

## MM — Gestión de materiales (compras)

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Ciclo OC→recepción→verificación 3 vías→pago | Sí | Ver Blueprint 02, L1.2 | **Verificado completo** (20/24 RF obligatorios según `docs/gobernanza/02-cruce-rf/MM.md`) | Bajo | — | — |
| RFQ / cotización comparativa a varios proveedores | Sí, con mayor volumen de compra es material para negociación | No existe — confirmado por síntesis de gobernanza | **Ausente**, descartado antes por "no cotiza formalmente a varios proveedores" (volumen bajo) — **re-examinado: a mayor volumen de compra, la ausencia de comparación formal es un riesgo de gobernanza de compras, no solo de conveniencia** | Medio-Alto | Extensión propia: modelo `CotizacionCompra` (RFQ) previo a la OC | **P1** |
| Esquema de liberación de OC multi-nivel (por monto y por organización de compras) | Sí, con varias plantas/organizaciones de compra | Un solo umbral global (`ConfiguracionEmpresa.montoAprobacionCompras`) | **Parcial → gap a esta escala** | Medio-Alto | Extensión propia: reglas de liberación por planta/monto/categoría | P1 |
| Acuerdos marco / contratos de suministro | Con proveedores estratégicos de materia prima (aceites base, aditivos) es común a esta escala | No existe | **Ausente** | Medio | Extensión propia | P2 |
| Procura de servicios (no solo materiales) | Sí (mantenimiento tercerizado, fletes, servicios profesionales) | El modelo `OrdenCompra`/`Insumo` está centrado en materiales físicos; no hay línea de servicio | **Ausente** | Medio | Extensión propia o proceso manual controlado | P2 |
| Valuación de inventario (costo promedio ponderado) | Sí | `Insumo.costoUnitario`, recalculado en cada recepción | **Verificado completo** — sin soporte de otros métodos (FIFO, estándar) | Bajo | Configuración si se requiere otro método | P3 |

---

## MRP — Planificación de necesidades (transversal MM/PP)

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Explosión de demanda contra fórmulas para sugerir compra | Sí | `/logistica/mrp`, `calcularOperaciones()` en `src/lib/proyecciones.ts:146-186` — cruza `Proyeccion.detalles` contra `FormulaDetalle` de la fórmula activa por producto | **Verificado completo**, para el método único implementado | Bajo | — | — |
| **Origen de la demanda: pronóstico (`Proyeccion`), no pedidos firmes** | Sí, material a esta escala | `MrpPage` (`src/app/(app)/logistica/mrp/page.tsx:22-51`) lee `prisma.proyeccion.findMany(...)` y pasa `proyeccionCompleta.detalles` a `calcularDemanda`/`calcularOperaciones` — **en ningún punto de ese archivo ni de `calcularOperaciones` se consulta `Pedido`/`PedidoDetalle`** (confirmado por lectura completa de ambos archivos) | **Confirmado como diseño, no como error** — el MRP de este sistema es 100% forecast-driven (estilo S&OP), nunca neteado contra el backlog real de pedidos pendientes de despachar | Medio — un pico real de pedidos no reflejado aún en el pronóstico del trimestre no dispara sugerencia de compra hasta el próximo ciclo de Proyecciones | Extensión propia: netear también contra `Pedido` con `estado: PENDIENTE` como demanda adicional a la proyectada, no solo como sustituto | **P1** |
| **Inconsistencia interna verificada: MRP no descuenta stock ya reservado por pedidos reales** | Sí, material | `src/lib/proyecciones.ts:182`: `const unidadesAProducir = Math.max(0, d.demandaProyectada + d.stockMinimo - d.stock);` — usa `Presentacion.stock` (total), **nunca `Presentacion.stockReservado`**, confirmado leyendo `detallesBase` en `logistica/mrp/page.tsx:53-66` (no incluye `stockReservado` entre los campos mapeados). Contraste directo: la pantalla ATP (`comercial/atp/page.tsx:19`) sí calcula `stockDisponible = p.stock - p.stockReservado` para el mismo campo. | **Ausente — el propio sistema es inconsistente consigo mismo**: ATP sabe distinguir stock libre de stock comprometido: MRP no, para la misma entidad (`Presentacion`) | **Alto** — a mayor volumen de pedidos pendientes de facturar, el MRP puede subestimar la necesidad real de compra/producción porque cuenta como "disponible" stock que ya está prometido a clientes reales | Corrección de bajo esfuerzo: restar `stockReservado` en la misma línea (`proyecciones.ts:182`) | **P1, esfuerzo bajo — candidato a corrección temprana, no solo de roadmap largo** |
| Múltiples métodos de planificación (MRP determinístico, reorder-point, previsión de consumo) configurables por material | Con varias plantas/almacenes, cada uno con perfil de demanda distinto, es material | Un único método fijo | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/MRP.md`, 33/44 RF descartados bajo M1 ("XXOil usa un único método... no hay necesidad de mezclar métodos por material a este volumen"). **Re-examinado: varias plantas con distintos perfiles de rotación es exactamente el escenario que rompe la premisa de un solo método.** | Alto | Extensión propia: método configurable por material/planta | **P1** |
| Área de planificación (MRP area) — separación por almacén/planta | Sí, con varios almacenes reales | No existe — un solo cálculo global | **Ausente**, mismo motivo M1 de origen, **re-examinado como gap real a esta escala** (depende de 0.3 en Blueprint 09, planta como unidad real) | Alto | Extensión propia, tras resolver la unidad "planta" (Blueprint 09, 0.3) | P1 |
| Stock de seguridad / punto de reorden | Sí | `Presentacion.stockMinimo` existe y se usa (`proyecciones.ts:182`), pero es un umbral fijo por presentación, no un cálculo dinámico de stock de seguridad basado en variabilidad de demanda/lead time | **Parcial** | Medio | Configuración/extensión si se requiere cálculo dinámico | P2 |

---

## PP-PI — Planificación y fabricación de proceso

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Receta maestra versionada, orden de proceso, consumo por fórmula | Sí | Ver Blueprint 02, L1.3 | **Verificado completo** (18/21 RF obligatorios según `docs/gobernanza/02-cruce-rf/PP.md`, correctamente modelado como PP-PI y no PP-SFC discreto) | Bajo | — | — |
| Centro de trabajo con capacidad y tiempos estándar | Sí, con varias plantas y múltiples líneas de envasado esto es central para planificar | No existe — el lote es una transacción única sin fase/operación con tiempo estándar por centro de trabajo | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/PP.md`, descartado por "no hay 'puestos de trabajo' con tiempos de mecanizado" bajo escala pyme. **Re-examinado: con varias plantas y líneas, la capacidad por centro de trabajo es la base de cualquier plan de producción confiable.** | **Alto** | Extensión propia: modelo `CentroTrabajo` con capacidad, vinculado a `Formula`/`LoteGranel` | **P0** |
| Múltiples plantas con producción paralela | Sí (el objetivo explícito del encargo) | `CalendarioProduccion` existe por almacén, pero sin unidad organizativa "planta" propia (Blueprint 03 §2); solo un almacén (Trujillo) actúa hoy como planta secundaria según la síntesis de gobernanza (`docs/gobernanza/02-cruce-rf/PP.md`: "parcial") | **Parcial** | Alto | Ver Blueprint 03/09 — depende de resolver primero el gap de sociedad/planta | P0 (depende de FI/CO P0) |
| Lista de materiales (BOM) más allá de la fórmula | La fórmula ya cumple el rol de BOM/receta para este negocio | `FormulaDetalle` | **Verificado completo, no aplicable como gap** | — | — | — |
| Subcontratación de fabricación (maquila) | Solo si XXOil terceriza producción de algún SKU | No existe | **Ausente, condicional** | Bajo, salvo que se confirme el caso de uso | — | P3 (Blueprint 10) |

---

## QM — Gestión de calidad

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Inspección de compra, control de lote, no conformidad, reclamo de cliente | Sí | Ver Blueprint 02, L1.10 | **Verificado completo** (dominio más maduro tras SD según `docs/gobernanza/02-cruce-rf/QM.md`: 14/16 RF obligatorios) | Bajo | — | — |
| Certificado de análisis con valores medidos por parámetro | Sí, típico de clientes industriales/mineros grandes que exigen certificado técnico | `ControlCalidad` solo captura aprobado/rechazado, no valores medidos | **Ausente.** Trigger ya documentado: `docs/gobernanza/05-disparadores-fase3-diferida.md` §13 ("cliente industrial/minero específico exige certificados con parámetros medidos") | Medio-Alto si el segmento minero/industrial crece | Extensión propia: modelo de parámetros medidos por lote | **P1** |
| Control estadístico de proceso (SPC) | Con mayor volumen de lotes por planta, es razonable | No existe, descartado antes por "volumen estadístico y madurez de proceso" insuficiente | **Ausente — re-examinar si el volumen de lotes por planta ya lo justifica** | Medio | Extensión propia o integración con herramienta SPC dedicada | P2 |
| Plan de inspección configurable por material/proveedor | Parcial hoy (`Insumo.requiereInspeccion` es un flag simple por insumo) | `prisma/schema.prisma:336` | **Parcial** | Bajo | Extensión: plan de inspección con criterios | P3 |

---

## PM — Mantenimiento de planta

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Mantenimiento preventivo por plan (tiempo/contador) y correctivo | Sí | Ver Blueprint 02, L1.6 | **Verificado completo** (8/12 RF obligatorios según `docs/gobernanza/02-cruce-rf/PM.md`) | Bajo | — | — |
| Ubicación técnica jerárquica (planta→línea→equipo→componente) | Sí, con varias plantas y cientos de activos esto deja de ser opcional | No existe — `Equipo` es plano | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/PM.md`, descartado por "planta + flota, no cientos de activos". **Re-examinado: a escala grande (varias plantas), cientos de activos es exactamente el escenario esperado.** | Alto | Extensión propia: jerarquía de ubicación técnica, mismo patrón auto-relacional que `EdtProyecto` | **P1** |
| Lista de materiales de mantenimiento (BOM técnico) | Con equipos complejos es útil | `RepuestoOrdenMantenimiento` solo registra consumo real, no una lista planificada por tipo de equipo | **Parcial** | Bajo-Medio | Extensión propia | P2 |
| Calibración de instrumentos críticos | Solo si hay instrumentos de medición que lo requieran | No existe, descartado antes por no tener instrumentos críticos | **No aplicable justificado, pendiente de confirmar con negocio** (Blueprint 10) | Bajo | — | P3 |

---

## EWM (modelado hoy como WM reducido) — Gestión de almacenes

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Almacén, zona, saldo por combinación, traslado, conteo cíclico | Sí | Ver Blueprint 03 §3, Blueprint 02 L1.4 | **Verificado completo** para el nivel "almacén simple" | Bajo | — | — |
| Partición de cantidad por bin/ubicación (no solo "una zona por ítem") | **Sí, crítico a alto volumen** — hoy `zonaAlmacenId` es un puntero único por presentación/insumo, no una tabla de cantidad-por-zona | `docs/gobernanza/010-AI/inventario-reubicacion-zonas/RN.md`, RN-REUB-003: la reubicación es "solo metadata," no mueve cantidad real por zona | **Ausente — el más citado como sobre-ingeniería antes (92/98 RF de `docs/gobernanza/02-cruce-rf/WM-EWM.md` descartados bajo M4), pero a alto volumen con varios almacenes esto dificulta el picking físico real y la exactitud de inventario por ubicación.** | **Alto** a alto volumen — sin esto, "dónde está exactamente cada unidad" no es una pregunta que el sistema pueda responder con precisión | Extensión propia: modelo `SaldoZona` (cantidad por zona, no solo un puntero), evolución natural de `SaldoAlmacen` | **P0** |
| Órdenes de picking, oleadas, unidad de manejo (HU) | Con alto volumen de despacho, sí | No existe | **Ausente**, mismo motivo M4 de origen — **re-examinar tras resolver la partición por bin (prerrequisito lógico)** | Alto, condicionado al ítem anterior | Extensión propia o evaluación de EWM real vía integración si el volumen lo justifica | P1 (después de P0 de partición por bin) |
| Cross-docking, slotting automático, robótica | Solo en operaciones de altísimo volumen | No existe | **No aplicable hoy, pendiente de confirmar volumen real** (Blueprint 10) | Bajo | — | P3 |

---

## TM — Gestión de transporte

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Guía de remisión electrónica, vínculo a equipo de flota propia, estado de despacho | Sí | Ver Blueprint 02 L1.4 | **Verificado completo** para flota propia | Bajo | — | — |
| Gestión de transportistas terceros / licitación de flete / tarifario de flete | Depende del modelo de distribución real a esta escala (probable si se distribuye a varias regiones) | No existe — descartado bajo supuesto de flota propia únicamente (`docs/gobernanza/02-cruce-rf/TM.md`, motivo M5) | **Ausente — pendiente de confirmar con negocio si a esta escala se sigue operando 100% con flota propia o se terceriza parte de la distribución** (Blueprint 10) | Medio, condicional | Extensión propia si se confirma tercerización | P2 (condicional) |
| Optimización de rutas | Con más vendedores/zonas, potencialmente útil | `HojaRuta` es planificación manual, sin optimización algorítmica | **No aplicable justificado hoy**, descartado antes por bajo número de vendedores — reevaluar si la fuerza de ventas crece sustancialmente | Bajo | — | P3 |

---

## PS — Gestión de proyectos (obras de capital propio)

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| WBS/EDT jerárquico, red de actividades, ruta crítica (CPM) | Sí | Ver Blueprint 02 L1.7 | **Verificado completo**, con exclusiones deliberadas documentadas (RN-PRY, `docs/gobernanza/010-AI/proyectos/RN.md`) | Bajo | — | — |
| Múltiples proyectos concurrentes de gran envergadura (ampliaciones simultáneas en varias plantas) | Sí, escenario esperado a esta escala | Diseño deliberadamente acotado a "1-3 proyectos a la vez" (`prisma/schema.prisma:2170`) | **Parcial — funciona, pero no fue diseñado ni probado para portafolio de proyectos concurrentes grande** | Medio | Validar con carga real antes de asumir que escala sin cambios; considerar nivelación de recursos si el portafolio crece | P2 |
| Aprobación de presupuesto por fase, nivelación de capacidad de recursos | Sí a esta escala | Ausentes por diseño (RN-PRY-002, exclusiones documentadas) | **Ausente, por diseño anterior — reevaluar si el volumen de proyectos concurrentes lo justifica** | Medio | Extensión propia | P2 |

---

## HCM — Recursos Humanos

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Ficha de personal, vacaciones, planilla con aportes legales, gratificación, CTS, liquidación | Sí | Ver Blueprint 02 L1.8; detalle de fórmulas en Blueprint 07 | **Verificado completo** funcionalmente (motor construido íntegro, `src/lib` de planilla) — **vigencia de tasas requiere validación profesional, ver Blueprint 07** | Bajo (funcional) / Medio (vigencia normativa) | — | — |
| Estructura organizativa jerárquica (organigrama, posiciones, jefe→reporte) | Sí, con más empleados y varias plantas esto deja de ser opcional | `cargo`/`área` son texto libre sin jerarquía | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/HCM.md`, descartado por "organización plana, no justifica un modelo de posiciones/jerarquía formal." **Re-examinado: una empresa grande multi-planta típicamente sí necesita reporte jerárquico real (para aprobaciones, headcount por gerencia, sucesión).** | **Alto** | Extensión propia: modelo de posición/puesto con jerarquía | **P1** |
| Autoservicio de empleado (ESS) y de jefatura (MSS) | Sí, a mayor headcount el autoservicio reduce carga administrativa | No existe | **Ausente.** Descartado antes por plantilla reducida — **re-examinar directamente contra el headcount objetivo** | Medio | Extensión propia (portal simple) o evaluar necesidad real primero (Blueprint 10) | P2 |
| Reclutamiento y selección | Depende de rotación/crecimiento de plantilla esperado | No existe | **Ausente, condicional** | Bajo-Medio | Extensión propia o proceso externo | P3 |
| Capacitación y desarrollo | Con requisitos de SST (ver Blueprint 07) esto se vuelve semi-obligatorio (capacitaciones de seguridad) | No existe | **Ausente — cruza con gap de SST, ver Blueprint 07** | Medio | Extensión propia | P1 (por el cruce con SST legal) |

---

## EHS — Seguridad y salud / medio ambiente

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Catálogo de sustancia peligrosa (SDS/GHS) a nivel insumo | Sí | `Insumo.esPeligroso`, `claseGhs` (`prisma/schema.prisma:340-341`) | **Verificado completo**, alcance de catálogo — sin gestión de incidentes ni SST formal | Bajo | — | — |
| Sistema de gestión de SST (Ley 29783), IPERC, registro de accidentes/incidentes, SCTR | **Sí, obligatorio por ley a partir de 20 trabajadores** (umbral concreto documentado en `docs/gobernanza/05-disparadores-fase3-diferida.md` §12) — una fabricante grande de lubricantes con varias plantas está muy por encima de ese umbral | No existe ningún modelo de SST más allá del catálogo de sustancias | **Ausente — esto deja de ser "fase futura condicional" y pasa a ser un requisito legal activo a la escala objetivo.** Ver Blueprint 07 para el detalle de cumplimiento. | **Crítico** — incumplimiento legal, no solo brecha funcional | Extensión propia + posible integración con proveedor especializado en SST (SUNAFIL exige registros específicos) | **P0** |
| Gestión ambiental (emisiones, residuos peligrosos — relevante para fabricación de lubricantes) | Sí, la fabricación de lubricantes genera residuos peligrosos regulados | No existe | **Ausente** | Alto (regulatorio) | Extensión propia o integración especializada | P1 |

---

## GRC — Gobierno, riesgo y cumplimiento

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Segregación de funciones básica vía grupos de seguridad | Sí | `GrupoSeguridad`/`PermisoGrupo`, aplicado de verdad (`src/lib/permisos.ts`, `puedeRealizar()` bloquea de verdad, no solo oculta UI — confirmado en Blueprint 08 con el agente de no funcional) | **Verificado completo**, a nivel de permisos por módulo (ver/crear/editar/aprobar) | Bajo | — | — |
| Pista de auditoría (quién/cuándo/por qué en cada registro, historia inmutable) | Sí | Patrón consistente en >15 modelos (Blueprint 01, sección N) | **Verificado completo** — es una fortaleza real del sistema, no solo un checkbox | Bajo | — | — |
| Revisión periódica de accesos | Sí | `docs/gobernanza/010-AI/configuracion-usuarios/RN.md` — alerta de inactividad 90 días | **Verificado completo**, alcance simple (alerta, no certificación formal) | Bajo | — | — |
| Motor de conflictos de SoD (matriz de combinaciones de permisos riesgosas) | Sí, con más usuarios y más roles el riesgo de combinaciones peligrosas (ej. "crea Y aprueba la misma OC") crece | No existe | **Ausente.** Fuente: `docs/gobernanza/02-cruce-rf/GRC.md`, 46/49 RF descartados bajo M2 ("no hay volumen de roles/usuarios que lo justifique"). **Re-examinado: a escala grande con más usuarios y más grupos de seguridad personalizados, la posibilidad de crear una combinación de permisos que viole SoD sin darse cuenta es real y hoy no hay nada que la detecte.** | **Alto** | Extensión propia: reglas de conflicto conocidas (ej. "quien crea una OC no debe poder aprobarla") validadas al asignar permisos | **P1** |
| Gestión formal de riesgos empresariales (registro de riesgos, matriz de probabilidad/impacto) | Con crecimiento de escala, la gestión "informal por gerencia general" deja de ser trazable | No existe | **Ausente — no aplicable justificado hasta que exista una función de Auditoría Interna o Riesgos, pero es el tipo de función que una empresa grande típicamente sí incorpora.** Marcar como pregunta de negocio (Blueprint 10). | Medio | Evaluar necesidad real primero | P2 |
| Certificación periódica de accesos (attestation) | Con más usuarios, sí | No existe (solo alerta de inactividad) | **Ausente** | Medio | Extensión propia | P2 |

---

## BI — Inteligencia de negocio

| Requisito | Aplicabilidad | Evidencia | Estado | Riesgo | Solución | Prioridad |
|---|---|---|---|---|---|---|
| Hub de reportes operativos, comparación de períodos | Sí | `/reportes`, `docs/gobernanza/010-AI/finanzas-comparacion-periodos/RN.md` | **Verificado completo** para el alcance de "reporte operativo sobre datos transaccionales en vivo" | Bajo | — | — |
| Modelo dimensional / data warehouse propio | Con alto volumen transaccional multi-planta, consultar directo contra la base operativa (SQLite/Postgres) para reportes históricos largos deja de ser trivial | No existe. Fuente: `docs/gobernanza/02-cruce-rf/BI.md`, 47/53 RF descartados bajo "todo el volumen cabe en consultas directas." **Re-examinado: a alto volumen multi-planta, esta premisa es exactamente la que hay que volver a probar con datos reales antes de descartar un almacén de datos separado.** | **Medio-Alto, condicionado al volumen real** | Medir antes de decidir: si las consultas de reporte empiezan a degradar el sistema transaccional, considerar una réplica de solo lectura o un data mart | P1 (medir), P2 (construir si se confirma) |
| Planeamiento colaborativo (tipo SAC/IBP) | El módulo Proyecciones ya cubre una versión reducida | `Proyeccion`/`ProyeccionDetalle` | **Verificado completo** en su alcance declarado (best-effort, sin motor de forecast estadístico avanzado) | Bajo | — | — |

---

## Resumen de prioridades P0/P1 (los gaps que más importan a esta escala)

**P0 — bloqueantes estructurales:**
1. FI/CO — Multi-sociedad real con FK (Blueprint 03 §1).
2. PP-PI — Centro de trabajo con capacidad (depende del punto 1 para tener "planta" como unidad real).
3. EWM — Partición de cantidad por bin/zona (hoy es solo un puntero).
4. EHS — Sistema de gestión de SST formal (obligación legal activa a este tamaño, ver Blueprint 07).

**P1 — alto impacto, no bloqueante para operar pero sí para escalar con control:**
5. SD — Verificación de crédito en la toma del pedido.
6. MM — RFQ / esquema de liberación de compras multi-nivel.
7. QM — Certificado de análisis con valores medidos.
8. PM — Jerarquía de ubicación técnica.
8b. **MRP — corrección de esfuerzo bajo y prioridad inmediata: `calcularOperaciones()` (`src/lib/proyecciones.ts:182`) no descuenta `Presentacion.stockReservado` al calcular necesidad de producción/compra, a diferencia de ATP que sí lo hace para el mismo campo — inconsistencia interna verificada, no solo brecha frente a SAP.**
9. HCM — Estructura organizativa jerárquica + su cruce con capacitación SST.
10. GRC — Motor de conflictos de SoD.
11. CO — Jerarquía de centros de costo (patrón ya existe en el repo, vía `EdtProyecto`).
12. BI — Medir si el volumen real ya exige separar reportes de la base transaccional.

El detalle de solución técnica, dependencias y criterios de aceptación de cada uno vive en Blueprint 09 (roadmap por oleadas).
