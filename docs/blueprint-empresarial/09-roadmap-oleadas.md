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

### 0.1 — ~~Corregir autorización faltante en envío de comprobantes SUNAT~~ — completado
- **Resultado** (verificado contra el código 2026-09-11): `enviarComprobanteFactura` y `enviarComprobanteNotaCredito` exigen `requerirRol(["VENTAS"])` y `puedeRealizar`. Una prueba de la suite falla si alguna de las dos vuelve a quedarse sin guarda de acceso.
- **Qué**: agregar `requerirRol(["VENTAS"])` + `puedeRealizar` a `enviarComprobanteFactura` y `enviarComprobanteNotaCredito` (`src/app/(app)/comercial/facturas/actions.ts`), igual que el resto de funciones del mismo archivo.
- **Dependencias**: ninguna — es una corrección aislada de una línea de código por función.
- **Criterio de aceptación**: un usuario sin sesión o con rol no autorizado recibe `{ error: ... }` al invocar la función; un usuario VENTAS/ADMIN sigue funcionando igual que hoy.
- **Prueba**: llamar la función server-side simulando `obtenerUsuario()` retornando `null` y con un usuario de rol ALMACEN; confirmar rechazo en ambos casos.
- **Rollback**: revertir el commit — sin efecto en datos, es solo una guarda de acceso.
- **Prioridad**: **crítica, esfuerzo mínimo — hacer antes que cualquier otra cosa de este documento.**

### 0.1b — ~~Corregir el MRP para incorporar pedidos reales~~ — completado
- **Resultado**: el MRP calcula saldo pendiente por presentación, consume el pronóstico con `max(pronóstico, backlog)` y muestra el neteo. Incluye pedidos parciales, vencidos/sin fecha y productos ausentes del pronóstico, sin doble conteo de `stockReservado`.
- **Verificación**: funciones puras en la suite normal, consultas aisladas por compañía y visualización en MRP/Proyecciones.

### 0.2 — ~~Multi-empresa real: FK completa en el grafo transaccional~~ — completado
- **Mitad de FK completada 2026-09-11:** los **76 de 76** modelos con `empresaId` tienen relación física hacia `Empresa`, en diez migraciones aditivas documentadas en `docs/integridad-fk-empresa-*.md`. Todas usan `onDelete: Restrict`. `prisma migrate diff` entre las migraciones versionadas y `schema.prisma` ya no reporta diferencias, y la suite audita el esquema para que ningún modelo nuevo con `empresaId` quede sin la relación (`docs/integridad-fk-empresa-auditoria-final.md`).
- **Mitad de aplicación completada 2026-09-11:** los **68 de 68** `actions.ts` resuelven la compañía activa antes de leer o escribir. Los cinco módulos de Configuración que faltaban se cerraron en tres ciclos: series y unidades de medida, almacenes/zonas/calendario, y grupos de seguridad/usuarios (`docs/aislamiento-multiempresa-series-unidades.md`, `docs/aislamiento-multiempresa-almacenes-calendario.md`, `docs/aislamiento-multiempresa-seguridad-usuarios.md`). Una prueba de regresión lee los cinco `actions.ts` y falla si vuelven a usar `requerirRol` de `@/lib/auth` o dejan de grabar con el `empresaId` de la compañía activa.
- **Excepción deliberada:** `configuracion/tareas-programadas` no se acota. Dispara a mano las mismas tareas de mantenimiento que el servidor corre por temporizador, que operan sobre toda la base y no sobre una compañía.
- **Supuesto adoptado (revisable):** usuarios y grupos de seguridad pertenecen a una compañía, y un ADMIN que necesite administrar los de otra cambia primero la compañía activa. Es el criterio que el sistema ya implicaba —`Usuario.empresaId` con índice único `(empresaId, usuario)`, y solo un ADMIN puede cambiar de compañía—, no una regla nueva. Si el negocio prefiere una administración central que vea todas las compañías a la vez, el cambio está acotado a esos dos módulos.
- **Criterio de aceptación ejecutado en pantalla 2026-09-11:** con `npm run dev:demo` sobre una base desechable se creó una segunda compañía, se cambió la activa y se recorrieron almacenes, ubicaciones técnicas, posiciones, clientes, usuarios, plan de cuentas y el panel general. Ninguna pantalla mostró datos de la otra compañía, y al volver a la primera los datos reaparecieron. El recorrido se repitió además con **ambas compañías pobladas** (`prisma/seed-segunda-empresa.ts`), que es la forma que detecta una consulta filtrando por la compañía equivocada: cada panel mostró exactamente sus propias cifras. **El recorrido encontró una fuga real que las pruebas no veían:** el panel general no filtraba por compañía en ninguna de sus 21 consultas, así que mostraba ventas, cobranza, comisiones e inventario ajenos. Corregido y cubierto por prueba. Véase `docs/verificacion-en-navegador.md`.
- **Qué**: agregar relación real `empresa Empresa @relation(fields: [empresaId], references: [id])` a los modelos transaccionales que hoy solo tienen `empresaId` como string suelto (`Pedido`, `Factura`, `OrdenCompra`, `MovimientoKardex`, `AsientoContable`, `Insumo`, `Producto`, etc. — lista completa en Blueprint 05), y filtrar por `obtenerEmpresaActivaId()` en cada `actions.ts` que hoy no lo hace (confirmado ausente en 7 de 8 módulos muestreados, Blueprint 08).
- **Dependencias**: ninguna técnica, pero es el prerrequisito lógico de 0.3, y de los ítems de jerarquía de planta/centro de costo de la Oleada 1.
- **Criterio de aceptación**: crear una segunda `Empresa`, cambiar la compañía activa, y confirmar que **ningún** dato (insumos, pedidos, facturas, asientos, kardex) de la compañía 1 es visible ni editable desde la compañía 2, y viceversa.
- **Prueba**: script de datos de prueba con 2 empresas, 2 juegos de clientes/insumos/pedidos, verificación cruzada de que cada consulta filtrada por empresa activa no devuelve filas de la otra.
- **Rollback**: mantener `empresaId` como campo (no se elimina, se le agrega la relación) — revertir la migración de Prisma es seguro porque no se borra la columna existente, solo se agrega la FK y el filtro de aplicación.
- **Prioridad**: **P0, el ítem más grande y más bloqueante de todo el roadmap.**
- **Nota de auditoría 2026-09-11:** el conteo subió a **79 de 79** al agregarse `UbicacionTecnica`, `PosicionOrganizativa` y `AsignacionPosicion` después del cierre. No es deriva: los tres nacieron con la relación porque el guardia estructural de la suite la exige. El "76 de 76" de arriba se deja tal cual, con su fecha.

