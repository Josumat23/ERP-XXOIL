# Dirección fiscal del emisor con ubigeo

Cierra lo que quedó declarado como pendiente al terminar el ciclo de ubigeo estructurado: *"`ConfiguracionEmpresa` sigue con texto libre… esa dirección alimenta el XML de facturación electrónica y merece su propio ciclo, con su propia verificación contra el comprobante emitido."*

## El hallazgo

`src/lib/sunatUbl.ts` **ya aceptaba** el ubigeo del emisor:

```ts
type Emisor = { ruc: string; razonSocial: string; direccion?: string | null; ubigeo?: string | null };
...
${emisor.ubigeo ? `<cbc:ID schemeAgencyName="PE:INEI">${escaparXml(emisor.ubigeo)}</cbc:ID>` : ""}
```

Pero **nadie se lo pasaba**. El objeto que arma el adaptador tenía tres campos y ese no estaba, así que el XML salía sin el ubigeo del emisor — y como el campo es condicional, no fallaba nada: simplemente el nodo no aparecía.

Es el mismo patrón que ya apareció dos veces en esta sesión: una capacidad construida a la que nadie conecta la fuente de datos, sin ningún error que lo delate.

## Lo que se hizo

`ConfiguracionEmpresa` gana `ubigeoId` hacia el catálogo SUNAT, con el mismo criterio que `Cliente`, `Proveedor` y `Almacen`:

- **El texto libre se conserva** (`distrito`, `provincia`, `departamento`): guarda lo que se escribió antes del catálogo y es el respaldo de lo que el backfill no empareje. Cuando hay ubigeo, sus nombres mandan y el texto queda sincronizado, porque los documentos impresos lo leen.
- **El id se valida** contra el catálogo dentro de la misma transacción: llega de un formulario, y ese código termina en el XML que se le manda a SUNAT.
- **Backfill conservador**: solo empareja cuando la combinación resuelve a un único distrito.
- El formulario reemplaza la terna de texto por el selector en cascada, con una nota de por qué importa: *"El distrito viaja al XML como código de ubigeo de 6 dígitos, que es lo que SUNAT espera del emisor — no el nombre."*

**`obtenerConfiguracionEmpresa()` devuelve el ubigeo incluido siempre.** Quien arma un comprobante necesita el código junto al resto de la configuración; dejarlo para una segunda consulta es lo que hace que se olvide — que es exactamente lo que había pasado.

## Verificación

**4 pruebas** (263 en total): la configuración trae el ubigeo incluido y nace sin él sin romper nada; cada compañía tiene su propia dirección fiscal; y dos guardias — que el código llegue a las credenciales y de ahí al emisor del UBL, y que el distrito se valide contra el catálogo y el formulario ya no mande la terna a mano.

**De punta a punta**: se configuró San Isidro como dirección del emisor y se armó el UBL de una factura leyendo la configuración como lo hace el envío real. El bloque del emisor quedó así:

```xml
<cbc:ID schemeAgencyName="PE:INEI">150131</cbc:ID>
<cbc:Line>Av. Javier Prado 123</cbc:Line>
```

Antes de este ciclo, ese `<cbc:ID>` no existía.

## Con esto se cierra el ubigeo

Los cuatro lugares donde el sistema guarda una dirección peruana usan ahora el catálogo oficial: **Cliente**, **Proveedor**, **Almacén** y el **emisor**.

## Lo que sigue igual

- **El backfill no normaliza tildes.** "Huanuco" empareja, "Huánuco" no. Con un solo registro de configuración por compañía, corregirlo en pantalla es trivial.
- **`ciudad` y `codigoPostal` siguen siendo texto libre**: no forman parte del ubigeo y no viajan al XML con estructura.
