# Qué le falta a este ERP — cruce con Epicor y con SAP de industria de proceso

Fecha de corte: **2026-11-05**. Pedido: validar qué falta para que esto sea «un verdadero ERP», cruzando contra Epicor y contra SAP para industrias.

Hay dos cruces previos y este no los repite:

- `docs/gobernanza/02-cruce-rf/` — 17 catálogos de requisitos SAP, cerrado el 2026-08-04.
- `docs/blueprint-empresarial/04-fitgap-sap.md` — fit/gap por dominio (FI/CO, SD, MM, PP-PI, QM, PM, EWM, TM, PS, HCM, EHS, GRC, BI), corte 2026-08-06.

Los dos miran **SAP**. Epicor solo aparece citado de pasada en tres documentos (`docs/densidad-masa-volumen.md`, `docs/tanques-mezcla-lotes.md`, `docs/gobernanza/00-inventario-erp-actual.md`), y nunca como catálogo de contraste. Eso es lo nuevo acá.

Lo segundo nuevo es la fecha. El blueprint se escribió sobre **83 modelos**; hoy el esquema tiene **183**. La mayor parte de sus P0/P1 ya se construyó, así que la primera sección es una revalidación, no un hallazgo.

Regla que se siguió: cada afirmación cita ruta y símbolo. Donde no hay evidencia, dice que no hay evidencia, no «parcial».

---

## 1. Lo que el blueprint de agosto marcaba como P0/P1: 11 de 12 cerrados

Comprobado contra el código de hoy, no heredado del documento.

| # | Gap de agosto | Estado hoy | Evidencia |
|---|---|---|---|
| 1 | FI/CO — multi-sociedad real con FK | **Cerrado** | `empresaId` en ~149 de 183 modelos (307 apariciones en `prisma/schema.prisma`); 30 documentos `docs/aislamiento-multiempresa-*.md`; `npm run fugas:entre-empresas` |
| 2 | PP-PI — centro de trabajo con capacidad | **Cerrado**, y más de lo pedido | `model CentroTrabajo`; `src/lib/planificacionCapacidad.ts` → `programarCapacidadFinita` (calendario por centro, días no laborables, preparación + máx(máquina, mano de obra), cadena de predecesoras); pantalla `/produccion/capacidad` |
| 3 | EWM — partición de cantidad por bin/zona | **Cerrado** | `model SaldoZona` con índice único real y `itemId` no nuleable; `docs/particion-stock-por-zona.md` |
| 4 | EHS — sistema de gestión de SST formal | **ABIERTO** | cero modelos; ver §2 |
| 5 | SD — verificación de crédito en la toma del pedido | **Cerrado** | `model CreditoCliente`, `SolicitudCambioCredito`, `AplicacionCreditoCliente`; `docs/aprobacion-limite-credito.md` |
| 6 | MM — RFQ y liberación de compras multinivel | **Cerrado** | `RfqCompra`, `RfqCompraLinea`, `OfertaRfq`, `OfertaRfqLinea`, `NivelAprobacionCompra`, `PasoAprobacionCompra`; `/logistica/rfq`, `/configuracion/aprobaciones-compras` |
| 7 | QM — certificado de análisis con valores medidos | **Cerrado** | `CaracteristicaPlanCalidad`, `ResultadoCaracteristicaCalidad`, `CaracteristicaPlanInsumo`, `MedicionInspeccionCompra`, `InstrumentoMedicion`, `CalibracionInstrumento`, `ReanalisisEnvasado`; pantalla `/produccion/calidad/certificados/[loteId]` |
| 8 | PM — jerarquía de ubicación técnica | **Cerrado** | `model UbicacionTecnica`; `/produccion/mantenimiento/ubicaciones` |
| 8b | MRP — neteo de reservas y pedidos firmes | **Cerrado** | ya marcado en el propio blueprint |
| 9 | HCM — estructura organizativa jerárquica | **Cerrado** la estructura; **abierto** su cruce con capacitación SST | `PosicionOrganizativa`, `AsignacionPosicion`, `/rrhh/organigrama`. El cruce no puede existir porque SST no existe (§2) |
| 10 | GRC — motor de conflictos de SoD | **Cerrado** | ya marcado; `GrupoSeguridad`, `CampanaCertificacionAccesos`, `CertificacionAcceso`, `/configuracion/certificacion-accesos` |
| 11 | CO — jerarquía de centros de costo | **Cerrado** | `CentroCosto`, `CentroCostoControl`, `000-Governance/010-AI/centros-costo-jerarquia/` |
| 12 | BI — medir si el volumen exige separar reportes | Sigue siendo una pregunta de medición, no un gap | — |

