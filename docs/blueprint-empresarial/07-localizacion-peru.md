# 07 — Matriz de localización Perú

> **Actualización 2026-08-12:** la inconsistencia de IGV fijo en UBL fue corregida por PR #61 (merge 86dc20a). La RS 000125-2026/SUNAT postergó hasta octubre de 2026 el ingreso a SIRE del grupo específico de principales contribuyentes designados al 31/12/2024 con ingresos netos 2024 superiores a 2300 UIT; la obligación concreta debe determinarse por RUC. Ver Blueprint 11.

**Metodología**: verificación directa de `src/lib/facturacionElectronica.ts`, `sunatUbl.ts`, `sunatFirma.ts`, `sunatSoap.ts`, `ple.ts`, `planilla.ts`, `prisma/schema.prisma` y los `actions.ts` llamadores. Toda cita es verbatim de código al 2026-08-06. Donde una tasa, umbral legal o vigencia normativa está en juego, se marca explícitamente **"requiere validación profesional"** — este documento no certifica que esos valores sean correctos hoy, solo que la lógica/estructura existe.

---

## 1. CPE — Comprobante de Pago Electrónico

| Elemento | Evidencia | Estado |
|---|---|---|
| Factura electrónica (UBL 2.1, firma XMLDSig, envío SOAP) | `construirFacturaUBL` (`src/lib/sunatUbl.ts:180-209`), firma real con `node-forge` + `xml-crypto` (`sunatFirma.ts:14-81`), envío a `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService` (`sunatSoap.ts:18`, endpoint de **producción** real) | **Verificado completo como código**, **nunca ejecutado contra SUNAT real** (ver hallazgo crítico abajo) |
| Nota de crédito electrónica | `construirNotaCreditoUBL` (`sunatUbl.ts:211-250`), líneas reales de la factura (`NotaCreditoDetalle`) | **Verificado completo como código**, mismo caveat de no-probado |
| Guía de remisión electrónica | Ver sección 2 | Ver sección 2 |
| **Boleta de venta electrónica** | `src/lib/facturacionElectronica.ts:130`: comentario explícito *"este sistema solo emite Factura, no Boleta"*. `enum TipoComprobanteElectronico` (`prisma/schema.prisma:1043-1047`) solo tiene `FACTURA`, `NOTA_CREDITO`, `GUIA_REMISION` | **Ausente** — material para cualquier venta al consumidor final (mostrador, minorista) |
| **Nota de débito electrónica** | Cero resultados de búsqueda de "nota_debito"/"NOTA_DEBITO" en `src/` | **Ausente** — sin forma de cobrar cargos adicionales post-facturación (ej. flete no facturado) mediante documento SUNAT válido |
| Firma digital — algoritmo | `sunatFirma.ts`: `rsa-sha1` hardcodeado. Comentario propio del archivo advierte que SUNAT podría exigir hoy RSA-SHA256 en vez de SHA1 | **Requiere validación profesional** — riesgo concreto de rechazo por algoritmo de firma obsoleto |
| Envío real probado contra SUNAT | Búsqueda de "homologacion", "ambiente beta", RUC de pruebas (20000000001), "MODDATOS": **cero resultados** en todo el repo | **Ausente / no probado** |
| Modo por defecto en producción | `ConfiguracionEmpresa.oseProveedor` por defecto `"SIMULADO"` (`prisma/schema.prisma:68`) — **no envía nada real** hasta que se configure explícitamente un proveedor | **Por diseño, seguro** (evita CDR falsos accidentales), pero significa que **hoy el sistema no emite ni un solo comprobante válido ante SUNAT** en su configuración de fábrica |
| Adaptador OSE alternativo (Nubefact) | `facturacionElectronica.ts:206-265`, también **nunca probado contra el servicio real** (comentario propio del archivo, líneas 16-22) | **Parcial — código completo, sin validar** |

**Hallazgo crítico**: tanto el adaptador directo a SUNAT como el adaptador Nubefact están **completos como código** (UBL bien formado, firma XMLDSig criptográficamente válida contra un certificado de prueba — verificado en sesión anterior de este mismo proyecto) pero **ninguno de los dos se ha ejecutado jamás contra un endpoint real de SUNAT o de un OSE contratado**. Antes de operar como fabricante grande con alto volumen de facturación, esto debe validarse end-to-end con: certificado digital real de la empresa, usuario SOL secundario con facturación electrónica habilitada, y pruebas contra el ambiente de homologación de SUNAT (o una cuenta Nubefact contratada).