### 0.2c — ~~Numeración de documentos por compañía~~ — completado
- **Detectado y resuelto 2026-09-11.** Apareció al chocar contra él verificando otra cosa en el navegador: crear un cliente fallaba con "Ya existe un cliente con el documento null". **Trece de los diecinueve generadores** de correlativo leían el máximo global sin filtrar por compañía, más los dos de número de asiento contable. Con dos sociedades eso rompía de dos maneras: el alta fallaba contra el índice único cuando el código más alto de la otra compañía no parseaba, y la serie de una continuaba desde el máximo de la otra.
- **La otra mitad:** filtrar los generadores no alcanzaba. **Quince documentos numerados** tenían el número con índice único **global** (), así que dos sociedades no podían tener cada una su PED-00001. Pasan a , el patrón que Cliente, Empleado y Proyecto ya usaban. En Factura y GuiaRemision además es lo correcto fiscalmente: son números SUNAT por emisor.
- ** gana :** era el único de los quince sin compañía propia —colgaba del equipo— y la migración lo rellena desde ahí.
- ** obligatorio sin default** en los diecinueve generadores: al quitarlo, TypeScript señaló los 25 puntos de llamada. Dos guardias estructurales fallan si un generador nuevo no filtra o si alguien le pone valor por defecto.
- **Verificado en navegador:** el alta que fallaba ahora da CLI-00006 en la compañía principal, y la segunda arranca su propia serie en CLI-00001; ambos conviven. Véase .

