# 05 — Diccionario de campos faltantes por maestro y transacción

**Alcance**: esta no es una comparación campo-por-campo contra el diccionario de datos completo de SAP (miles de campos, en su mayoría no relevantes a esta operación) — es la lista de campos **materiales para operar a la escala objetivo** (fabricante grande, varias plantas/almacenes/compañías, alto volumen), ausentes hoy en `prisma/schema.prisma`, derivados directamente de los hallazgos de Blueprint 03 y 04. Cada fila cita el modelo actual y qué campo(s) faltan, con la razón de negocio y prioridad.

---

## `Empresa` (prisma/schema.prisma:2874-2888)

| Campo faltante | Por qué se necesita a esta escala | Prioridad |
|---|---|---|
| FK real desde el grafo transaccional (`Pedido.empresaId`, `Factura.empresaId`, etc. como `@relation`, no `String` suelto) | Sin esto, "varias compañías" no es una capacidad real — ver Blueprint 03 §1 | **P0** |
| `direccionFiscal`, `representanteLegal`, `regimenTributario` | Una entidad legal completa necesita estos datos para documentos formales, no solo `razonSocial`/`ruc` | P2 |
| `monedaFuncional` efectivamente usada en cálculos (hoy solo `ConfiguracionEmpresa.moneda` gobierna) | Cada compañía real puede tener su propia moneda funcional | P1 (depende del P0 de arriba) |

## `Almacen` (prisma/schema.prisma:1626-1655)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `tipo`/`rol` (PLANTA / ALMACEN_DISTRIBUCION / ALMACEN_TRANSITO) | Hoy la distinción es por convención (tener `CalendarioProduccion` o no) — ver Blueprint 03 §2 | **P0** |
| `plantaId` o equivalente si se separa "planta" de "almacén" como unidades distintas | Necesario si una planta tiene varios almacenes/ubicaciones de almacenamiento subordinados (patrón SAP Werk→Lgort) | P1 |

## `ZonaAlmacen` (prisma/schema.prisma:1690-1703)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| Modelo de cantidad por zona (`SaldoZona`, no solo `Presentacion.zonaAlmacenId`/`Insumo.zonaAlmacenId` como puntero único) | Un ítem hoy solo puede estar en una zona a la vez — imposibilita partición real de stock en distintos racks/posiciones. Ver Blueprint 04, dominio EWM | **P0** |

## `CentroCosto` (prisma/schema.prisma:1956-1981)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `parentId` (jerarquía) | Hoy es plano — ver Blueprint 03 §6. El patrón ya existe en el repo (`EdtProyecto.parentId`) y puede replicarse | **P1** |
| `companiaId` real (FK) | Para reportes consolidados de controlling entre varias sociedades | P1 (depende del P0 de `Empresa`) |

## `Cliente` (prisma/schema.prisma:803-850)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| Historial de cambios de `limiteCredito` (tabla de auditoría o workflow de aprobación) | Hoy es un campo mutable directo sin bitácora — ver Blueprint 03 §7 | **P1** |
| Chequeo de crédito bloqueante en `crearPedido` (no solo al facturar) | Ver Blueprint 02, L1.1 y Blueprint 04, SD | **P1** |
| `ubigeoId` (FK estructurada, hoy `departamento`/`provincia`/`distrito` son texto libre) | Consistencia de datos maestros a mayor volumen — ver Blueprint 07 §9 | P2 |
| Segmento de crédito compartido entre compañías (si aplica multi-sociedad) | Depende del P0 de `Empresa` | P2 |

## `Proveedor` (prisma/schema.prisma:276-307)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `departamento`/`provincia`/`distrito`/`ubigeoId` | Hoy solo tiene `direccion` de texto libre, ni siquiera los campos que sí tiene `Cliente`/`Almacen` — inconsistencia entre maestros | P2 |
| Historial/versión de condiciones comerciales (plazo de pago, descuentos) | Útil para trazar por qué cambió una condición pactada | P3 |

