# 03 — Matriz de organización

**Alcance del documento**: mapea las unidades organizativas estándar de un ERP tipo SAP S/4HANA (Sociedad, Planta, Almacén/Ubicación de almacenamiento, Organización de compras, Organización de ventas, Área de controlling, Segmento de crédito, Estructura de RR.HH.) contra lo que existe realmente en `prisma/schema.prisma` y su uso en `src/`. Cada fila cita ruta + símbolo + evidencia textual. Clasificación: **verificado completo** · **parcial** · **solo UI** · **solo documentación** · **ausente** · **no aplicable justificado**.

> Metodología: este documento fue producido cruzando lectura directa de `prisma/schema.prisma` (líneas 1-2888, archivo completo) con lectura de `src/app/(app)/configuracion/empresas/{page,actions}.tsx` y `src/lib/empresas.ts`. Toda cita de línea es verbatim del código al momento de esta auditoría (2026-08-06).

---

## 1. Sociedad / Compañía (SAP: Company Code — Buchungskreis)

| Elemento SAP | Evidencia en el repo | Estado |
|---|---|---|
| Entidad legal independiente con libros propios | `model Empresa` — `prisma/schema.prisma:2874-2888`: `id, razonSocial, ruc, pais, monedaFuncional, esPrincipal, activa`. Sin más campos (sin dirección fiscal, sin representante legal, sin régimen tributario). | **Parcial** — existe el maestro, pero es un catálogo mínimo, no una entidad legal completa. |
| Multi-sociedad real con partición de datos por FK | **No existe.** Búsqueda exhaustiva en el esquema completo: cero relaciones `@relation` de cualquier modelo hacia `Empresa`. `empresaId String @default("1")` aparece como campo plano (no FK) en ~60 modelos — confirmado por grep de `empresaId` y de `@relation.*Empresa` en todo el archivo, sin resultados para lo segundo. | **Parcial, con evidencia textual propia del código admitiéndolo**: comentario verbatim en `prisma/schema.prisma:2864-2872`: *"Multi-empresa (fundación)... FASE 1 — alcance honesto: Cliente y Proveedor ya filtran de verdad por empresaId. El resto de módulos (Insumo, Pedido, Factura, Orden de Compra, Asientos, ConfiguracionEmpresa/tasas fiscales...) TODAVÍA opera solo contra la compañía '1' por defecto."* |
| Filtro real por sociedad activa en operación | `src/lib/empresas.ts:37-45` — `obtenerEmpresaActivaId()` lee una cookie httpOnly (`COOKIE_EMPRESA_ACTIVA`), no un campo de `Usuario`/`Sesion` en base de datos. Uso real confirmado **solo** en: `comercial/clientes/{page,actions}.tsx` y `catalogo/proveedores/{page,actions}.tsx` (filtran `where: { empresaId }`). Cero apariciones en `Pedido`, `Factura`, `OrdenCompra`, `MovimientoKardex`, `AsientoContable`, `Insumo`. | **Parcial — solo 2 de ~60 entidades con `empresaId` filtran de verdad.** El propio banner de la pantalla `configuracion/empresas/page.tsx:28-34` lo declara al usuario en producción. |
| Un juego de libros contable por sociedad | `PlanCuentas`, `Libro`, `AsientoContable` llevan `empresaId String @default("1")` pero sin FK ni filtro aplicado (ver arriba). Un asiento creado hoy es indistinguible de cuál "empresa" lo originó salvo por ese string sin garantía de integridad. | **Ausente** para el propósito de una sociedad independiente con libros propios; el dato existe pero no es fiable para separar resultados por sociedad. |
| Moneda funcional por sociedad | `Empresa.monedaFuncional String @default("PEN")` existe como campo, pero `ConfiguracionEmpresa.moneda` (singular, id fijo `"1"`) es el que realmente gobierna la moneda del sistema (`prisma/schema.prisma:41`). No hay evidencia de que `Empresa.monedaFuncional` de una sociedad no-principal se use en ningún cálculo. | **Parcial / solo UI.** |

**Conclusión de sección**: para una empresa grande con **varias compañías legales reales** (ej. XXOil Perú S.A.C. + una subsidiaria), el sistema hoy **no puede separarlas de forma fiable** más allá de Clientes y Proveedores. Esto es la brecha organizativa más grande del sistema y bloquea directamente el objetivo declarado del encargo ("varias plantas, almacenes, **compañías**, canales").

---

