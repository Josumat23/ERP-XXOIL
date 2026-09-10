# Aislamiento multiempresa de compras estratégicas

Este bloque aplica la empresa activa a RFQ y acuerdos de suministro.

## Alcance

- El detalle de RFQ y sus proveedores disponibles se resuelven dentro de la empresa activa.
- Los listados, detalles y formularios de acuerdos consultan únicamente proveedores, materiales y acuerdos de la empresa activa.
- La creación y liberación de acuerdos reutiliza una sesión autenticada con la empresa activa resuelta, por lo que todas las validaciones existentes y la orden de compra resultante conservan el mismo ámbito.
- Se mantiene la configuración empresarial global existente porque `ConfiguracionEmpresa` es una fila única en el esquema actual; los niveles de aprobación aplicados sí se filtran por empresa.
