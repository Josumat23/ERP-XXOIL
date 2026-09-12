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

---

# Revisión contra el código — 2026-09-11

El diccionario de arriba conserva su texto y sus prioridades originales del **2026-08-06**. Esta sección lo audita campo por campo contra el código actual: qué se construyó, qué sigue faltando y qué dejó de aplicar.

## Campos que ya existen

| Maestro | Campo que faltaba | Prioridad original | Dónde está hoy |
|---|---|---|---|
| `Empresa` | FK real desde el grafo transaccional | **P0** | Los 79 modelos con `empresaId` llevan `@relation` hacia `Empresa` con `onDelete: Restrict`, y 68 `actions.ts` filtran por compañía activa. Guardias estructurales en `tests/critical-flows.test.ts`. |
| `Empresa` | `monedaFuncional` usada en cálculos | P1 | Llega al pedido y a la factura (`Factura.monedaFuncional`, `totalFuncional`, diferencia de cambio por cobro). |
| `Almacen` | `tipo`/`rol` | **P0** | `Almacen.tipo TipoAlmacen` — PLANTA / ALMACEN_DISTRIBUCION / ALMACEN_TRANSITO. El seed crea el almacén de producción como `PLANTA`, con prueba que lo exige. |
| `ZonaAlmacen` | `SaldoZona` (cantidad por zona) | **P0** | `model SaldoZona`, `@@unique([zonaAlmacenId, itemId])`. Ver `docs/particion-stock-por-zona.md`. |
| `CentroCosto` | `parentId` (jerarquía) | **P1** | `CentroCosto.parentId` + `CentroCostoJerarquia`, sin ciclos ni cruces de compañía, con agregación por subárbol. |
| `CentroCosto` | `companiaId` real (FK) | P1 | Cubierto por el P0 de `Empresa`. |
| `Cliente` | Historial de cambios de `limiteCredito` | **P1** | `model AuditoriaMaestro` (antes/después serializados, campos sensibles enmascarados), aplicado en `comercial/clientes/actions.ts`. |
| `Cliente` | Chequeo de crédito bloqueante en `crearPedido` | **P1** | `comercial/pedidos/actions.ts:213-247` — deja el pedido en `estadoAprobacionCredito: PENDIENTE`; la aprobación caduca si la deuda o el monto cambian (`esAprobacionCreditoVigente`). |
| `Usuario` | `intentosFallidos`, `bloqueadoHasta` | **P1** | Ambos campos existen y gobiernan el bloqueo de cuenta. |
| `Usuario` | Cookie con flag `secure` | **P1** | `src/lib/auth.ts` y `src/lib/empresas.ts` marcan `secure` cuando `NODE_ENV=production`. |
| `Empleado` | `jefeDirectoId` / `posicionId` | **P1** | `Empleado.jefeDirectoId` (auto-relación con prevención de ciclos) + `PosicionOrganizativa` + `AsignacionPosicion` con vigencias. |
| `Equipo` | `ubicacionTecnicaId` | P1 | `model UbicacionTecnica` jerárquica (`parentId`, `onDelete: Restrict`) por planta, y `Equipo.ubicacionTecnicaId`. |
| `OrdenCompra` | Referencia a cotización comparada (RFQ) | **P1** | `RfqCompra` + `RfqCompraLinea` + `OfertaRfq`, con adjudicación justificada y la OC colgando del RFQ. |
| `OrdenCompra` | Nivel de aprobación (jerarquía de liberación) | P1 | `model NivelAprobacionCompra` — por monto y por planta, aplicados en unión. |
| `ControlCalidad` | Valores medidos por parámetro | **P1** | `ResultadoCaracteristicaCalidad` (`valorMedido`, `limiteInferior`/`limiteSuperior`, `unidadMedida`, `metodoEnsayo`, `conforme`) + `PlanInspeccionCalidad` versionado. Certificado de análisis: `docs/certificado-analisis-calidad.md`. |
| Transversal | Change log genérico de maestros | P1 | `model AuditoriaMaestro` en **25** `actions.ts` de maestros. Ver `docs/auditoria-cambios-sensibles.md`. |