**Nota importante sobre el certificado de análisis.** La memoria de sesión decía que estaba diferido porque «`ControlCalidad` solo captura aprobado/rechazado, no valores medidos por parámetro». Eso **ya no es cierto**: existe el plan con características, el resultado por característica, el instrumento con su calibración y el reanálisis. Esa nota de memoria está vencida.

El saldo de la sección: de los cuatro P0 de agosto, tres están cerrados y **queda uno**.

---

## 2. El único P0 de agosto que sigue abierto: SST y gestión ambiental

Cero modelos. `grep` de `capacitacion`, `examen medico`, `iperc`, `accidente`, `residuo`, `ambiental`, `45001` sobre `prisma/schema.prisma`, `src/lib` y `src/app` no devuelve nada funcional.

Lo que sí existe es el **catálogo de sustancia peligrosa**, y conviene no subestimarlo: `Insumo.esPeligroso`, `Insumo.claseGhs`, `Producto.hojaSeguridadUrl`, y la SDS/MSDS adjunta por el DMS genérico (`model Adjunto`). Eso cubre clasificación y hoja de seguridad.

Lo que no existe: IPERC, registro de accidentes e incidentes, exámenes médicos ocupacionales, capacitación con su constancia, entrega de EPP, SCTR, y del lado ambiental el manifiesto de residuos peligrosos.

El propio blueprint lo marcó como **crítico y legal, no funcional**: Ley 29783 obliga a partir de 20 trabajadores, y SUNAFIL exige registros con formato. Una fabricante de lubricantes con varias plantas está muy por encima de ese umbral, y genera residuos peligrosos regulados.

**Esta es la respuesta corta a «qué falta para que sea un verdadero ERP»**: casi nada en lo funcional, y esto en lo legal. Es lo único de la lista que no es una mejora sino una exposición.

Con una salvedad honesta: SST es el módulo donde más fácil se inventan requisitos. Los registros que SUNAFIL exige tienen formato definido, así que acá el camino correcto es pedir los formatos reales antes de modelar, no diseñar un IPERC de catálogo.

---

## 3. Lo que agrega el lente Epicor y el fit/gap SAP no miró

Esto es lo nuevo del encargo. Los cinco puntos salen de capacidades que Epicor Kinetic nombra como módulo propio y que el cruce SAP no levantó.

### 3.1 Secuenciación dependiente del orden: cambio de grado y limpieza entre productos incompatibles

El planificador finito existe y es bueno, pero su preparación es **fija por operación**: `cargaPlanOperacion(preparacion, maquina, manoObra)` en `src/lib/planificacionCapacidad.ts` suma un setup constante. No depende de qué se produjo antes en ese centro.

En mezcla de grasas y lubricantes eso es justamente la restricción que manda. Pasar de un grado a otro en el mismo reactor o línea de envasado puede exigir purga, flush o limpieza, y el costo de ese cambio depende del **par** (producto saliente, producto entrante) — no del producto entrante solo. Hay secuencias prohibidas: una grasa de litio después de una de calcio, un lubricante con aditivo de zinc antes de uno libre de cenizas.