## 2. Planta (SAP: Plant — Werk)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Unidad organizativa "planta" distinta de "almacén de distribución" | **No existe como concepto propio.** `model Almacen` (`prisma/schema.prisma:1626-1655`) es un modelo único y plano: `id, empresaId, codigo, nombre, dirección..., encargado, activo`. Sin campo `tipo`, `rol` o `plantaId`. Grep de `plantaId` en todo el esquema: 0 resultados. | **Ausente.** |
| Rol "planta" inferido indirectamente | Un `Almacen` actúa como planta solo por tener un `CalendarioProduccion` asociado (`prisma/schema.prisma:1660-1676`, relación 1:1 opcional) y/o por tener un `CentroCosto` de `tipo: PRODUCCION` con `almacenId` apuntando a él (`prisma/schema.prisma:1962`). Es una convención de uso, no una regla de datos. | **Parcial, por convención — no forzado por el esquema.** |
| Planificación de capacidad por planta | `CalendarioProduccion` (horas laborables por día de semana + `DiaNoLaborable`) sí existe por almacén y alimenta el módulo Proyecciones (confirmado en `README.md`: "capacidad configurada"). | **Verificado completo**, dentro del alcance limitado de "capacidad = horas disponibles", sin ruteo de operaciones ni centros de trabajo (ver Blueprint 04, PP-PI). |
| MRP a nivel planta | El módulo MRP (`/logistica/mrp`) sugiere compras cruzando demanda proyectada contra fórmulas — no hay evidencia de que corra por planta individual dado que no existe el concepto de planta como unidad de planificación separada. | **Parcial**, pendiente de confirmar con evidencia de `src/lib` (ver Blueprint 04). |

**Conclusión de sección**: con varias plantas físicas reales, el sistema las modelaría hoy como `Almacen` sueltos sin relación jerárquica ni de consolidación entre sí — cada una es una fila independiente sin unidad organizativa que las agrupe bajo una misma sociedad de forma confiable (dado el hallazgo de la sección 1).

---

## 3. Almacén / Ubicación de almacenamiento (SAP: Storage Location)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Almacén como unidad de stock | `model Almacen` + `model SaldoAlmacen` (`prisma/schema.prisma:445-460`, saldo por `almacenId + tipoItem + presentacionId/insumoId`, con `@@unique` que garantiza un solo saldo por combinación). | **Verificado completo.** |
| Sub-ubicación dentro del almacén (bin/zona) | `model ZonaAlmacen` (`prisma/schema.prisma:1690-1703`): `codigo` (ej. "A-01", "RACK-2"), `nombre`, relación 1:N con `Presentacion`/`Insumo` vía `zonaAlmacenId` opcional en cada uno. | **Verificado completo**, a nivel de "una zona por ítem" — no hay slotting multi-nivel (pasillo/rack/nivel) ni cantidad por zona (un ítem apunta a una sola zona, no a un stock distribuido en varias). |
| Traslados entre almacenes y entre zonas del mismo almacén | Confirmado por inventario funcional de esta sesión: `/inventario/traslados` (`crearTraslado`, `reubicarZona`) — modelado como par de `MovimientoKardex` (`OrigenMovimiento.TRASLADO`, `prisma/schema.prisma:410`). | **Verificado completo**, a nivel transaccional simple (sin transferencia en tránsito / stock-in-transit como unidad separada). |
| Almacén con rol logístico (recepción, picking, packing) | No hay campos ni modelos de proceso de almacén tipo WM/EWM (tareas de picking, oleadas, HU — unidades de manejo). | **Ausente** — ver Blueprint 04, dominio EWM. |

---

## 4. Organización de compras (SAP: Purchasing Organization / Purchasing Group)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Organización de compras como unidad independiente de la planta | No existe un modelo `OrganizacionCompras`. `OrdenCompra.almacenId` (`prisma/schema.prisma:1206`, opcional) asocia la orden directamente a un almacén de destino, sin capa intermedia de organización de compras compartida entre varias plantas. | **Ausente.** |
| Grupo de compradores | No existe (`Usuario.rol` es el único agrupador de personas, sin grupo funcional de compras). | **Ausente.** |
| Aprobación por monto | `OrdenCompra.estadoAprobacion EstadoAprobacion` (`prisma/schema.prisma:1223`), umbral en `ConfiguracionEmpresa.montoAprobacionCompras` (línea 55, un único valor global, no por organización de compras ni por planta). | **Verificado completo** como control simple de un solo umbral; **ausente** como esquema de liberación (release strategy) multi-nivel de SAP. |