## Campos que siguen faltando

| Maestro | Campo | Prioridad | Estado verificado 2026-09-11 |
|---|---|---|---|
| ~~`Empresa` — datos de entidad legal completa~~ | P2 | **Construido el 2026-09-11.** De los tres, `direccionFiscal` **ya existía**: `ConfiguracionEmpresa` tiene dirección, ciudad, distrito, provincia, departamento y país, y desde el ciclo anterior una fila por compañía. Se agregan `representanteLegal`, `representanteLegalDocumento` y `regimenTributario` (catálogo cerrado: NRUS / RER / RMT / GENERAL). Los tres son **referencia informativa**: no gobiernan ningún cálculo. En particular el régimen **no cambia la tasa de IGV ni infiere obligaciones** — ese criterio es de un contador, no del código, y una prueba de la suite falla si alguien ramifica sobre él. Véase `docs/datos-entidad-legal.md`. |
| `Almacen` | `plantaId` (separación Werk→Lgort) | P1 | Ausente. Con `Almacen.tipo` la distinción de rol ya existe; lo que falta es la jerarquía planta→almacenes subordinados. Depende de una pregunta abierta de Blueprint 10. |
| ~~`ZonaAlmacen` — slotting multi-nivel~~ | (no priorizado) | **Construido el 2026-09-11.** `ZonaAlmacen.parentId` con la misma forma que `UbicacionTecnica`: pasillo → rack → nivel. El código sigue siendo único por almacén sin importar el nivel, porque una etiqueta debe identificar una sola ubicación, y borrar un pasillo con racks debajo se rechaza. El stock **no se migra**: sigue en la zona concreta, y la pantalla muestra siempre lo propio junto a lo del subárbol —un pasillo que dice "12" sin aclarar que once están en sus racks esconde el dato que hace falta para ordenar el almacén—. Véase `docs/slotting-multinivel.md`. |
| ~~`Cliente` — `ubigeoId` (FK estructurada)~~ | P2 | **Construido el 2026-09-11.** `ubigeoId` como clave foránea opcional hacia el catálogo SUNAT en `Cliente`, `Proveedor` y `Almacen`, con selector en cascada departamento → provincia → distrito. El id se valida contra el catálogo antes de guardarlo: un id inventado se guarda como `null`, nunca como clave foránea falsa. Los campos de texto libre se conservan —tienen direcciones que no corresponden a ningún distrito peruano— y se mantienen sincronizados con el ubigeo elegido. La migración empareja el texto existente solo cuando resuelve a un único distrito. De paso se descubrió que **nadie ejecutaba `seed-ubigeos.ts`**: el catálogo no se cargaba en una instalación nueva y los tres selectores habrían salido vacíos sin ningún error. Véase `docs/ubigeo-estructurado.md`. |
| ~~`Proveedor` — datos de ubicación~~ | P2 | **Construido el 2026-09-11.** Se le dio el `ubigeoId` estructurado y **no** la terna de texto libre que pedía el diccionario: copiarla habría reproducido la inconsistencia en vez de cerrarla, porque el FK ya da la ubicación y mejor. Véase `docs/ubigeo-estructurado.md`. |
| ~~`Proveedor` — historial/versión de condiciones comerciales~~ | P3 | **Construido el 2026-09-11.** `CondicionComercialProveedor` con vigencias **semiabiertas** `[desde, hasta)`: abrir una versión cierra la anterior en la misma fecha, así ninguna factura cae en dos condiciones ni en ninguna. El motivo es obligatorio, porque el ítem pedía trazar **por qué** cambió y una fecha sin motivo no lo contesta. No se puede insertar una versión anterior a la vigente: reescribiría el plazo bajo el que ya se recibieron facturas. El selector del maestro pasó a solo lectura —dos caminos para cambiar el mismo valor, uno sin historial, vacían la función— y una prueba falla si vuelve. Solo cubre el plazo de pago: el sistema no tiene hoy un descuento por proveedor que versionar. Véase `docs/condiciones-comerciales-proveedor.md`. |
| `Empleado` | `sctr` | **P1** | Ausente. **Bloqueado por confirmación profesional**: forma parte del módulo de SST y no se construye sin criterio profesional de seguridad y salud ocupacional. |
| ~~`Equipo` — lista de materiales técnica planificada~~ | P2 | **Construido el 2026-09-11.** `RepuestoPlanMantenimiento` cuelga del **plan**, no del equipo: un equipo no tiene "los repuestos que necesita", los necesita por trabajo. La ficha del equipo muestra el costo por ejecución y el anual proyectado. Está **separada del consumo real** a propósito: la orden generada desde un plan no se prellena con los repuestos previstos, porque eso daría por gastado lo que quizá no se usó y ese consumo mueve kardex y costo. Cuando las ejecuciones al año no se pueden estimar —planes por contador— dice "no estimable", no cero. Véase `docs/repuestos-planificados-mantenimiento.md`. |
| ~~`Factura` — `BOLETA`~~ | **P1** condicional | **Construido el 2026-09-12**, tras confirmar el negocio que el canal minorista existe. **La regla sale del documento del comprador, no del canal**: un cliente minorista que es empresa con RUC recibe factura, y una persona con DNI recibe boleta compre lo que compre. `tipoComprobantePara()` ni recibe el canal, y el tipo no sale de ningún campo del formulario — se deriva, no se elige. Destapó un defecto: el sistema ya aceptaba clientes con DNI pero declaraba su documento a SUNAT **fijo como RUC**; ahora sale del Catálogo 06. La serie tiene que decir la verdad: emitir una boleta numerada F001 se rechaza con un mensaje que explica por qué, en vez de corregirse en silencio. Véase `docs/boleta-de-venta.md`. |
| ~~`NotaCredito` — `model NotaDebito`~~ | P2 | **Construido el 2026-09-11, acotado al recargo por mora.** El catálogo 10 de SUNAT admite tres tipos; el sistema calcula por su cuenta **uno solo** —el recargo por mora sobre facturas vencidas— y emitir por aumento de valor o penalidad exigiría decidir cuándo corresponde y sobre qué base, decisión del negocio que no se inventa. Los tres códigos están en el enum; solo se emite el 01, y una prueba lo exige. **La nota no vuelve a cargar nada**: el recargo ya subió el saldo y ya posteó su asiento cuando se aplicó, así que emitir el documento no toca saldo ni contabilidad —tres pruebas lo protegen, incluida una que lee el código de la acción—. De paso se corrigió que el adaptador de envío directo a SUNAT elegía el XML con un ternario encadenado: una nota de débito se habría enviado **con la estructura de una guía de remisión** sin que nada lo advirtiera; ahora cada tipo se nombra y la ND se rechaza con un motivo claro en vez de mandar un XML inventado. Véase `docs/nota-debito-mora.md`. |
| ~~`AsientoContable` — alerta activa cuando una transacción no generó asiento~~ | P1 | **Construido el 2026-09-11.** `model IncidenciaContable` registra cada operación que no llegó a generar su asiento, con origen, glosa, referencia y el motivo exacto. El registro lo hace **`postearAsiento()` misma y no el llamador**: son 83 puntos de llamada, y pedirle a cada uno que atienda el valor de retorno es exactamente cómo se perdía el aviso. Se escribe dentro de la transacción de la operación, así que un rollback se lleva la incidencia con él. Visible en `/finanzas/incidencias-contables` y, sobre todo, en el semáforo del panel general, que pasa a **crítico** — una pantalla que hay que visitar no alerta si nadie sabe que debe visitarla. Véase `docs/incidencias-contables.md`. |
| ~~`PeriodoFiscal` — checklist de cierre de período~~ | P2 | **Construido el 2026-09-11.** Dos clases de punto, con orígenes distintos a propósito. **Verificaciones automáticas**: hechos verificables sobre los datos del propio período —operaciones sin asiento, comprobantes sin aceptar, período sin asientos—, que el sistema puede afirmar con certeza. **Tareas propias** con orden: el sistema aporta el mecanismo, **no el contenido** — qué incluye un cierre contable es criterio del contador y sembrar una lista por defecto sería inventar un procedimiento profesional; una prueba falla si algún seed empieza a sembrarlas. La dependencia es el orden: no se completa una tarea si queda alguna anterior pendiente. Cerrar sigue siendo decisión del contador —bloquearlo podría dejar los libros sin poder cerrarse por un dato menor— pero queda constancia en `pendientesAlCerrar`. Véase `docs/checklist-cierre-periodo.md`. |
| Transversal | Modelo de SST (IPERC, accidentes, exámenes médicos, SCTR) | **P0** | **Bloqueado por confirmación profesional.** |
| Transversal | Integración SIRE | **P0 (validar urgencia)** | **Bloqueado**: es una investigación normativa previa, no desarrollo. |
| Transversal | Consentimiento/retención de datos personales (Ley 29733) | P1 | **Bloqueado por confirmación profesional/legal.** |

