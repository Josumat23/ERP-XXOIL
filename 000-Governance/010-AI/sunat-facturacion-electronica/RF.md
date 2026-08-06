# RF — Requisitos funcionales — sunat-facturacion-electronica

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-SUNAT-001 | La Guía de Remisión debe enviarse a SUNAT/OSE igual que Factura y Nota de Crédito. | Alta | Construido y verificado |
| RF-SUNAT-002 | La Guía de Remisión debe capturar peso bruto total, modalidad de transporte (público/privado), RUC del transportista (si es público) y código UBIGEO SUNAT de partida/llegada. | Alta | Construido y verificado |
| RF-SUNAT-003 | La Nota de Crédito debe citar las líneas reales (producto/cantidad/precio) de la factura afectada, no un ítem genérico. | Alta | Construido y verificado |
| RF-SUNAT-004 | La Nota de Crédito debe registrar el código de motivo del Catálogo 9 SUNAT, no solo un texto libre. | Alta | Construido y verificado |
| RF-SUNAT-005 | Cada ítem de un comprobante debe declarar su unidad de medida real (Catálogo 3 SUNAT), no un valor fijo. | Media | Construido y verificado |
| RF-SUNAT-006 | La empresa debe poder registrar sus cuentas bancarias para el pie de página de Factura/Nota de Crédito. | Media | Construido y verificado |
| RF-SUNAT-007 | La representación impresa debe incluir el monto en letras ("SON: ..."). | Baja | Construido y verificado |
| RF-SUNAT-008 | Debe existir un catálogo completo de códigos UBIGEO SUNAT (departamento/provincia/distrito) para seleccionar en las guías. | Alta | Construido y verificado |
| RF-SUNAT-009 | Además del OSE, debe poder configurarse un envío directo a SUNAT (SEE - Del Contribuyente) sin intermediario, firmando el XML UBL con un certificado digital propio. | Media | Construido, verificación estructural únicamente (sin certificado real de SUNAT) |

## Notas
- Origen: 3 documentos reales que XXOil emite hoy (Factura, Nota de Crédito, Guía de Remisión, vía su OSE "facturaonline.pe") compartidos por el usuario, comparados directamente contra el código del groundwork de facturación electrónica ya construido (`docs/gobernanza/02-cruce-rf/SD.md`, RF-SD-050).
- RF-SUNAT-009 fue pedido explícitamente por el usuario ("tu mismo puedes desarrollar la OSE o la comunicación directa con SUNAT") tras la corrección de los 7 gaps del adaptador OSE — ver `RN.md` para el alcance exacto y sus límites.
