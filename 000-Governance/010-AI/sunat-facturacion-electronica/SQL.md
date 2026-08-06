# SQL — Modelo de datos — sunat-facturacion-electronica

## Migración `20260805231615_sunat_gaps_ubigeo`

- **`Presentacion.unidadMedidaSunat`** (`String @default("NIU")`) — código Catálogo 3 SUNAT.
- **`CuentaBancariaEmpresa`** (nuevo modelo): `banco`, `moneda`, `numeroCuenta`, `cci?`, `activo`. Sin relación Prisma a `ConfiguracionEmpresa` (sigue el mismo patrón `empresaId: String @default("1")` que el resto del esquema, no hay FK real).
- **`TipoNotaCredito`** (nuevo enum, Catálogo 9 SUNAT): `ANULACION_OPERACION`, `ANULACION_ERROR_RUC`, `CORRECCION_DESCRIPCION`, `DESCUENTO_GLOBAL`, `DESCUENTO_ITEM`, `DEVOLUCION_TOTAL`, `DEVOLUCION_ITEM`, `BONIFICACION`, `DISMINUCION_VALOR`, `OTROS_CONCEPTOS`.
- **`NotaCredito.tipoNota`** (nuevo campo, default `OTROS_CONCEPTOS`).
- **`NotaCreditoDetalle`** (nuevo modelo): `notaCreditoId`, `pedidoDetalleId`, `cantidad`, `precioUnitario`, `subtotal`.
- **`ModalidadTransporte`** (nuevo enum, Catálogo 20 SUNAT): `PUBLICO`, `PRIVADO`.
- **`GuiaRemision`**: nuevos campos `pesoBrutoTotal` (`Decimal @default(0)`), `modalidadTransporte` (default `PRIVADO`), `transportistaRuc?`, `ubigeoPartidaId?`, `ubigeoLlegadaId?`.
- **`Ubigeo`** (nuevo modelo): `codigo` (único, 6 dígitos), `departamento`, `provincia`, `distrito`. Relacionado desde `GuiaRemision` con dos relaciones nombradas (`UbigeoPartida`/`UbigeoLlegada`).
- **`ConfiguracionEmpresa`**: nuevos campos `sunatCertificadoBase64?`, `sunatCertificadoPassword?`, `sunatUsuarioSol?`, `sunatClaveSol?` (para el adaptador directo a SUNAT).

## Por qué `NotaCreditoDetalle.pedidoDetalleId` en vez de un `presentacionId` suelto
Referenciar el `PedidoDetalle` original (no solo la presentación) permite calcular exactamente cuánto de esa línea específica ya se acreditó (sumando `NotaCreditoDetalle.cantidad` de todas las notas de crédito previas) y bloquear si se intenta acreditar de más — sin esto, dos notas de crédito parciales sobre la misma factura podrían acreditar más unidades de las vendidas sin que el sistema lo note.

## Fuente del catálogo de ubigeos
`prisma/data/ubigeos.json` (1,834 filas, deduplicadas por código SUNAT) — derivado de la tabla de concordancia INEI/RENIEC/SUNAT que publica CONCYTEC (Consejo Nacional de Ciencia, Tecnología e Innovación Tecnológica del Perú), a su vez tomada del Excel oficial que SUNAT publica en su propio sitio. Verificado contra los 2 códigos que aparecen en los documentos reales del usuario (150102 = Lima/Lima/Ancón, 100101 = Huánuco/Huánuco/Huánuco) — coinciden exacto. Una fila corrupta en la fuente original (código `"    NA"`) se descartó antes de sembrar.
