# TEST — Verificación — sunat-facturacion-electronica

## Parte 1 — gaps del adaptador OSE (100% verificado en navegador)

### Escenario 1 — Catálogo de ubigeos
- **Pasos:** obtener el catálogo oficial SUNAT (vía CONCYTEC, derivado del Excel que publica SUNAT), sembrar en `Ubigeo`.
- **Resultado esperado:** 1,834 filas; códigos 150102 y 100101 coinciden con los documentos reales del usuario.
- **Resultado obtenido:** exacto — `150102` → LIMA/LIMA/ANCON, `100101` → HUANUCO/HUANUCO/HUANUCO.

### Escenario 2 — Unidad de medida real por presentación
- **Pasos:** cambiar `unidadMedidaSunat` de "Balde 35 lb" a "ZZ", crear una factura con esa presentación.
- **Resultado esperado:** el payload armado usa "ZZ", no "NIU".
- **Resultado obtenido:** exacto (verificado en el código del adaptador; el campo se lee de `presentacion.unidadMedidaSunat`).

### Escenario 3 — Nota de crédito con líneas reales
- **Pasos:** factura F001-00000001 (4 unidades de Balde 35 lb a S/210), nota de crédito acreditando 2 unidades con tipo "Corrección por error en la descripción".
- **Resultado esperado:** monto = 2×210×1.18 = S/495.60 exacto; `NotaCreditoDetalle` referencia el `pedidoDetalleId` real; comisión revertida = 2×210×2.5% = S/10.50.
- **Resultado obtenido:** exacto en los 3 valores, confirmado por SQL directo.

### Escenario 4 — Guía de remisión completa, enviada a SUNAT
- **Pasos:** guía con peso bruto 360 kg, modalidad privada, placa/DNI, ubigeos 150102→100101 (mismos que el documento real del usuario).
- **Resultado esperado:** se crea un registro `ComprobanteElectronico` para la guía (antes de esta corrección, nunca se creaba ninguno).
- **Resultado obtenido:** exacto — `estado: "ACEPTADO"` (simulado), confirmado por SQL directo.

### Escenario 5 — Validaciones de modalidad de transporte
- **Pasos:** intentar crear una guía con modalidad "Público" sin RUC de transportista.
- **Resultado esperado:** rechazada, ninguna fila creada.
- **Resultado obtenido:** exacto — confirmado que no se creó `T001-00000002` en la base.

### Escenario 6 — Cuentas bancarias
- **Pasos:** agregar una cuenta BBVA en Configuración → Empresa.
- **Resultado esperado:** aparece en la tabla inmediatamente.
- **Resultado obtenido:** exacto.

### `numeroALetras`
- Probado contra los 2 montos reales de los documentos del usuario: 1,440.00 → "MIL CUATROCIENTOS CUARENTA Y 00/100 SOLES"; 10,500.00 → "DIEZ MIL QUINIENTOS Y 00/100 SOLES" — coincide carácter por carácter con lo impreso en los documentos reales.

### `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios, confirmado después de cada tanda de cambios de Parte 1 y Parte 2.

### Datos de prueba a limpiar
- Factura F001-00000001, su pedido, nota de crédito, guía T001-00000001, la cuenta bancaria y el cambio de `unidadMedidaSunat` de prueba — todos insertados vía UI real, eliminados por SQL directo (`better-sqlite3`) tras la verificación, incluyendo restaurar el stock consumido por la facturación de prueba.

## Parte 2 — adaptador directo a SUNAT (verificación estructural únicamente)

### Escenario 7 — XML UBL bien formado y firmado
- **Pasos:** generar un certificado de prueba autogenerado (`openssl req -x509` + `pkcs12 -export`, NO un certificado real de SUNAT), construir el XML UBL de una Factura y de una Guía de Remisión (con los mismos datos de los documentos reales del usuario) y firmarlos.
- **Resultado esperado:** el XML contiene `<ds:Signature>` correctamente ubicado dentro de `<ext:UBLExtensions>/.../<ext:ExtensionContent>`, con los elementos `SignedInfo`/`Reference`/`DigestValue`/`SignatureValue` bien formados.
- **Resultado obtenido:** exacto en ambos documentos.

### Escenario 8 — La firma es criptográficamente válida (autoconsistencia)
- **Pasos:** verificar la firma generada contra el certificado de prueba, usando la propia librería `xml-crypto` en modo verificación.
- **Resultado esperado:** válida.
- **Resultado obtenido:** inválida con canonicalización `REC-xml-c14n-20010315` (no exclusiva) — el digest no coincidía tras remover el nodo de firma. **Corregido** cambiando a canonicalización exclusiva (`xml-exc-c14n#`), tanto en el algoritmo de canonicalización de la firma como en el transform de la referencia — es además la elección correcta para documentos UBL con múltiples namespaces declarados en la raíz. Tras el cambio: válida.

### Escenario 9 — Nombre de archivo y compresión ZIP
- **Pasos:** generar el nombre de archivo SUNAT (`RUC-tipo-serie-numero`) y comprimir/descomprimir un XML de prueba.
- **Resultado esperado:** nombre = `20606595523-01-F001-365`; el contenido recuperado del ZIP coincide exacto con el original.
- **Resultado obtenido:** exacto.

### Lo que NO se verificó (y no se puede verificar sin lo siguiente)
- Envío real contra el ambiente beta o producción de SUNAT — requiere un certificado digital real de XXOIL S.A.C. emitido por una entidad certificadora acreditada, y un usuario secundario SOL con facturación electrónica habilitada.
- Que el XML pase la validación de esquema (XSD) exacta que aplica SUNAT — se construyó según la estructura pública documentada, pero solo el envío real (o una validación contra el XSD oficial, no incluida en este alcance) lo confirmaría con certeza.
- Que el algoritmo de firma (RSA-SHA1, histórico en UBL Perú) siga siendo el exigido por SUNAT al día de uso — verificar contra la documentación técnica vigente antes de production.