---

## 2. GRE — Guía de Remisión Electrónica

| Elemento | Evidencia | Estado |
|---|---|---|
| Servicio SUNAT correcto y separado de Factura | `sunatSoap.ts:19,106` — endpoint `e-guiaremision.sunat.gob.pe/.../guia-gem/billService`, distinto del `billService` de Factura/NC | **Verificado completo** |
| Estructura UBL (DespatchAdvice) | `construirGuiaRemisionUBL` (`sunatUbl.ts:261-369`) — bloques `Shipment`/`ShipmentStage`/`Delivery` con ubigeo, peso, modalidad, datos de conductor/vehículo | **Verificado completo como código** |
| Caller real desde el módulo de logística | `logistica/guias-remision/actions.ts:21-60`, `enviarComprobanteGuia` | **Verificado completo** |
| Probado contra SUNAT | Mismo caveat que Factura — no probado | **Ausente / no probado** |

---

## 3. SIRE vs. PLE (libros electrónicos)

| Elemento | Evidencia | Estado |
|---|---|---|
| PLE (formato legado, archivo plano) | `src/lib/ple.ts` completo — Registro de Ventas 14.1 y Compras 8.1, formato pipe-delimited (`SEPARADOR = "|"`, línea 16), CRLF, según RS 361-2015/SUNAT. UI en `/finanzas/libros-electronicos` con botones "Descargar .txt" | **Verificado completo**, para el formato PLE específicamente |
| SIRE (sistema que SUNAT viene exigiendo como reemplazo de PLE desde 2024-2025 para la mayoría de contribuyentes, vía API RVIE/RCE) | Búsqueda exhaustiva de "SIRE" en todo el repo: **cero resultados** | **Ausente** |

**Hallazgo crítico de vigencia normativa**: si la empresa objetivo (fabricante grande) está — o pasa a estar — obligada a SIRE en vez de PLE, **el módulo actual no cumple esa obligación**, solo genera el formato antiguo. **Requiere validación profesional inmediata**: confirmar el régimen SIRE/PLE vigente para esta empresa específica antes de asumir que `/finanzas/libros-electronicos` basta para el cierre legal mensual.

---

## 4. Impuestos

| Impuesto | Evidencia | Estado |
|---|---|---|
| IGV (18%) | `ConfiguracionEmpresa.tasaIgv @default(18)` (`prisma/schema.prisma:42`), aplicado consistentemente en pedidos, facturas, activos fijos, PLE | **Verificado completo**, con una inconsistencia interna detectada: el armador UBL (`sunatUbl.ts:142,150,160`) **hardcodea 18% a nivel de línea**, mientras que los totales del comprobante usan la tasa configurable — si algún día `tasaIgv` cambia de 18%, el XML de línea quedaría desalineado con el total. **Corrección recomendada de bajo esfuerzo.** |
| Impuesto a la Renta de 3ra categoría (corporativo) | Cero lógica de cálculo de renta anual/pagos a cuenta en todo `src/` | **Ausente** — esperable en un ERP (normalmente vive en el software contable/tributario del contador), pero se documenta como ausente para que quede explícito en el alcance |
| ISC (Impuesto Selectivo al Consumo) | Únicas 2 menciones en el repo: columnas PLE reservadas y vacías (`ple.ts:98,156`, comentario `// 20 ISC` / `// 21 ISC deducible`) | **Ausente.** Requiere validación profesional: confirmar si la línea de producto específica de XXOil (grasas/lubricantes derivados, no combustibles) está efectivamente afecta a ISC antes de tratar esto como un gap real vs. no aplicable |
| Detracciones / retenciones / percepciones (regímenes de pago SUNAT) | Solo columnas PLE reservadas y vacías (`ple.ts:166-167`); sin lógica de cuenta de detracción, SPOT, ni agente de retención/percepción | **Ausente** |

---

## 5. Planilla / nómina — motor real, con simplificaciones explícitas

Evidencia: `src/lib/planilla.ts` (515 líneas), leído íntegro.

