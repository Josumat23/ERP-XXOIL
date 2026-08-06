# CU — Casos de uso — sunat-facturacion-electronica

## CU-SUNAT-001 — Emitir factura con unidad de medida real
- **Actor:** VENTAS
- **Flujo:** factura un pedido normalmente; cada presentación ya tiene configurada su unidad SUNAT (`Presentacion.unidadMedidaSunat`, editable en su ficha).
- **Postcondición:** el comprobante enviado al OSE usa la unidad real (GLL, KGM, etc.), no "NIU" fijo.

## CU-SUNAT-002 — Emitir Nota de Crédito citando líneas reales
- **Actor:** VENTAS
- **Flujo:** desde el detalle de la factura, en la sección "Notas de crédito" marca cuántas unidades de cada línea acreditar, elige el tipo (Catálogo 9 SUNAT) y el motivo, y confirma.
- **Postcondición:** el monto (con IGV) se calcula solo; el comprobante enviado a SUNAT cita el producto real, no un texto.

## CU-SUNAT-003 — Emitir Guía de Remisión completa
- **Actor:** VENTAS, ALMACÉN
- **Flujo:** crea la guía indicando peso bruto, modalidad de transporte, ubigeo de partida/llegada (selector agrupado por departamento), y los datos de transportista/vehículo que correspondan según la modalidad.
- **Postcondición:** la guía se envía automáticamente al OSE configurado (antes nunca se enviaba); su estado SUNAT es visible y reenviable desde el detalle.

## CU-SUNAT-004 — Configurar cuentas bancarias
- **Actor:** ADMIN
- **Flujo:** en Configuración → Empresa, agrega una o más cuentas (banco, moneda, número, CCI).
- **Postcondición:** disponibles para el pie de página de Factura/Nota de Crédito.

## CU-SUNAT-005 — Configurar comunicación directa a SUNAT (cuando exista certificado)
- **Actor:** ADMIN
- **Precondición:** certificado digital (.pfx/.p12) real de una entidad certificadora acreditada, y usuario secundario SOL con facturación electrónica habilitada.
- **Flujo:** en Configuración → Empresa → Facturación electrónica SUNAT, elige "Directo a SUNAT", sube el certificado, ingresa su contraseña y las credenciales SOL.
- **Postcondición:** los comprobantes se arman como XML UBL 2.1, se firman digitalmente, y se envían por SOAP directo a SUNAT, sin pasar por un OSE.
- **Nota:** este caso de uso no pudo ejecutarse contra el servicio real en esta sesión — XXOil todavía no tiene el certificado ni las credenciales.