---

## 5. Organización de ventas (SAP: Sales Organization / Distribution Channel / Division)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Organización de ventas distinta de la sociedad | No existe modelo propio. Las ventas cuelgan directamente de `Cliente`/`Vendedor`/`Zona`, sin capa de "organización de ventas" que agrupe varias plantas o pueda vender el mismo material bajo condiciones distintas por canal formal. | **Ausente como jerarquía SAP; parcialmente cubierto por conceptos análogos** (ver fila siguiente). |
| Canal de distribución | `enum CanalCliente` (`prisma/schema.prisma:782-790`: DISTRIBUIDOR, MAYORISTA, TALLER, FLOTA, MINERA_INDUSTRIA, MINORISTA, OTRO) en `Cliente.canal`, con `model DescuentoCanal` (798-801) aplicando descuento por canal. | **Verificado completo** como atributo comercial; no es una unidad organizativa con su propio libro de ventas ni segregación de reportes obligatoria. |
| División (línea de producto) | `model Categoria` (156-168) cumple un rol análogo a nivel de producto, no de organización de ventas. | **Parcial / análogo, no equivalente.** |
| Zona de ventas / territorio | `model Zona` (737-749), `Vendedor.zonaId`, `Cliente.zonaId`. | **Verificado completo.** |

---

## 6. Controlling (SAP: Controlling Area — Kostenrechnungskreis)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Área de controlling (agrupador de varias sociedades para CO) | No existe — sin concepto de área de controlling separado de `CentroCosto`. | **No aplicable a esta escala** si solo hay una sociedad real operando (ver hallazgo sección 1); **ausente** si se requiere consolidar CO entre varias sociedades reales. |
| Centro de costo | `model CentroCosto` (`prisma/schema.prisma:1956-1981`): `tipo` (PRODUCCION/VENTAS/ADMINISTRACION/LOGISTICA/OTRO), `almacenId` opcional, presupuesto mensual (`PresupuestoCentroCosto`), reglas de prorrateo (`ReglaAsignacionCosto` + `ReglaAsignacionCostoDetalle`, líneas 2053-2076), asignación transacción→centro (`CentroCostoControl`, 2083-2095). | **Verificado completo** para un esquema de centro de costo plano de un nivel. |
| Jerarquía de centros de costo (grupo de centros de costo) | **No existe.** `CentroCosto` no tiene `parentId` ni auto-relación — confirmado por comparación directa con `EdtProyecto` (WBS de Proyectos), que **sí** implementa jerarquía real vía `@relation("EdtJerarquia", ...)` con `parentId`/`hijos` (`prisma/schema.prisma:2214-2231`). El patrón existe en el código para otro módulo pero deliberadamente no se replicó en `CentroCosto`. | **Ausente**, con patrón de referencia disponible en el propio repo para implementarlo (ver Blueprint 09). |
| Orden interna (CO-OM-OPA) | `model OrdenInterna` (2012-2032) + `OrdenInternaCosto` (2034-2046): objeto de costeo temporal que liquida contra un centro de costo real. | **Verificado completo**, alcance reducido (sin categorías de orden interna ni liquidación parcial multi-destino). |
| Elemento PEP / WBS de proyecto | `model EdtProyecto` + `ActividadProyecto` + `PrecedenciaActividad` (2214-2271): WBS jerárquico real con ruta crítica (CPM) calculada en `src/lib/proyectos.ts` (función `recalcularRutaCritica()`, según comentario en `prisma/schema.prisma:2233-2235`). | **Verificado completo** para proyectos de obra de capital propia; sin nivelación de capacidad ni calendario de días hábiles (comentario explícito, línea 2170: *"alcance deliberado para 1-3 proyectos a la vez"*). |

---