| Componente | Evidencia | Estado |
|---|---|---|
| EsSalud (aporte patronal) | `planilla.ts:147-148`, tasa desde `ParametroPlanilla.tasaEsSalud` (default 9%, versionado por `vigenteDesde`) | **Verificado completo** (estructura correcta; tasa vigente **requiere validación profesional**) |
| ONP | `planilla.ts:121-124`, tasa plana desde `ParametroPlanilla.tasaOnp` (default 13%) | **Verificado completo** (misma salvedad de vigencia) |
| AFP (Integra/Prima/Habitat/Profuturo, comisión FLUJO o MIXTA) | `enum Afp`, `enum TipoComisionAfp`, `model TasaAfp` con `tasaAporteObligatorio + tasaComision + primaSeguro` (`planilla.ts:139-144`) | **Verificado completo**, estructura correcta por AFP y tipo de comisión — **valores de comisión vigentes requieren validación profesional** |
| Retención de renta de 5ta categoría | `calcularImpuestoAnual` (`planilla.ts:35-52`): tramos por UIT hardcodeados (8%/14%/17%/20%/30%), UIT en sí paramétrico. **Método mensual explícitamente simplificado** — comentario propio del código (`planilla.ts:54-58`): "El método real de SUNAT reproyecta cada mes con lo efectivamente ganado a la fecha — se documenta como simplificación explícita, no como equivalencia exacta." | **Parcial, con auto-documentación honesta de la simplificación** — **requiere validación profesional** antes de usarlo para pagar sueldos reales (el propio código lo dice: `planilla.ts:6-12`) |
| Gratificación jul/dic + bonificación extraordinaria | `generarGratificacion` (`planilla.ts:284-359`) — el bono usa la tasa EsSalud vigente (correcto legalmente, Ley 30334), no un 9% fijo | **Verificado completo**, con un límite conocido no implementado: tope de exoneración de 2 UIT (comentario propio, `planilla.ts:235-246`) |
| CTS may/nov | `generarCts` (`planilla.ts:361-432`), incluye 1/6 de la última gratificación en la base computable | **Verificado completo** |
| Asignación familiar | 10% de la RMV vigente (`planilla.ts:116`) | **Verificado completo** |
| Liquidación por cese | `generarLiquidacion` (`planilla.ts:435-514`) — CTS truncada, gratificación truncada, vacaciones pendientes | **Verificado completo** |
| **SCTR (Seguro Complementario de Trabajo de Riesgo)** | Cero resultados de búsqueda de "SCTR" en todo el repo | **Ausente** — relevante porque una planta de fabricación de lubricantes es actividad de riesgo bajo D.S. 003-98-SA |

**Nota transversal**: `planilla.ts:6-12` remite explícitamente a `docs/gobernanza/04-hcm-nomina-investigacion-normativa.md` y declara: *"Antes de usar esto para pagar sueldos reales, un especialista en planillas debe validar los montos contra su propia herramienta."* Este documento adopta la misma postura: la **estructura** de cálculo está verificada como coherente con el marco legal general; los **valores vigentes** (RMV, UIT, tasas AFP, tramos de renta) no fueron auditados aquí contra tablas SUNAT/SBS actuales — **requiere validación profesional** antes de producción.

---

## 6. SST — Seguridad y Salud en el Trabajo (Ley 29783)

| Elemento | Evidencia | Estado |
|---|---|---|
| Catálogo de sustancia peligrosa (GHS) a nivel insumo | `Insumo.esPeligroso`, `Insumo.claseGhs` (`prisma/schema.prisma:340-341`), con ícono de advertencia en la UI | **Verificado completo**, como catálogo — no como sistema de gestión SST |
| IPERC (identificación de peligros y evaluación de riesgos) | Cero implementación | **Ausente** |
| Registro de accidentes/incidentes laborales | Cero implementación | **Ausente** |
| Exámenes médico-ocupacionales | Cero implementación | **Ausente** |
| SCTR | Cero implementación (ver también sección 5) | **Ausente** |
| Comité de SST (obligatorio desde 20 trabajadores, Ley 29783) | Umbral documentado en `docs/gobernanza/05-disparadores-fase3-diferida.md` §12 como disparador de esta fase, nunca activado en código | **Ausente — obligación legal activa a la escala de un fabricante grande** (muy por encima del umbral de 20 trabajadores). Ver Blueprint 04 (EHS, prioridad P0). |

**Este es el hallazgo de cumplimiento más serio de todo el informe**: para una fábrica de lubricantes de tamaño grande, el sistema de gestión de SST no es un "nice to have" fase-futura — es una **obligación legal activa**. El propio disparador que la documentación de gobernanza había definido para retomar este tema ("más de 20 trabajadores") ya se cumple holgadamente a la escala objetivo de este encargo.

---

## 7. Protección de datos personales (Ley 29733 y su reglamento)

