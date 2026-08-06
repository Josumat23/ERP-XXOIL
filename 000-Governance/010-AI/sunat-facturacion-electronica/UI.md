# UI — Pantallas — sunat-facturacion-electronica

## `configuracion/empresa` (extendida)
- Sección "Facturación electrónica SUNAT": selector de proveedor con 3 opciones (Simulado, OSE — Nubefact, Directo a SUNAT). Al elegir "Directo a SUNAT" aparece un aviso y los campos de certificado (.pfx/.p12), su contraseña, y usuario/clave SOL.
- Nueva sección "Cuentas bancarias" (componente `CuentasBancarias.tsx`): tabla + alta/baja.

## `catalogo/presentaciones` (extendida)
- Campo "Unidad de medida SUNAT" en el formulario (select con 6 códigos relevantes para grasas/lubricantes: NIU, KGM, LTR, GLL, BLL, ZZ).

## `comercial/facturas/[id]` (rediseñada)
- La sección "Notas de crédito" pasó de un input de monto suelto a una tabla de líneas de la factura con "disponible" y "cantidad a acreditar" por línea, más un selector de tipo de nota (Catálogo 9 SUNAT). El botón muestra el monto calculado en vivo.
- Tabla de notas de crédito existentes: nueva columna "Tipo".

## `logistica/guias-remision/nueva` (extendida)
- Nuevos campos: peso bruto total (kg), modalidad de transporte (con RUC de transportista obligatorio solo si es "Público"; placa/DNI obligatorios solo si es "Privado"), y dos selectores de ubigeo (partida/llegada) agrupados por departamento (`<optgroup>`, 1,834 opciones).

## `logistica/guias-remision/[id]` (extendida)
- Nueva franja de estado SUNAT (igual patrón que Factura): badge + botón "Enviar/Reenviar a SUNAT".
- Nuevos datos mostrados: ubigeo de partida/llegada (con código), peso bruto declarado, modalidad de transporte, RUC del transportista.

## Navegación
- Sin cambios de navegación — todo vive dentro de pantallas ya existentes.