## 7. Segmento de crédito / gestión de crédito (SAP: FSCM Credit Management)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Límite de crédito por cliente | `Cliente.limiteCredito Decimal @default(0)` (`prisma/schema.prisma:823`, comentario: "0 = sin límite; se valida al facturar"). | **Verificado completo**, como validación puntual en el momento de facturar — no como chequeo continuo (orden bloqueada apenas se supera el límite antes de facturar) ni como segmento de crédito compartido entre varias sociedades. |
| Bloqueo de cobranza | `Cliente.bloqueadoCobranza` + `bloqueadoCobranzaEn` + `bloqueadoCobranzaPor` (826-833), levantado manualmente desde `/finanzas/cobranza`. | **Verificado completo** como control binario simple. |
| Escalamiento de cobranza (dunning) | `model AvisoCobranza` (1024-1039): 3 niveles (amistoso/formal/final), `diasVencidos` snapshot. Es un **log de avisos emitidos**, sin `estado`/`resuelto` ni motor de reglas de escalamiento automático más allá de la clasificación por días (confirmada funcionalmente en Blueprint 01/02 de este mismo informe). | **Parcial** — existe el registro, no existe una máquina de estados de cobranza. |
| Workflow de aprobación de cambio de límite de crédito | Búsqueda exhaustiva de `EstadoAprobacion` en todo el esquema: sus únicos 2 usos son `OrdenCompra.estadoAprobacion` (línea 1223) y `PagoProveedor.estadoAprobacion` (línea 1521). Ningún modelo de crédito lo usa. No existe `SolicitudCambioCredito` ni tabla de auditoría específica para cambios de `limiteCredito` (más allá de que no hay historial en absoluto: es un campo mutable directo). | **Ausente.** |
| Gestión de crédito para Proveedor | `model Proveedor` no tiene ningún campo de límite de crédito (verificado campo por campo contra el modelo completo). | **No aplicable / ausente** — conceptualmente el crédito en compras corre en sentido contrario (nosotros como deudores), por lo que la ausencia aquí es esperable y no es un gap por sí sola. |

---

## 8. RR.HH. — estructura organizativa (SAP: Personnel Area / Personnel Subarea / Employee Group)

| Elemento SAP | Evidencia | Estado |
|---|---|---|
| Área de personal (equivalente a planta para RR.HH.) | `Empleado.almacenId String?` (`prisma/schema.prisma:2568`, opcional) — asocia al empleado a un almacén/planta física, sin modelo propio de "área de personal". | **Parcial**, vía reutilización del modelo `Almacen`. |
| Centro de costo del empleado | `Empleado.centroCostoId String?` (2569) — el costo de planilla puede pesar en el centro de costo correcto. | **Verificado completo.** |
| Grupo de empleados / tipo de contrato | `enum TipoContrato` (PLAZO_FIJO / PLAZO_INDETERMINADO / LOCACION_SERVICIOS, líneas 2516-2520). | **Verificado completo**, mapeo simple sin sub-grupos (ej. sin distinción obrero/empleado tipo antiguo régimen laboral peruano, aunque eso ya no es relevante en la práctica moderna). |
| Estructura organizativa jerárquica de reporte (organigrama) | No existe — `Empleado.cargo` y `Empleado.area` son campos de texto libre, sin relación jerárquica jefe→reporte ni catálogo estructurado de puestos/áreas. | **Ausente.** |
| Multi-sociedad en RR.HH. (empleados de distintas entidades legales) | `Empleado.empresaId` sigue el mismo patrón de tag no-FK de la sección 1 — no filtra de verdad (no está en la lista de los 2 módulos que sí filtran). | **Parcial / heredado del gap de sociedad.** |

---

## Resumen ejecutivo de la matriz organizativa

| Unidad organizativa SAP | Estado global |
|---|---|
| Sociedad (Company Code) | **Parcial** — maestro existe, aislamiento de datos real solo en 2 de ~60 entidades |
| Planta (Plant) | **Ausente** como unidad propia; presente por convención vía `Almacen` + `CentroCosto` |
| Almacén / Ubicación | **Verificado completo** (con zonas, sin slotting multi-nivel) |
| Organización de compras | **Ausente** |
| Organización de ventas | **Ausente** como jerarquía; canal/zona cubren parte del rol |
| Controlling / centro de costo | **Verificado completo** (plano); jerarquía **ausente** |
| Segmento de crédito | **Parcial** (límite + bloqueo sí, workflow de aprobación no) |
| RR.HH. — área de personal | **Parcial**, vía reutilización de `Almacen`/`CentroCosto` |

**El hallazgo más material de este documento**: la ausencia de una relación `@relation` real desde el grafo transaccional (`Pedido`, `Factura`, `OrdenCompra`, `MovimientoKardex`, `AsientoContable`, `Insumo`, etc.) hacia `model Empresa` (`prisma/schema.prisma:2874-2888`) significa que, tal como está hoy, **el sistema no puede operar de forma segura con más de una sociedad legal real** — cualquier intento de "varias compañías" mezclaría datos financieros y de inventario sin aislamiento verdadero, exactamente como el propio comentario del esquema lo admite. Este es el prerrequisito de la primera oleada del roadmap (Blueprint 09).