Cero apariciones de `changeover`, `limpieza`, `purga`, `incompatib`, `contaminacion`, `secuenciacion` en el código. Hoy el sistema puede programar una secuencia perfectamente factible en horas y físicamente inviable en planta.

Epicor lo trata en APS; SAP lo trata con setup-key / matriz de transición en PP-PI. El cruce SAP de agosto no lo levantó.

### 3.2 Riqueza del lote y escalado de fórmula

`FormulaDetalle` lleva cantidades nominales. No hay concepto de **potencia, riqueza o concentración activa** del lote consumido.

Si un lote de aditivo ensaya 92% en vez del 100% nominal, la cantidad a cargar tendría que escalar para mantener el aditivo activo en especificación. Hoy la fórmula pide la cantidad nominal y la diferencia aparece después, como desviación de calidad en el producto terminado, sin que nadie pueda atribuirla al lote de entrada.

Lo llamativo es que **la mitad difícil ya está construida**: `ResultadoCaracteristicaCalidad` y `MedicionInspeccionCompra` ya capturan el valor medido del lote de entrada, y `docs/densidad-desde-calidad.md` ya usa un resultado de laboratorio para alimentar un cálculo. Falta el enganche, no el dato.

Epicor lo vende como inventario por potencia; SAP como gestión de lote con características derivadas y cantidad activa.

### 3.3 Captura en planta: paradas y OEE

Hay confiabilidad **de equipo** —`/produccion/mantenimiento/confiabilidad` calcula MTBF y MTTR, y `LecturaContadorEquipo` lleva contadores— pero no hay captura de **producción**: inicio y fin reales de operación, motivo de parada, velocidad real contra nominal, scrap por causa. Cero apariciones de `oee`, `tiempo muerto`, `disponibilidad_equipo`.

La consecuencia concreta: `/produccion/variaciones` puede decir que un lote costó más de lo estándar, pero no por qué. Sin motivo de parada, la variación de mano de obra es un número sin causa.

Epicor lo cubre con Mattec MES; SAP con confirmaciones de operación y motivos de desviación.

### 3.4 Código de barras, GS1 y terminal de almacén

`UnidadManipulacion` y `UnidadManipulacionContenido` modelan la unidad de manipulación, y `/logistica/oleadas-picking` modela la oleada. Pero cero apariciones de `barcode`, `gs1`, `escaner`, `codigo de barras`.

Es decir: la estructura de datos de un almacén moderno está, y la ejecución sigue siendo teclado. A la escala objetivo —varias plantas, alto volumen, lotes con trazabilidad obligatoria— capturar lote y unidad de manipulación a mano es donde se rompe la trazabilidad que el resto del sistema construyó con cuidado.

### 3.5 Capa de integración hacia afuera

Solo cuatro route handlers, y los cuatro son internos: `src/app/api/adjuntos/[id]/route.ts`, `src/app/api/planilla/[id]/archivo-pago/route.ts`, `src/app/api/ple/compras/route.ts`, `src/app/api/ple/ventas/route.ts`. Cero `apikey`, `bearer`, `webhook`.

No hay API autenticada hacia afuera, ni EDI, ni portal de cliente o de proveedor. Un cliente grande que pida su pedido por EDI, o un proveedor que quiera ver el estado de su factura, hoy no tiene por dónde.

Epicor lo empaqueta como Service Connect y los portales; SAP como IDoc/BAPI y los portales de proveedor.

---

## 4. Gaps en que los dos catálogos coinciden y que siguen abiertos

### 4.1 Costeo de importación (landed cost) — el que más distorsiona números hoy

`RecepcionCompraDetalle.costoUnitario` es el costo de la línea y es lo que alimenta el promedio ponderado (`src/lib/inventario.ts` → `actualizarCostoPromedioEntrada`). `OrdenCompra` lleva `moneda`, `tipoCambio` congelado y `total`, y nada más. Cero apariciones de `arancel`, `landed`, `importacion`, `gasto de aduana`.

