# Boleta de venta

Cierra el pendiente del Blueprint 05 sobre `BOLETA`, que estaba condicionado a una decisión de negocio: **el negocio confirmó el 2026-09-12 que el canal minorista existe.**

## La regla sale del documento del comprador, no del canal

Este es el punto que define el ciclo, y la pregunta original ("¿hay canal minorista?") se presta a contestarlo mal.

**El canal comercial no decide el comprobante.** Un cliente del canal minorista que es una empresa con RUC recibe **factura**; una persona natural con DNI recibe **boleta**, compre al por mayor o al detalle. El canal (`CanalCliente`) gobierna descuentos y reportes comerciales; confundirlo con el tipo de comprobante emitiría el documento equivocado a media cartera.

La regla implementada:

| Documento del cliente | Comprobante |
|---|---|
| RUC peruano (11 dígitos) | Factura |
| DNI (8 dígitos) | **Boleta** |
| Sin documento | **Boleta** |
| Documento extranjero (RUT, NIT, RFC, EIN, VAT…) | Factura |

La última fila es deliberada: una boleta es un comprobante para consumidor final peruano. Dársela a un cliente del exterior sería peor que dejar la factura como estaba.

No se inventa nada: es la distinción que hace el propio Catálogo 01 de SUNAT, que este repo ya citaba en el esquema (*"01 Factura, 03 Boleta"*).

**Se deriva, no se elige.** `tipoComprobantePara()` ni siquiera recibe el canal — es la forma más segura de que no pueda influir — y el tipo no sale de ningún campo del formulario, así que nadie puede pedir una boleta para un RUC. Una prueba lo exige.

## Un defecto que esto destapó

El sistema **ya aceptaba clientes con DNI** —la validación admite 8 u 11 dígitos— pero el envío electrónico tenía el tipo de documento del adquirente **fijo en RUC**:

```ts
cliente_tipo_de_documento: 6, // RUC (este sistema solo emite Factura, no Boleta)
```

Es decir: el DNI de un cliente se le declaraba a SUNAT como si fuera un RUC. Ahora sale del Catálogo 06 según el documento real: 6 RUC, 1 DNI, 0 sin documento.

## La serie tiene que decir la verdad

Las series de factura empiezan con **F** y las de boleta con **B**. Emitir una boleta numerada `F001-…` produciría un comprobante que miente sobre lo que es.

Al facturar, si el número elegido no corresponde al documento derivado, **se rechaza con un mensaje que explica por qué**:

> *"El cliente no tiene RUC, así que corresponde una boleta: use una serie que empiece con B (ej. B001), no F001-00000045."*

Se avisa en vez de corregirlo en silencio: elegir la serie es del usuario, y cambiarle el número sin decírselo sería peor.

`TipoDocumentoSerie` gana `BOLETA` (y `NOTA_DEBITO`, que faltaba del ciclo anterior), así que ambas series se configuran en Configuración → Series.

## Lo demás no cambia

- **La boleta comparte el documento UBL `Invoice` con la factura**: lo que cambia es el código de tipo (03 en vez de 01) y el documento del adquirente, no la estructura. Por eso el envío directo a SUNAT la cubre sin construir nada nuevo.
- **Nubefact**: `tipo_de_comprobante: 2`, con el mismo aviso que ya lleva ese archivo — escrito según documentación pública, no probado contra el servicio real.
- **`Factura.tipoComprobante` nace en `FACTURA`** para todas las filas existentes, y eso es correcto: hasta ahora el sistema solo emitía factura, así que el valor histórico no es una suposición.
- **Los importes no cambian.** Base, IGV y total se calculan igual; no se inventa un tratamiento distinto para la boleta.

## Verificación

**8 pruebas** (259 en total): la derivación en sus cuatro casos; **que el canal no influya** —minorista con RUC → factura, mayorista con DNI → boleta—; el cliente extranjero conservando factura; el Catálogo 06 dejando de declarar todo como RUC; el prefijo de serie; la serie contradictoria rechazada; y las guardias de que el tipo se derive y no se elija, que el envío use el tipo guardado, y que la boleta comparta el UBL de la factura.

**Navegador**: un documento con `tipoComprobante: BOLETA` se muestra como **B001-00000001** con la insignia *"Boleta de venta"*, y el membrete impreso dice **BOLETA DE VENTA** en vez de FACTURA.

**Alcance de lo verificado, con precisión:** la derivación está cubierta por pruebas unitarias y guardias estructurales sobre el punto de llamada; en el navegador se verificó el render del documento como boleta. No se ejercitó una emisión completa desde la pantalla porque la demo no tenía pedidos pendientes y el panel de vista previa no procesa envíos de formulario cuando está oculto.

## Lo que no hace

- **No implementa el resumen diario de boletas.** SUNAT admite informar boletas de bajo monto agrupadas en un resumen diario en vez de una por una, con sus propios plazos y umbrales. Emitirlas individualmente es siempre válido; construir el resumen exige criterio contable sobre cuándo conviene y con qué corte, y eso no se inventa.
- **No cambia clientes ya registrados.** Un cliente con DNI que hoy tiene facturas emitidas las conserva; el cambio aplica a lo que se emita de aquí en adelante.
- **No valida el dígito verificador** del RUC ni del DNI. La validación sigue siendo de formato, como estaba.
