# API — Server actions y librerías — sunat-facturacion-electronica

## `src/lib/catalogosSunat.ts` (nuevo)
- `CODIGO_TIPO_NOTA_CREDITO` / `ETIQUETA_TIPO_NOTA_CREDITO`: mapeo `TipoNotaCredito` ↔ código Catálogo 9 SUNAT.
- `CODIGO_MODALIDAD_TRANSPORTE` / `ETIQUETA_MODALIDAD_TRANSPORTE`: mapeo `ModalidadTransporte` ↔ código Catálogo 20 SUNAT.

## `src/lib/numeroALetras.ts` (nuevo)
- `numeroALetras(monto, moneda)`: convierte un monto a texto ("SON: ... SOLES"). Función pura, sin dependencias. Verificado contra los 2 montos reales de los documentos de ejemplo (1,440.00 y 10,500.00) — coincide exacto.

## `src/app/(app)/comercial/facturas/actions.ts` (extendido)
- `enviarComprobanteFactura`: ahora usa `presentacion.unidadMedidaSunat` real por ítem.
- `crearNotaCredito`: firma cambiada — recibe `tipoNota` + `lineas` (JSON `{pedidoDetalleId, cantidad}[]`) en vez de `monto` suelto. Calcula `montoBase`/`montoIgv`/`monto` desde las líneas, valida contra lo ya acreditado por notas previas.
- `enviarComprobanteNotaCredito`: arma los ítems desde `NotaCreditoDetalle` (producto/cantidad/precio reales), no desde el motivo en texto.

## `src/app/(app)/logistica/guias-remision/actions.ts` (extendido)
- `enviarComprobanteGuia` (nueva): arma y envía el comprobante de la guía — antes no existía ninguna función que lo hiciera.
- `crearGuiaRemision`: acepta y valida `pesoBrutoTotal`, `modalidadTransporte`, `transportistaRuc`, `ubigeoPartidaId`, `ubigeoLlegadaId`; llama a `enviarComprobanteGuia` al final.

## `src/app/(app)/configuracion/empresa/actions.ts` (extendido)
- `guardarConfiguracionEmpresa`: acepta `"SUNAT_DIRECTO"` como proveedor válido; procesa el archivo del certificado (`sunatCertificadoArchivo`, solo se reemplaza si se sube uno nuevo) y las credenciales SOL.
- `agregarCuentaBancaria` / `eliminarCuentaBancaria` (nuevas): CRUD simple sobre `CuentaBancariaEmpresa`.

## `src/lib/facturacionElectronica.ts` (extendido)
- `DatosComprobante`/`ItemComprobante` extendidos con `tipoNota`, `guia` (nuevo tipo `DatosGuia`).
- `armarBodyFacturaONotaCredito` / `armarBodyGuia`: el adaptador Nubefact ahora arma un payload completamente distinto para guías (transportista/peso/ubigeo/motivo, sin montos) en vez de forzarlo por el mismo camino que Factura/NC.
- `adaptadorSunatDirecto` (nuevo): encadena `sunatUbl.ts` → `sunatFirma.ts` → `sunatSoap.ts`. Sin modo simulado — falla explícito si falta certificado/credenciales.

## `src/lib/sunatUbl.ts` (nuevo)
- `construirFacturaUBL`, `construirNotaCreditoUBL`, `construirGuiaRemisionUBL`: arman el XML UBL 2.1 sin firmar, según `DatosComprobante` + `DatosEmisor`.

## `src/lib/sunatFirma.ts` (nuevo)
- `firmarXml(xml, certificadoBase64, password)`: extrae clave/certificado de un .pfx/.p12 (`node-forge`) y firma el documento completo (enveloped, canonicalización exclusiva C14N) insertando `<ds:Signature>` dentro de `<ext:UBLExtensions>` (`xml-crypto`).

## `src/lib/sunatSoap.ts` (nuevo)
- `nombreArchivo(ruc, tipoDocumento, serie, numero)`: nombre de archivo SUNAT (`RUC-tipo-serie-numero`).
- `enviarSunatDirecto(params)`: comprime el XML firmado (`jszip`), arma el sobre SOAP con WS-Security (usuario secundario SOL), lo envía al webservice correspondiente (`billService` o `guiaRemisionElectronicaService`), y parsea el CDR de respuesta.

## Prisma
- `prisma/seed-ubigeos.ts` (nuevo): siembra el catálogo de 1,834 ubigeos SUNAT desde `prisma/data/ubigeos.json` (una sola vez, no-op si ya hay datos).