## `Usuario` (prisma/schema.prisma:121-138)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `intentosFallidos`, `bloqueadoHasta` | Sin esto no hay bloqueo de cuenta tras intentos fallidos de login — ver Blueprint 08 | **P1** |
| Flag `secure` a nivel de configuración de cookie (no es un campo de modelo, pero es la contraparte de sesión) | Ver Blueprint 08 | **P1** |

## `Empleado` (prisma/schema.prisma:2546-2597)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `jefeDirectoId` / `posicionId` (estructura jerárquica) | `cargo`/`área` son texto libre sin relación — ver Blueprint 03 §8 y Blueprint 04, HCM | **P1** |
| `sctr` (booleano/vigencia) | Ver Blueprint 07 §5/§6 — actividad de riesgo, obligación legal potencial | **P1** |

## `Equipo` (prisma/schema.prisma:2297-2325)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `ubicacionTecnicaId` (jerarquía planta→línea→equipo→componente) | Hoy es plano — ver Blueprint 04, PM | P1 |
| Lista de materiales técnica planificada (además del consumo real registrado en `RepuestoOrdenMantenimiento`) | Útil para presupuestar mantenimiento antes de ejecutarlo | P2 |

## `OrdenCompra` (prisma/schema.prisma:1201-1243)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| `organizacionCompraId` | Hoy la OC cuelga directo del almacén, sin capa de organización de compras compartida entre plantas — ver Blueprint 04, MM | P1 |
| Referencia a cotización comparada (RFQ) | No existe comparación formal de proveedores — ver Blueprint 04, MM | **P1** |
| Nivel de aprobación (hoy es un solo umbral global, no una jerarquía de liberación) | Ver Blueprint 04, MM | P1 |

## `Factura` / `NotaCredito` (prisma/schema.prisma:962-997, 1127-1160)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| Tipo de comprobante `BOLETA` en `TipoComprobanteElectronico` | Ausente para venta a consumidor final — ver Blueprint 07 §1 | **P1** (condicional a si hay canal minorista/mostrador) |
| Modelo `NotaDebito` | Ausente — ver Blueprint 07 §1 y Blueprint 04, SD | P2 |

## `ControlCalidad` (prisma/schema.prisma:585-605)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| Valores medidos por parámetro (viscosidad, punto de goteo, etc., no solo aprobado/rechazado) | Necesario para certificado de análisis a clientes industriales/mineros grandes — ver Blueprint 04, QM | **P1** |

## `AsientoContable` / `ControlContable` (prisma/schema.prisma:1880-1937)

| Campo faltante | Por qué | Prioridad |
|---|---|---|
| Alerta activa cuando una transacción no generó asiento por `ControlContable` faltante | Hoy es silencioso — ver Blueprint 06, patrón transversal best-effort | P1 |
| Checklist de cierre de período (tareas con dependencias, no solo abierto/cerrado) | Ver Blueprint 02, L1.5 | P2 |

## Transversal — auditoría de cambios

| Campo/modelo faltante | Por qué | Prioridad |
|---|---|---|
| Tabla de historial de cambios de campo (change log genérico) para catálogos editables (`Cliente`, `Proveedor`, `Producto`, `Presentacion`, etc.) | Los ledgers transaccionales sí son inmutables por diseño, pero editar un dato maestro no deja rastro de qué valor tenía antes — ver Blueprint 06, patrón transversal de auditoría, y Blueprint 04, GRC | P1 |

## Transversal — cumplimiento Perú (detalle completo en Blueprint 07)

| Modelo/campo faltante | Por qué | Prioridad |
|---|---|---|
| Modelo de SST (IPERC, accidentes/incidentes, exámenes médicos, SCTR) | Obligación legal activa a esta escala — ver Blueprint 07 §6 | **P0** |
| Integración SIRE (más allá de PLE) | Riesgo de vigencia normativa — ver Blueprint 07 §3 | **P0 (validar urgencia)** |
| Consentimiento/retención de datos personales (Ley 29733) | Ver Blueprint 07 §7 | P1 |

---

Cada uno de estos campos/modelos se retoma con solución técnica concreta y secuencia de implementación en Blueprint 09 (roadmap por oleadas).