No hay forma de repartir flete internacional, seguro, derechos, gastos de agente de aduana y almacenaje sobre las líneas recibidas. Si los aceites base y aditivos entran importados, el inventario queda costeado a valor de factura y **el costo real se subestima de forma sistemática** — lo que se propaga a `/finanzas/rentabilidad`, a `/produccion/variaciones` y al margen por producto.

**Esto no es lo que se difirió.** El blueprint difirió *comercio exterior* con un disparador explícito: «primer pedido real de cliente extranjero» (`09-roadmap-oleadas.md:212`, pregunta 19 en `10-preguntas-abiertas.md`). Eso es **exportación** — incoterms, factura de exportación. El costeo de importación es el lado de entrada y no está cubierto por ese diferimiento.

Salvedad: el repositorio no afirma en ninguna parte que los insumos sean importados. Lo sugieren las órdenes en USD con tipo de cambio congelado y la recepción a granel en tanques, pero **hay que confirmarlo antes de construir**. Si XXOil compra todo a importadores locales en soles, este punto se cae entero.

### 4.2 Stock en tránsito entre almacenes, plantas y compañías

Cero apariciones de `transito`. Un traslado descarga origen y carga destino; lo que está arriba del camión no es stock de nadie. Con una sola planta es un detalle; con varias plantas y ahora con varias compañías reales (§1.1), el material en viaje queda invisible para el MRP, para la valorización y para el ATP.

### 4.3 Gestión ambiental y residuos peligrosos

P1 de agosto, cero modelos hoy. Va junto con §2.

### 4.4 Lista de precios por cliente y rebate retroactivo — ya identificado, no es hallazgo

Lo anoto para cerrar el mapa, no como descubrimiento. `EscalonPrecio` es precio por volumen **de una misma línea de pedido** y cuelga de `Presentacion`, no del cliente. `DescuentoCanal` opera por canal. No hay lista por cliente ni rappel retroactivo por período.

El repositorio ya lo sabe y ya decidió el orden: `09-roadmap-oleadas.md:51` dice textualmente que **no se construyó la lista de precios** porque un `listaPreciosId` apuntando a un maestro vacío sería un dato que nadie usa, y que va como módulo propio. Esa decisión es correcta y no hay que revisarla.

### 4.5 Contrato o pedido abierto de venta

`AcuerdoSuministro` existe y es **solo del lado de compra** (`proveedorId`). No hay el espejo de venta: contrato anual con un cliente, con cantidad comprometida y liberaciones parciales. Es simétrico de lo que ya está construido, así que el patrón existe.

---

## 5. Lo que NO hay que construir

Esto importa tanto como la lista de arriba, porque el riesgo real de un cruce contra SAP y Epicor es traerse la ceremonia de los dos.

- **Consignación, subcontratación de stock y stock especial de proyecto.** Ya dispuesto: `docs/gobernanza/02-cruce-rf/MM-IM.md:28` — «XXOil no maneja ninguno de estos tres modelos de stock especial».
- **Maquila / tercerización de fabricación.** No es un olvido, es una pregunta de negocio abierta y registrada (pregunta 20 en `10-preguntas-abiertas.md`). Se construye el día que haya decisión, no antes.
- **Comercio exterior de salida.** Diferido con disparador explícito. Correcto.
- **Configurador de producto.** Epicor lo destaca, pero es para fabricación a pedido configurable. Acá la fabricación es a stock contra fórmula; un configurador no tendría qué configurar.
- **Reclutamiento, desarrollo de personal, field service.** Sin área que los use.

El blueprint de agosto ya había llegado a una conclusión que conviene repetir: *no se encontró sobre-ingeniería significativa*. Cada vez que se evaluó un catálogo de referencia, se construyó la sustancia y se descartó la capa de configuración multicliente. Eso se sostiene hoy.

---

## 6. Prioridad sugerida