| Elemento | Evidencia | Estado |
|---|---|---|
| Captura de consentimiento | Cero implementación | **Ausente** |
| Registro ante la Autoridad Nacional de Protección de Datos Personales (ANPD) | Cero mención | **Ausente** |
| Política de retención / derecho de cancelación-supresión | Cero implementación | **Ausente** |
| Datos personales efectivamente almacenados (RUC/contacto de clientes, DNI/datos bancarios de empleados) | `Cliente`, `Empleado`, `Proveedor`, `Usuario` — confirmado que sí se almacenan datos personales reales (DNI, cuentas bancarias, contacto) | Confirma que **sí existe una base de datos personales sujeta a la ley**, sin ningún control de cumplimiento asociado |

**Requiere validación profesional**: si la base de datos personales de clientes/empleados/proveedores debe registrarse ante la ANPD, y qué controles mínimos de consentimiento/retención aplican — esto es mayormente un tema de proceso/legal, no solo de código, pero el código hoy no ofrece ningún mecanismo de soporte (ej. exportar/eliminar datos de una persona a pedido).

---

## 8. OSINERGMIN

| Elemento | Evidencia | Estado |
|---|---|---|
| Registro de Hidrocarburos (categoría OPDH) | `ConfiguracionEmpresa.registroHidrocarburosOsinergmin String?`, `registroHidrocarburosVigencia DateTime?` (`prisma/schema.prisma:43-48`), comentario propio: *"Referencia informativa; no bloquea ninguna operación."* Confirmado: ningún código fuera del formulario de configuración lee `registroHidrocarburosVigencia` para bloquear nada. | **Solo referencia informativa, no bloqueante** — exactamente como el propio esquema lo declara. No es un gap oculto: es una decisión de diseño explícita y documentada. |

---

## 9. Ubigeo (códigos geográficos SUNAT)

| Elemento | Evidencia | Estado |
|---|---|---|
| Catálogo completo | `prisma/data/ubigeos.json`, 1834 filas, fuente CONCYTEC (columna SUNAT, que diverge de INEI/RENIEC en 53 distritos — documentado en `prisma/seed-ubigeos.ts:5-10`) | **Verificado completo** como catálogo |
| Uso estructurado (FK real) | Solo `GuiaRemision.ubigeoPartidaId`/`ubigeoLlegadaId` (`prisma/schema.prisma:1392-1393,1421-1422`) usan el catálogo vía relación real | **Parcial** |
| `Cliente`, `Proveedor`, `Almacen` | `departamento`/`provincia`/`distrito` como texto libre, sin FK a `Ubigeo`. `Proveedor` ni siquiera tiene esos campos, solo `direccion` libre. | **Ausente** — direcciones de clientes/proveedores/almacenes no están validadas contra el catálogo oficial, con riesgo de inconsistencia de datos maestros a mayor volumen |

---

## Resumen de clasificación

| Área | Clasificación |
|---|---|
| 1. CPE (Factura/NC) | Parcial — código completo, nunca probado contra SUNAT real; Boleta y Nota de Débito ausentes |
| 2. GRE | Parcial — mismo caveat de no-probado |
| 3. SIRE vs. PLE | **Ausente (SIRE)** — riesgo de vigencia normativa a validar con urgencia |
| 4. Impuestos | IGV verificado completo (con inconsistencia menor de línea UBL a corregir); Renta 3ra/ISC/detracciones ausentes |
| 5. Planilla | Parcial — motor real y auto-documentado, tasas requieren validación profesional, SCTR ausente |
| 6. SST | **Ausente — obligación legal activa a esta escala** |
| 7. Protección de datos | **Ausente** |
| 8. OSINERGMIN | Solo referencia informativa, no bloqueante (por diseño) |
| 9. Ubigeo | Parcial — catálogo completo, uso estructurado solo en Guía de Remisión |

## Lista de "requiere validación profesional" (no certificable por este informe)

1. Algoritmo de firma XMLDSig (RSA-SHA1 vs. SHA256 exigido hoy por SUNAT).
2. Vigencia y aplicabilidad de SIRE vs. PLE para el régimen tributario específico de esta empresa.
3. Aplicabilidad real de ISC a la línea de producto (grasas/lubricantes, no combustibles).
4. Tasas vigentes: RMV, UIT, comisiones AFP (por tipo flujo/mixta), EsSalud, ONP.
5. Tramos y método exacto de retención de renta de 5ta categoría (el sistema usa un método mensual simplificado, no la reproyección exacta de SUNAT).
6. Obligación de registro ante ANPD de la base de datos personales del sistema.
7. Aplicabilidad y alcance de SCTR para el personal de planta.
