# Nota de débito por intereses de mora

Cierra el último pendiente del Blueprint 05: *`model NotaDebito`, ausente*.

## Por qué acotada al recargo por mora

El catálogo 10 de SUNAT admite tres tipos de nota de débito: **01 intereses por mora**, 02 aumento en el valor, 03 penalidades y otros conceptos.

El sistema calcula por su cuenta **uno solo**: el recargo por mora sobre facturas vencidas, con su tasa configurable, sus días y su monto. Construir la emisión de los otros dos exigiría decidir cuándo corresponde una nota de débito por aumento de valor o por penalidad, y sobre qué base — decisión del negocio que este código no inventa.

Los tres códigos están en el enum para que el catálogo quede completo y correcto. **Hoy solo se emite el 01**, y una prueba lo exige.

## La decisión que hace que esto sea correcto

> La nota de débito **no vuelve a cargar nada**.

Cuando se aplica un recargo por mora, `aplicarRecargoAFactura()` ya hace dos cosas: **sube el saldo de la factura** y **postea el asiento** (CxC contra Ingresos por mora). El recargo ya está cobrado y contabilizado.

La nota de débito es el **comprobante** de ese recargo, no un segundo cobro. Por eso la acción de emitirla no toca el saldo ni postea nada: hacerlo cobraría dos veces lo mismo, y el cliente recibiría un documento por un importe que ya estaba en su cuenta.

Tres pruebas lo protegen: una lee el código de la acción y falla si aparece un `postearAsiento`, un `saldo: { increment }` o un `factura.update`; otra comprueba en base que el saldo queda intacto; y el modelo tiene `recargoMoraId` **único**, así que un recargo tiene a lo sumo una nota de débito.

## Lo que se corrigió de paso

El adaptador de envío directo a SUNAT elegía el XML con un ternario encadenado:

```ts
tipoDocumento === "FACTURA" ? factura : tipoDocumento === "NOTA_CREDITO" ? notaCredito : guiaRemision
```

Agregar un tipo nuevo lo habría hecho caer en la última rama: una nota de débito se habría enviado a SUNAT **con la estructura de una guía de remisión**, sin que nada lo advirtiera.

Ahora cada tipo se nombra explícitamente, y la nota de débito **se rechaza con un motivo claro**:

> *"El envío directo a SUNAT todavía no arma el UBL de una nota de débito. Emítala por un OSE, o hágalo en el portal de SUNAT y registre aquí el número."*

Construir el UBL `DebitNote` sin poder probarlo contra SUNAT —lo que exige el certificado digital real, que sigue siendo un trámite externo pendiente— sería adivinar la estructura de un documento tributario. Es preferible decir que no está que mandar un XML inventado.

Por el adaptador **Nubefact** sí se envía (`tipo_de_comprobante: 4`, `tipo_de_nota_de_debito`), con el mismo aviso que ya lleva ese archivo: está escrito según la documentación pública y no fue probado contra el servicio real.

## Detalles

- **Numeración por compañía** (`@@unique([empresaId, numero])`) y `siguienteNumeroNotaDebito` filtrando por compañía, como el resto de documentos desde el ciclo de numeración.
- **Series**: `TipoDocumentoSerie` gana `NOTA_DEBITO`, así el número puede salir de una serie configurada o escribirse a mano.
- **Sin IGV desagregado.** El monto va íntegro como total. No se inventa un tratamiento tributario del interés moratorio: el sistema manda el importe tal como lo calculó, y el detalle fiscal es criterio del contador.
- **El motivo se deriva del recargo**: *"Intereses por mora de N día(s) sobre la factura F001-…"*. No se pide texto libre porque el concepto ya está determinado.

## Verificación

**7 pruebas** (247 en total): los códigos del Catálogo 10 con sus etiquetas; la guardia de que emitir no carga ni contabiliza; el `recargoMoraId` único en base y el saldo intacto; la numeración por compañía; que el envío directo ya no pueda caer en la guía de remisión; que los catálogos de envío traigan `08` (SUNAT) y `4` (Nubefact); y que solo se emita el tipo 01.

**Navegador**, sobre la factura vencida `F001-00000014` con un recargo de S/ 17.11 aplicado:

| | Antes de emitir | Después de emitir |
|---|---|---|
| Saldo de la factura | S/ 273.76 | **S/ 273.76** |
| Asientos de recargo por mora | 0 | **0** |
| Notas de débito | 0 | **ND-00001** |

La columna del recargo pasó de mostrar el botón a mostrar `ND-00001`, y el comprobante electrónico quedó registrado con el adaptador `SIMULADO`, que es el estado seguro por defecto — nadie recibe un CDR falso por accidente.

## Lo que no hace

- **No emite por aumento de valor ni por penalidad.** Ya explicado: falta la decisión de negocio.
- **No arma el UBL para envío directo a SUNAT.** Falta el certificado digital real para poder probarlo.
- **No anula ni corrige una nota de débito emitida.** Igual que el resto de documentos de este sistema, la historia no se edita; si hiciera falta revertir, el instrumento es otro documento, y cuál corresponde es criterio del contador.