### 0.2b — ~~Configuración de la sociedad por compañía~~ — completado
- **Resuelto 2026-09-11:** `ConfiguracionEmpresa` pasa a una fila por compañía (`empresaId` único con clave foránea y `onDelete: Restrict`); el `id` deja de ser la constante `"1"` y la fila histórica conserva el suyo. El acceso único es `obtenerConfiguracionEmpresa(empresaId)`, con `empresaId` **obligatorio a propósito**: un valor por defecto dejaría que un llamador distraído leyera la compañía principal sin error visible, y al quitarlo TypeScript señaló los trece puntos a revisar. Una compañía nueva nace con los valores por defecto del esquema y **no hereda RUC ni credenciales SUNAT** de otra. Véase `docs/configuracion-por-compania.md`.
- **Efecto colateral que destapó la migración:** `reservarCorrelativo()` usaba la fila única de configuración como mutex (`INSERT ... ON CONFLICT(id)`), así que con una fila por compañía **toda** generación de correlativo empezó a fallar contra el índice único de `empresaId`. Lo detectó la suite. El arreglo no fue parchear el `ON CONFLICT` sino quitar el acoplamiento: el cerrojo vive ahora en `CerrojoCorrelativo`, tabla propia sin datos de negocio, global a propósito y igual de portable a PostgreSQL.
- **Verificado en navegador 2026-09-11** con las dos compañías pobladas y valores deliberadamente distintos (RUC, IGV 18 % vs 10 %, umbrales 5000 vs 1111): cada pantalla de configuración muestra lo suyo, el **membrete impreso** de la factura de la segunda compañía sale con su propio RUC —antes habría llevado el de la primera—, el correlativo se genera sin error, y guardar la configuración de una deja la de la otra intacta.
- **Detectado 2026-09-11** al contrastar los Blueprints 03 y 05 contra el código, después de cerrar 0.2.
- **Qué**: `ConfiguracionEmpresa` es el maestro que quedó fuera del aislamiento: `id String @id @default("1")`, sin `empresaId` ni relación hacia `Empresa`, leído con `where: { id: "1" }` clavado en **11 archivos** (`src/lib/empresa.ts`, `src/lib/facturacionElectronica.ts`, `src/lib/proyecciones.ts`, `src/lib/recargoMora.ts`, `comercial/pedidos/actions.ts`, `comercial/pedidos/nuevo/page.tsx`, `comercial/facturas/[id]/page.tsx`, `configuracion/empresa/actions.ts`, `logistica/rfq/actions.ts`, `logistica/acuerdos-suministro/actions.ts`). Esa fila gobierna razón social y RUC del emisor, moneda, tasa de IGV, credenciales SUNAT, umbral de aprobación de compras, alcance de aprobación jerárquica y recargo por mora.
- **Por qué importa**: una segunda sociedad legal real —el escenario que 0.2 habilitó— emitiría hoy sus facturas con el RUC y las credenciales SUNAT de la primera, y calcularía su IGV con la tasa de la otra.
- **Alcance honesto de la brecha**: **con una sola compañía operando, que es el caso actual, no hay ningún flujo roto**. Es el eslabón que falta para operar de verdad con dos, no una falla presente.
- **Dependencias**: 0.2 (completado). Ninguna otra.
- **Criterio de aceptación**: crear una segunda compañía con RUC y tasa de IGV propios, emitir un documento desde cada una y confirmar que cada uno sale con los datos de su compañía; confirmar además que editar la configuración de una no altera la de la otra.
- **Prueba**: escenario sobre base efímera con dos filas de configuración, más recorrido en navegador con ambas compañías pobladas.
- **Rollback**: migración aditiva — se agrega `empresaId` con `@default("1")` y se respalda la fila existente como la de la compañía principal; revertir deja la fila `"1"` intacta.
- **Prioridad**: **P0 para multi-sociedad; sin efecto operativo mientras haya una sola compañía.**

### 0.3 — ~~Planta como unidad organizativa real~~ — completado
- **Avance 2026-09-11:** `Almacen.tipo` (`PLANTA` / `ALMACEN_DISTRIBUCION` / `ALMACEN_TRANSITO`) existe y se administra desde Configuración → Almacenes. La migración trasladó la convención vigente —un almacén hacía de planta si tenía `CalendarioProduccion`— al campo explícito, así que ningún dato cambia de comportamiento al aplicarla. La capacidad de Proyecciones ya suma **solo plantas**. Véase `docs/planta-unidad-organizativa.md`.
- **MRP por planta completado 2026-09-12:** el MRP acepta una planta y netea contra el stock de **esa** planta (`SaldoAlmacen`) con solo sus pedidos firmes y su capacidad; la orden de compra generada hereda la planta como destino. Bajo el supuesto explícito **1 planta = 1 almacén de tipo `PLANTA`**, que es el modelo vigente. El pronóstico queda fuera al planificar por planta —`Proyeccion` no distingue plantas y repartirla exige un criterio de asignación del negocio—, y la pantalla lo declara. Véase `docs/mrp-por-planta.md`.
- **`plantaId` jerárquico: no aplica.** El negocio confirmó el 2026-09-12 que **1 planta = 1 almacén es suficiente**, así que el supuesto bajo el que ya operaban el MRP y la capacidad de Proyecciones deja de ser supuesto. No se modela la separación Werk→Lgort: obligaría a elegir planta **y** almacén en cada movimiento sin aportar control (Blueprint 10, respuestas registradas).
- **Lo que falta:** solo el reparto del pronóstico entre plantas, que sigue siendo criterio del negocio — `Proyeccion` no distingue plantas y repartirla exige un criterio de asignación.
- **Qué**: agregar `tipo`/`rol` a `Almacen` (o modelo `Planta` separado si el negocio confirma que una planta puede tener varios almacenes subordinados — ver Blueprint 10, pregunta abierta).
- **Dependencias**: 0.2 (una planta pertenece a una compañía real).
- **Criterio de aceptación**: el sistema puede listar "todas las plantas" distinto de "todos los almacenes de distribución," y el MRP/Proyecciones puede planificar por planta.
- **Prueba**: crear 2 plantas + 1 almacén de distribución, confirmar que los reportes de capacidad y el MRP distinguen correctamente.
- **Rollback**: campo nuevo, opcional — reversible sin pérdida de datos.
- **Prioridad**: P0.