## Campos que dejaron de aplicar

| Maestro | Campo | Motivo |
|---|---|---|
| `OrdenCompra` | `organizacionCompraId` | El negocio confirmó el 2026-09-12 que **las compras son centralizadas**: la organización de compras no existe como unidad propia (Blueprint 10, respuestas registradas). Modelarla obligaría a elegirla —o ignorarla— en cada alta de orden, sin aportar control. |
| `Cliente` | Segmento de crédito compartido entre compañías | Depende de que existan varias sociedades operando de verdad, lo que a su vez depende del hallazgo nuevo de abajo. Se mantiene en P2, sin trabajo hasta entonces. |

## Campo nuevo que faltaba y este diccionario no registraba — construido el mismo día

> **Cerrado el 2026-09-11** (ítem 0.2b del roadmap). `ConfiguracionEmpresa` tiene una fila por compañía con `empresaId` único, clave foránea y `onDelete: Restrict`; `obtenerConfiguracionEmpresa(empresaId)` exige compañía explícita y una compañía nueva no hereda RUC ni credenciales SUNAT. De paso se le dio tabla propia al cerrojo de correlativos, que usaba la fila única de configuración como mutex. Verificado en navegador con dos compañías de RUC e IGV distintos. Véase `docs/configuracion-por-compania.md`. La fila de abajo se conserva como quedó al detectarlo.

