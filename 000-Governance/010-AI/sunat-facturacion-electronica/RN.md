# RN — Reglas de negocio — sunat-facturacion-electronica

| ID | Regla | Por qué |
|---|---|---|
| RN-SUNAT-001 | El costo real de una Nota de Crédito se calcula desde sus líneas (`NotaCreditoDetalle`), nunca se ingresa un monto suelto. | Es la única forma de que el comprobante enviado a SUNAT cite el producto/cantidad real que se está acreditando, no un texto libre disfrazado de ítem. |
| RN-SUNAT-002 | La cantidad acreditada por línea de Nota de Crédito no puede exceder lo vendido en esa línea menos lo ya acreditado por notas de crédito previas. | Evita acreditar más unidades de las que realmente se vendieron, sin importar cuántas notas de crédito parciales se emitan sobre la misma factura. |
| RN-SUNAT-003 | En una Guía de Remisión con modalidad de transporte "Privado" son obligatorios placa de vehículo y DNI del conductor; con modalidad "Público" es obligatorio el RUC del transportista. | Refleja exactamente qué dato exige SUNAT según el Catálogo 20 (modalidad de transporte) — no tiene sentido pedir RUC de transportista a una empresa que usa su propia flota. |
| RN-SUNAT-004 | El ubigeo de partida y de llegada son obligatorios en toda guía nueva (no había ningún campo así antes). | Es un dato obligatorio del XML de SUNAT; sin él, la guía real sería rechazada — se prefirió bloquear en el formulario a fallar silenciosamente en el envío. |
| RN-SUNAT-005 | Los códigos UBIGEO usados son específicamente los de la columna SUNAT del catálogo (no INEI ni RENIEC), porque divergen en 53 distritos del país (ej. Huánuco tiene departamento "10" en SUNAT/INEI pero "09" en RENIEC). | Usar el código equivocado produciría un documento tributario con una dirección incorrecta sin que nadie lo note hasta que SUNAT lo rechace. |
| RN-SUNAT-006 | El proveedor "SUNAT_DIRECTO" (comunicación directa) no tiene modo simulado — si falta el certificado, su contraseña, o las credenciales SOL, el envío falla explícito con un mensaje claro, en vez de fingir éxito. | A diferencia de "SIMULADO" (que existe para poder probar el flujo completo sin OSE contratado), no tendría sentido simular un envío firmado digitalmente — la firma en sí ya requiere un certificado real, así que no hay nada que simular de forma útil. |
| RN-SUNAT-007 | El adaptador directo a SUNAT no fue verificado contra el servicio real (ni ambiente beta ni producción) — solo se verificó que el XML generado esté bien formado y que la firma XMLDSig sea criptográficamente válida contra un certificado de prueba autogenerado. | XXOil no tiene todavía un certificado digital real ni credenciales de homologación SUNAT. Fingir una prueba contra el servicio real sin esas credenciales sería imposible y presentar el código como "probado" sin serlo sería deshonesto — misma disciplina que ya aplicaba el adaptador Nubefact existente. |

## Casos borde considerados
- Nota de crédito que intenta acreditar más unidades de las vendidas en una línea (rechazada con el mensaje exacto de cuánto queda disponible).
- Precedencia de precedencias — descartado, no aplica a este módulo (ver `proyectos` para eso).
- Guía con modalidad pública sin RUC de transportista, o modalidad privada sin placa/DNI — ambas rechazadas en el servidor, no solo en el cliente.
- Fila del catálogo de ubigeos con datos corruptos (un código "NA" en la fuente original) — filtrada antes de sembrar, no se cargó a la base.