| Orden | Qué | Por qué primero | Precondición |
|---|---|---|---|
| 1 | **SST y residuos peligrosos** (§2) | Es lo único con exposición legal, no funcional | Pedir los formatos que exige SUNAFIL antes de modelar |
| 2 | **Costeo de importación** (§4.1) | Distorsiona rentabilidad y variaciones hoy, en silencio | Confirmar que se importa |
| 3 | **Secuenciación con cambio de grado** (§3.1) | Es la restricción física real de la planta; hoy se puede programar lo inviable | Pedir la matriz de incompatibilidades y los tiempos de limpieza |
| 4 | **Stock en tránsito** (§4.2) | Ya se activó el disparador: hay varias plantas y varias compañías reales | — |
| 5 | **Riqueza del lote → fórmula** (§3.2) | El dato medido ya existe; falta el enganche | Confirmar qué insumos se compran por riqueza |
| 6 | **Captura en planta y OEE** (§3.3) | Le da causa a la variación de producción | — |
| 7 | **Código de barras / GS1** (§3.4) | Protege la trazabilidad que ya está construida | Decidir terminal |
| 8 | **Contrato de venta** (§4.5) | Simétrico de algo que ya existe | Confirmar que hay contratos anuales |
| 9 | **API externa / EDI / portales** (§3.5) | Depende de que un cliente o proveedor lo pida | Un caso real |

Los puntos 1, 2, 3, 5 y 8 **no se deben empezar sin su precondición**: son exactamente los casos donde construir sin el dato del negocio significa inventarle requisitos, que es lo que este repositorio viene evitando bien.

---

## 7. Resumen en una línea

Funcionalmente esto ya es un ERP: 183 modelos, 108 pantallas, SD/MM/PP-PI/QM/PM/FI/CO/TR/WM/TM/PS/HCM cubiertos, multi-compañía real, trazabilidad de lote a granel que ni SAP ni Epicor modelan de fábrica (`docs/tanques-mezcla-lotes.md`). Lo que falta no es un módulo que haga falta para «ser un ERP» — es **un cumplimiento legal pendiente (SST), un costo que se está subestimando (importación) y una restricción de planta que el planificador todavía no ve (secuenciación por grado)**. Lo demás de la lista es profundidad, y cada punto tiene su disparador escrito.

---

## 8. Arquitectura de datos: maestros y transacciones contra el modelo SAP

Las secciones anteriores miran módulos. Esta mira la **forma de los datos**, que es una pregunta distinta y se contesta distinto.

### Maestros

**8.1 No hay segmentación por planta de los parámetros.** SAP parte el maestro de material en vistas: general, por centro (tipo de planificación, punto de pedido, plazo, lote), por área de valoración (costo) y por almacén. Acá `Insumo` lleva `stockMinimo`, `plazoEntregaDias`, `cantidadMinimaCompra`, `multiploCompra` y `zonaAlmacenId` como **un solo valor por compañía**.

`docs/mrp-por-planta.md` resolvió el *stock* por planta —usa `SaldoAlmacen` en vez del agregado— pero los **parámetros siguen globales**: el punto de pedido de Lima y el de Arequipa están obligados a ser el mismo número aunque su plazo de reposición no lo sea. El tema está identificado a medias: ese mismo documento deja el modelo `Planta` separado condicionado a que el negocio confirme si una planta puede tener varios almacenes. Lo que no estaba anotado es la segmentación de los parámetros.

**8.2 El área de valoración es la compañía, no la planta.** `SaldoAlmacen` lleva solo `cantidad`, sin costo; el costo vive como un único `Insumo.costoUnitario` / `Presentacion.costoPromedio` por empresa. El margen por planta en `/finanzas/rentabilidad` sale mezclado.

Atenuante que vale reconocer: `/inventario/valorizacion` **sí** obtiene valor por almacén, porque `MovimientoKardex.costoUnitario` congela el costo vigente tras cada movimiento. El historial soporta la valoración por planta aunque el maestro no la tenga — falta cerrar el círculo, no construirlo.