| Maestro | Campo faltante | Por qué se necesita | Prioridad |
|---|---|---|---|
| `ConfiguracionEmpresa` (`prisma/schema.prisma`, `id String @id @default("1")`) | `empresaId` como FK real, y una fila por compañía en lugar de la fila única `"1"` | Esa fila gobierna **razón social y RUC del emisor, moneda, tasa de IGV, credenciales SUNAT, umbral de aprobación de compras, alcance de aprobación jerárquica y recargo por mora**. Es el único maestro de configuración que quedó fuera del aislamiento por compañía: se lee con `where: { id: "1" }` clavado en 11 archivos. Una segunda sociedad legal real emitiría hoy sus facturas con el RUC y las credenciales SUNAT de la primera. No afecta a quien opera una sola compañía —el caso actual—, pero es el eslabón que falta para operar con dos. | **P0 para multi-sociedad; sin efecto operativo con una sola compañía** |

---

**Balance** (al detectar; el campo nuevo se construyó el mismo día): **16 campos/modelos construidos y verificados**, **2 que dejaron de aplicar** por decisión de negocio, **4 bloqueados** por confirmación profesional o legal (SST, SCTR, SIRE, Ley 29733) y **11 pendientes sin bloqueo**. El campo nuevo detectado en esta revisión (`ConfiguracionEmpresa` por compañía) y el más accionable de los 11 (la **alerta de transacción sin asiento contable**) se construyeron el mismo día; quedaban **9 pendientes sin bloqueo**. **Los nueve se construyeron entre el 2026-09-11 y el 2026-09-12**, salvo dos que siguen esperando una decisión ajena al código: `plantaId` jerárquico (pregunta abierta 2 del Blueprint 10) y `BOLETA` (depende de si hay canal minorista o venta de mostrador). Cada fila de arriba dice qué se construyó y con qué límite declarado.