### 0.4 — ~~Partición de stock por zona (bin real, no puntero único)~~ — completado
- **Resultado 2026-09-12:** `SaldoZona` guarda la cantidad por zona e ítem como capa aditiva sobre `SaldoAlmacen`; lo no repartido se deriva como "sin zona", de modo que la suma siempre cuadra con el saldo del almacén. El kardex no conoce zonas a propósito: repartir no genera movimiento ni altera el saldo. La zona principal pasa a ser derivada y los punteros `zonaAlmacenId` quedan como etiqueta de referencia. Véase `docs/particion-stock-por-zona.md`.
- **Verificación:** funciones puras y escenario sobre base efímera en la suite, más recorrido en navegador: un insumo de 1.904 unidades repartido en MP-01 (200) y A-01 (300) con 1.404 sin asignar, total del almacén sin cambios en ningún paso, y sobregiro rechazado.
- **Nota sobre la prioridad:** el ítem pedía validar el volumen de despacho con el negocio antes de comprometer el esfuerzo. Se construyó por indicación explícita de seguir el orden del roadmap; picking/oleadas (Oleada 2) sigue condicionado a ese dato.
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
| ~~Verificación de crédito bloqueante en `crearPedido`~~ | ninguna | **Completado:** un pedido a crédito que llevaría al cliente por encima de su límite nace con `estadoAprobacionCredito: PENDIENTE` y aparece de inmediato en la bandeja de aprobaciones, en vez de descubrirse recién al facturar con el stock ya reservado. El bloqueo duro sigue en `facturarPedido`, que reevalúa con la deuda del momento. De paso se corrigió que la bandeja de aprobaciones listaba las de todas las compañías. Véase `docs/credito-al-crear-pedido.md`. | **P1 completado** |
| ~~Aprobación del cambio de límite de crédito~~ (Blueprint 03 §7) | ninguna | **Completado el 2026-09-12:** un aumento que deje el límite del cliente por encima del umbral configurado queda en `SolicitudCambioCredito` y **el límite no cambia hasta aprobarse** — aplicar primero y aprobar después vaciaría el control. Solo los aumentos pasan por el flujo (bajar reduce la exposición), el umbral mira el límite resultante igual que el de compras, y nace en `NULL`: el control arranca apagado porque la política de crédito la fija el negocio, no el sistema. El caso que no se ve a simple vista: `limiteCredito = 0` significa *sin límite*, así que pasar de 5 000 a 0 es el mayor aumento de exposición posible y también pide aprobación. Véase `docs/aprobacion-limite-credito.md`. | **P1 completado** |
| Máquina de estados de cobranza (Blueprint 03 §7) | ninguna | **Seguimiento completado el 2026-09-12:** el aviso de cobranza registra qué contestó el cliente —compromiso de pago con fecha obligatoria, disputa con detalle, no contestó— con quién y cuándo. El incumplimiento del compromiso y la cobranza de la factura **se derivan** del saldo y del calendario en vez de guardarse, porque un estado guardado se queda viejo apenas cambia cualquiera de los dos; una prueba estructural falla si alguien les da columna. El incumplimiento se mide por día: quien se comprometió para hoy tiene todo el día. ~~**Falta el escalamiento automático**, que es política de cobranza (días de gracia, intentos antes de escalar, trato del cliente en disputa) y no se inventa.~~ **Escalamiento completado el 2026-09-13:** `PoliticaCobranza` **parametriza** esa política por compañía en vez de inventarla —umbral de cada nivel, días sin respuesta, gracia tras un compromiso incumplido, trato de la disputa— y la fila existe solo si el negocio la definió: sin ella, la pantalla funciona como antes. Las dos reglas nuevas nacen apagadas. El motor dice **qué corresponde hoy y por qué**; no emite el aviso ni bloquea al cliente, porque en este ERP registrar un aviso deja constancia de un contacto humano y crearlo por temporizador fabricaría un contacto que no ocurrió. Pasado el aviso final no inventa un nivel 4: lo marca como agotado, con contador propio. Destapó que la acción que registra el aviso reimplementaba los umbrales en línea, copia que con umbrales configurables habría grabado un nivel distinto del que la pantalla pedía. Véase `docs/escalamiento-cobranza.md` y `docs/seguimiento-cobranza.md`. | **P1 completado** |
| ~~RFQ / comparación de proveedores antes de la OC~~ | ninguna | **Completado** (verificado contra el código 2026-09-11, ya estaba construido y es más estricto que el criterio): adjudicar exige **2+ ofertas** registradas, una justificación escrita, y que quien solicitó el RFQ no sea quien adjudica; `OrdenCompra.rfqId` enlaza la orden con su RFQ. Cubierto por prueba de regresión. | **P1 completado** |
| ~~Esquema de liberación de compras multi-nivel~~ | 0.2, 0.3 | **Completado:** `NivelAprobacionCompra.almacenId` permite acotar un nivel a una planta. Una orden recorre la **unión** de los niveles generales de la compañía más los de su planta de destino — configurar una planta solo puede agregar controles, nunca quitarlos. Organización de compras no se modela: el negocio confirmó el 2026-09-12 que **las compras son centralizadas** y esa unidad no existe (Blueprint 10, respuestas registradas). Con los niveles por monto y por planta el ítem queda cubierto por completo. Véase `docs/liberacion-compras-por-planta.md`. | **P1 completado** |
| ~~Certificado de análisis QM (valores medidos por parámetro)~~ | ninguna | **Completado** (verificado contra el código 2026-09-11, ya estaba construido): `ResultadoCaracteristicaCalidad` guarda valor medido, límites, método de ensayo y conformidad por parámetro, y `/produccion/calidad/certificados/[loteId]` emite el certificado imprimible. La revisión encontró y corrigió que cuatro pantallas de calidad filtraban por la compañía de origen del usuario en lugar de la activa. Véase `docs/certificado-analisis-calidad.md`. | **P1 completado** |
| ~~Jerarquía de ubicación técnica de mantenimiento~~ | 0.3 | **Completado:** `UbicacionTecnica` con jerarquía autorreferenciada de niveles arbitrarios, raíces ancladas a una planta, ciclos bloqueados y `Equipo.ubicacionTecnicaId`. El historial de mantenimiento sigue colgando del equipo, así que puede moverse de sitio sin perderlo. Véase `docs/ubicacion-tecnica-mantenimiento.md`. | **P1 completado** |
| Estructura organizativa jerárquica RR.HH. (`jefeDirectoId`/posición) | ninguna | **Posiciones versionadas completadas 2026-09-11:** `PosicionOrganizativa` con jerarquía propia de posiciones y `AsignacionPosicion` como período de ocupación, lo que permite responder quién ocupaba una posición en una fecha pasada y qué posiciones están vacantes. De la aprobación jefe→reporte se cerró la mitad no ambigua: las vacaciones ya no pueden ser resueltas por quien las pide (`puedeResolverSolicitud`, la misma regla que ya usaban pedidos, pagos y órdenes de compra). **Aprobación jerárquica completada 2026-09-12:** configurable en Configuración → Empresa con tres alcances (sin jerarquía, solo jefe directo, cualquier superior de la cadena), por defecto **cualquier superior**. Las dos opciones jerárquicas traen respaldo de RR. HH.: si nadie de la cadena del solicitante tiene cuenta activa, cualquiera con el permiso resuelve — así un organigrama incompleto no deja solicitudes sin salida, y la regla se endurece sola al completarlo. Se aplica hoy a las solicitudes de vacaciones. Véase `docs/aprobacion-por-cadena-de-mando.md`. Véase `docs/posiciones-organizativas.md`. | **P1, resto condicionado a decisión** |
| ~~Motor de conflictos de SoD (GRC)~~ | ninguna | **Completado:** asignar crear/editar junto con aprobar en Materiales, Finanzas, Ventas o RR.HH. se bloquea atómicamente, con código explicativo, reversión de UI y pruebas en la suite normal | **P1 completado** |
| ~~Bloqueo de cuenta / rate limiting en login~~ | migración para persistir intentos/ventana/bloqueo | **Completado** (verificado contra el código 2026-09-11): el bloqueo es persistente en `Usuario.intentosFallidos`/`ultimoIntentoFallidoEn`/`bloqueadoHasta`, no en memoria volátil — 5 intentos fallidos dentro de una ventana de 15 minutos bloquean 15 minutos, con la ventana y el bloqueo cubiertos por la suite. Se suma a lo ya hecho en PR #70 (costo `scrypt` uniforme y sin enumeración temporal). | **P1 completado** |
| ~~Cookie de sesión con flag `secure` en producción~~ | ninguna | **Completado** (verificado contra el código 2026-09-12): `src/lib/auth.ts` y `src/lib/empresas.ts` marcan `secure` cuando `NODE_ENV=production` (PR #65) | **P1 completado** |
| ~~Change log genérico para catálogos editables~~ | ninguna | **Completado:** `AuditoriaMaestro` ya existía con valor anterior/nuevo/usuario/fecha y consulta en `/configuracion/auditoria`; la revisión de 2026-09-11 cerró los siete maestros sensibles que se sobrescribían sin rastro (configuración de empresa, niveles de aprobación de compras, calendario fiscal, descuentos por canal, series de documento, plan de cuentas y centros de costo). Una prueba de la suite exige la auditoría en los 24 módulos de la lista. Véase `docs/auditoria-cambios-sensibles.md`. | **P1 completado** |
| Framework de pruebas automatizadas + pipeline CI | ninguna | **Base completada y en expansión permanente**: al 2026-09-14 la suite corre **372 pruebas en 33 archivos** sobre SQLite efímero — kardex, contabilidad, producción, calidad, envasado, recall, planilla, MRP por planta, partición por zona, UBL, autenticación, aislamiento multiempresa, jerarquías y respaldo. Incluye guardias estructurales que fallan si se reintroduce un defecto de clase conocida (pantallas sin compañía activa, constantes importadas desde módulos cliente, maestros sin auditoría, correlativos sin cerrojo, configuración leída por la fila global, fallos de posteo sin rastro, correlativos que no filtran por compañía, claves de control contable usadas en asientos pero sin sembrar). CI ejecuta Prisma, lint, TypeScript, pruebas y build en cada PR. **Lección del 2026-09-13:** la última de esas guardias encontró seis claves de planilla sin sembrar —los asientos de planilla se descartaban en silencio en toda instalación nueva— y la suite no lo veía porque la prueba de planilla **fabrica sus propias cuentas y controles**, construyendo justo lo que producción no tenía. Una prueba que se trae su propia configuración no puede detectar que la configuración falta. Véase `docs/cuentas-control-planilla.md`. | **P1 transversal, en expansión** |
| ~~Estrategia de backup/DR documentada e implementada~~ | ninguna | **Completado:** respaldo con `VACUUM INTO`, verificado con `PRAGMA integrity_check` antes de darse por válido, con manifiesto SHA256 y retención; tarea programada `RESPALDO_BASE` que exige `RESPALDO_DIR` para activarse; scripts `npm run respaldo` y `npm run restaurar`. El procedimiento de restauración está ejercido de punta a punta en la suite sobre bases efímeras. Véase `docs/backup-restauracion.md`. | **P1 completado** |
| ~~Alerta de transacción sin asiento contable~~ | ninguna | **Completado 2026-09-11:** `postearAsiento()` era best-effort a propósito —la operación comercial no se revierte si falta un control contable, el período está cerrado o el presupuesto se excede— pero el `{ ok: false }` se descartaba en casi todos los 83 llamadores y la transacción quedaba sin asiento **en silencio**. Ahora cada fallo deja una `IncidenciaContable`, registrada por la **propia función y no por el llamador**: pedirle a 83 puntos de llamada que atiendan un valor de retorno es cómo se perdió el aviso la primera vez. Se escribe dentro de la transacción de la operación, así que un rollback se la lleva. Visible en `/finanzas/incidencias-contables` y en el semáforo del panel general, que pasa a **crítico**. Guardia estructural que falla si alguien agrega una salida `ok: false` que no deje rastro, verificada revirtiendo a mano uno de los cinco caminos. Véase `docs/incidencias-contables.md`. | **P1 completado** |
| Consentimiento/retención de datos personales (Ley 29733) | ninguna | Definir con legal qué controles mínimos aplican; implementar lo que se confirme necesario | P1 |

---

## Oleada 2 — Impacto medio, condicionado a volumen/modelo de negocio confirmado

| Ítem | Condición para activarlo |
|---|---|
| ~~Picking/oleadas~~ / HU de almacén | ~~Confirmar que 0.4 (partición por zona) ya está en producción y que el volumen de despacho lo justifica.~~ **Picking por oleadas construido el 2026-09-13**, a pedido: `OleadaPicking` agrupa varias guías planificadas del mismo almacén en una recorrida, con la lista **consolidada por presentación** y las zonas sugeridas por código. **Preparar no descuenta inventario** —eso lo hace la guía al salir, y descontar dos veces cobraría el stock dos veces—: lo que mueve es la capa de zonas, sacando el ítem de su zona hacia «sin zona», que es la playa de despacho. Así `suma(zonas) + sinZona = saldoAlmacén` sigue siendo cierto. De paso se cerró una asimetría de la biblioteca de zonas: «sin zona» valía como origen pero no como destino. Véase `docs/picking-por-oleadas.md`. ~~**Las unidades de manipulación (HU) siguen pendientes**~~ — **construidas el 2026-09-13**, a pedido: `UnidadManipulacion` es una **tercera capa aditiva** con la misma forma que las dos anteriores (`saldoZona = suma(contenido de las HU) + suelto`), así que lo que hay sobre un pallet ya está contado en el saldo de su zona. Armar y desarmar no mueven ningún saldo; mover de zona y preparar mueven solo la capa de zonas; **el kardex no se toca nunca**. Preparar un pallet entero exige que todo su contenido quepa en lo pendiente de la oleada. No lleva lote, porque la trazabilidad ya existe por `Envasado`/`AsignacionLoteVenta` y duplicarla daría dos respuestas a qué lote salió. Véase `docs/unidades-manipulacion.md`. Con esto el ítem queda cerrado por completo. |
| ~~Nota de débito, Boleta electrónica~~ | **Condición cumplida y ambas construidas.** El negocio confirmó el 2026-09-12 que el canal minorista existe, y la **boleta** salió el mismo día: la regla sale del documento del comprador, no del canal — una persona con DNI recibe boleta, una empresa con RUC recibe factura, compre lo que compre (`docs/boleta-de-venta.md`). La **nota de débito** se construyó el 2026-09-11 **acotada al recargo por mora**, que es el único de los tres tipos del Catálogo 10 que el sistema calcula por su cuenta; emitir por aumento de valor o penalidad exige decidir cuándo corresponde y sobre qué base (`docs/nota-debito-mora.md`). **El negocio lo confirmó el 2026-09-13 y el Catálogo 10 quedó completo**: los tipos 02 y 03 se emiten a mano —el sistema aporta el mecanismo, la persona el concepto y el importe— y, a diferencia de la de mora, sí aumentan el saldo y sí postean, porque ahí el documento es el hecho económico. La afectación al IGV se declara sin opción premarcada (`docs/nota-debito-manual.md`). Falta, para las dos, el **certificado digital real** — bloqueo externo, no de desarrollo. |
| ~~Centro de beneficio con P&L propio~~ | **No aplica** (negocio, 2026-09-13): el estado de resultados es **uno solo** para la empresa; ninguna planta ni línea reporta utilidad independiente. Los centros de costo actuales bastan para controlar gasto. Modelar imputación de ingresos y reparto de gasto compartido que nadie va a leer solo agregaría un campo obligatorio en cada asiento. Se reabre si alguna unidad pasa a responder por su margen. |
| Multi-moneda con libro paralelo real | Confirmar si habrá operación en el extranjero con moneda funcional distinta |
| Migración a PostgreSQL | **El prerequisito ya está cumplido** (verificado 2026-09-12): la numeración correlativa tiene índice único en base en los 12 documentos numerados, los **19** generadores de `correlativos.ts` toman un cerrojo explícito (`INSERT ... ON CONFLICT DO UPDATE` sobre una fila fija, portable a PostgreSQL) antes de leer el último número —con prueba de regresión que lo exige—, y el bloqueo optimista por reclamo se usa en ~148 puntos. Ya no es "no migrar hasta construir los controles": queda condicionada solo al volumen y usuarios concurrentes. **Deuda nueva a resolver antes de migrar:** el módulo de respaldo usa `VACUUM INTO` y `PRAGMA integrity_check`, específicos de SQLite (`docs/backup-restauracion.md`). |
| Separar reportes/BI de la base transaccional (réplica de solo lectura o data mart) | Medir primero si las consultas de reporte ya degradan el sistema operativo a alto volumen |
| Maestro de transportistas / licitación de flete | Confirmar si la distribución seguirá siendo 100% flota propia. **Matiz verificado 2026-09-12:** el transporte por tercero ya se puede documentar — `GuiaRemision` lleva modalidad, transportista, su RUC, placa y DNI del conductor. Lo que no existe es el **maestro** de transportistas ni la licitación de flete; hoy cada guía captura los datos sueltos. **Condición cumplida el 2026-09-13**: el negocio confirmó que tiene flota propia **y además** terceriza y contrata para despacho. **Maestro construido el mismo día**: `Transportista` por compañía con sus vehículos y conductores, elegidos en la guía en vez de retipearse. La flota propia **no** entra al maestro —es `Equipo`, con su historial de mantenimiento— y la guía conserva las dos vías. La razón social y el RUC se releen de la ficha dentro de la acción, nunca del formulario: ese texto se declara ante SUNAT. Los campos de texto de la guía se conservan como respaldo, y el relleno deduce transportistas y placas de las guías ya emitidas pero **no conductores**, porque solo está el DNI y no el nombre. Véase `docs/maestro-transportistas.md`. ~~**La licitación de flete sigue pendiente** — contratar no es licitar, y nadie pidió comparar tarifas por tramo.~~ **Licitación construida el 2026-09-13**, a pedido: `LicitacionFlete` con sus ofertas, bajo las **mismas tres reglas del RFQ de compras** —dos ofertas mínimo, justificación escrita, quien solicita no adjudica— porque contratar flete es comprar un servicio. Las ofertas se comparan normalizadas a moneda funcional; adjudicar la más cara se permite pero la pantalla muestra el sobrecosto exacto junto a la justificación. **Adjudicar no emite la guía** —fabricaría un traslado que no ocurrió— y la guía, cuando se emite, toma el transportista de la oferta adjudicada y no del formulario. El monto no se copia a la guía: se lee de la oferta. Véase `docs/licitacion-flete.md`. Con esto el ítem queda cerrado por completo. |
| ~~Certificación periódica de accesos (GRC)~~ | ~~Cuando el número de usuarios/grupos crezca lo suficiente para que la revisión manual de 90 días sea insuficiente.~~ **Construida el 2026-09-14**, a pedido. Lo que había era una **alerta** de inactividad a 90 días; certificar es que alguien declare por escrito que cada acceso sigue siendo correcto, con constancia de quién lo dijo. La campaña **congela** lo revisado —certificar contra datos vivos no certifica nada— e incluye rol, grupo, permisos resumidos y conflictos de segregación. **Nadie certifica su propio acceso**, y **revocar aplica**: desactiva la cuenta y queda auditado, porque una casilla que no hace nada es teatro. No se cierra con accesos sin revisar. **No se fijó cadencia**: cada cuánto certificar es política de la empresa, así que se construyó el mecanismo sin afirmar que el umbral de escala se haya alcanzado. Véase `docs/certificacion-accesos.md`. |

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

## Actualización: calidad multiempresa

El control de calidad, las causas y los reclamos de cliente operan dentro de la empresa activa. Las acciones validan nuevamente las relaciones recibidas desde formularios para impedir referencias cruzadas entre compañías.

## Actualización: fórmulas y lotes multiempresa

Las recetas, órdenes de producción, operaciones, ajustes de materiales y recall se aíslan por empresa activa. Véase `docs/aislamiento-multiempresa-formulas-lotes.md`.

## Actualización: envasado y capacidad multiempresa

El envasado, sus consumos y la nivelación de capacidad se limitan a lotes y centros de la empresa activa. Véase `docs/aislamiento-multiempresa-envasado-capacidad.md`.

## Actualización: centros de trabajo y equipos multiempresa

Los centros operativos, equipos, contadores y planes preventivos validan la empresa activa y sus dimensiones relacionadas. Véase `docs/aislamiento-multiempresa-centros-equipos.md`.

## Actualización: mantenimiento y variaciones multiempresa

Las órdenes, avisos, confiabilidad, repuestos, costos y variaciones de producción se aíslan por empresa activa. Véase `docs/aislamiento-multiempresa-mantenimiento-variaciones.md`.

## Actualización: Proyecciones/S&OP multiempresa

Los escenarios trimestrales y sus cálculos de demanda, operaciones, capacidad y finanzas consumen únicamente información de la empresa activa. Véase `docs/aislamiento-multiempresa-proyecciones.md`.

## Actualización: proyectos de inversión multiempresa

Los proyectos, su WBS, red de actividades, costos y dimensiones relacionadas se aíslan por empresa activa, con numeración independiente por compañía. Véase `docs/aislamiento-multiempresa-proyectos.md`.

## Actualización: controles de inventario multiempresa

Los ajustes, traslados, ubicaciones, conteos, kardex y análisis de exactitud/rotación se aíslan por empresa activa. Véase `docs/aislamiento-multiempresa-controles-inventario.md`.