**8.3 `Cliente` y `Proveedor` son maestros separados: no hay Socio de Negocio.** S/4HANA los unificó en Business Partner con roles porque la misma persona jurídica suele ser las dos cosas. Acá serían dos códigos, dos historiales de crédito y ninguna compensación automática. El terreno está preparado: `Direccion` y `Contacto` ya usan un patrón genérico `entidadTipo`/`entidadId`.

**8.4 Hay bitácora, no hay compuerta.** `AuditoriaMaestro` registra los cambios —equivalente de CDHDR/CDPOS— y la unicidad está bien puesta (`@@unique([empresaId, ruc])`, `[empresaId, sku]`, `[empresaId, codigo]`). Falta: aprobación para crear un maestro, exigencia de completitud por vista y detección de casi-duplicados. La baja lógica con `activo` está correcta.

### Transacciones

**8.5 El principio documental está bien implementado, y eso va primero.** `AsientoContable.reversadoPor`/`reversaA` reversa en vez de borrar; `MovimientoKardex.costoUnitario` congela la valorización histórica; `src/lib/trazabilidad.ts` usa eventos compensatorios «sin borrar el consumo original»; `PeriodoFiscal` y `TareaCierrePeriodo` controlan el período; `evaluarVerificacionFactura` hace el match a tres bandas OC↔recepción↔factura. Y el flujo documental tiene FKs tipadas en toda la cadena: `Cotizacion.pedidoId`, `Factura.pedidoId`, `GuiaRemision.facturaId` y `pedidoId`, `NotaCredito.facturaId`, `RecepcionCompra.ordenCompraId`.

**8.6 Falta el enlace entre la operación y su asiento.** `MovimientoKardex.referencia` es texto libre —«código de lote, envasado, factura, traslado, etc.»—, `AsientoContable.referencia` también, y `reversadoPor`/`reversaA` guardan el **número**, no el id. «Qué asiento corresponde a este movimiento de kardex» se responde cruzando cadenas. En SAP es una relación por clave en el flujo de documentos. Para un sistema cuya cultura entera es auditabilidad, es el hueco más incoherente con el resto.

**8.7 El posteo no es atómico con la operación, a propósito.** `postearAsiento()` es best-effort: si falta el control contable o el período está cerrado, la operación sigue y el fallo queda en `IncidenciaContable`. El argumento está escrito y es bueno. SAP hace lo contrario: documento de material y asiento en la misma unidad de trabajo. La consecuencia hay que decirla sin adornos: **el auxiliar y el mayor pueden divergir por diseño.**

Lo mismo con la cantidad, que vive en tres niveles (`Insumo.stock` agregado, `SaldoAlmacen`, `SaldoZona`).

**Esto último ya tiene detector.** Ver `docs/cuadre-inventario.md` y `npm run cuadre:inventario`: comprueba las cuatro invariantes de cantidad —y en su primera corrida cuadraron— e informa la diferencia de valor contra la cuenta contable sin pretender aprobarla.

### Qué agregar, en orden

| | Qué | Por qué |
| --- | --- | --- |
| 1 | ~~Cuadre automático de cantidad y valor~~ | **Construido**, ver `docs/cuadre-inventario.md` |
| 2 | **FK tipada** del movimiento y del asiento a su documento origen (`origen` + `documentoId`), dejando `referencia` para mostrar | Cierra §8.6. Mecánico para lo nuevo; lo histórico se queda en texto |
| 3 | **Segmentación por planta** de parámetros de planificación y de costo | Precondición: que el negocio confirme que las plantas operan con puntos de pedido y costos distintos |
| 4 | **Socio de Negocio** | Precondición: comprobar por RUC si hay entidades que son cliente y proveedor a la vez |
| 5 | **Compuerta de creación de maestros** | Cuando el volumen de altas lo justifique |
