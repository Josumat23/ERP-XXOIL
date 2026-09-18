# Del reclamo al lote

Un reclamo de cliente registraba cliente, factura, causa y descripción. **Nada sobre el lote.**

Quien investiga no sabía qué revisar —¿qué producción salió mal?— ni si el problema alcanza a alguien más. Y el dato estaba guardado desde siempre: el comentario de `AsignacionLoteVenta` en el esquema dice, con esas palabras, que ese ledger existe «para responder, ante un reclamo de calidad o un recall, ¿qué facturas/clientes recibieron unidades del lote X?».

Nadie lo había conectado con la pantalla de reclamos. Toda la cadena de trazabilidad construida en los ciclos anteriores estaba desenchufada del evento que más veces inicia un recall.

## Se deriva, no se declara

No se agrega ningún campo al reclamo ni se pide nada nuevo al registrarlo. El lote sale de la factura, por el camino que ya existe:

```
Factura → renglones → asignaciones de venta → envasado → lote granel
```

Si la factura llevó tres lotes, **los tres son candidatos y se muestran los tres**. Decir «es este» eligiendo uno sería inventar una precisión que el documento no tiene: la pantalla lo dice explícitamente —«el reclamo corresponde a alguno de ellos»— y aclara que el lote es derivado de la venta.

## Los dos caminos cuentan

Una unidad puede estar atada al renglón de la **factura** o al de la **guía** que esa factura ampara (`FacturaDetalleEntrega`). Mirar solo el primero devolvería media respuesta con cara de completa — el defecto que estos ciclos vienen sacando del sistema.

Los datos de prueba de hoy **no ejercitan la segunda rama**: 23 asignaciones por factura, cero por guía, y ninguna entrega factura↔guía registrada. Medido, no supuesto. Así que la prueba la arma a mano: una guía con su renglón, atada a un renglón de factura, y una asignación que cuelga de la guía y **no** de la factura. Después comprueba que el lote se alcanza **con esa rama sola** — verificarlo con la condición completa no probaría nada, porque ese envasado también tiene una asignación por factura y pasaría por la primera.

## Las tres situaciones, dichas distinto

| Situación | Qué dice |
| --- | --- |
| Sin factura relacionada | «No hay por dónde llegar al lote. Si se conoce el documento de la venta, indíquelo al registrarlo» |
| Con factura, sin unidades atadas a lote | «Puede ser una venta anterior a la trazabilidad por lote, o una factura anulada o devuelta por completo» |
| Con lotes | La tabla, y si son varios, que el reclamo corresponde a alguno |

No es lo mismo «no hay factura» que «la factura no tiene trazabilidad»: son dos situaciones distintas y dos cosas distintas que hacer.

## El neto es por renglón, y de esta factura

La resta ASIGNADA − LIBERADA se hace por renglón de venta, así que la consulta trae **solo los renglones de esta factura**: mezclar otras ventas del mismo envasado daría un neto que no es de acá. Un renglón anulado o devuelto por completo queda en cero y no aparece — acusar al cliente de reclamar sobre algo que devolvió sería mandarlo a revisar un lote que no le llegó.

## La pregunta siguiente

Desde cada lote, dos enlaces: **quién más lo tiene** —que lleva al recall por lote, con la lista de clientes y a quién llamar— y el **certificado de análisis**. Es la razón de todo el ciclo: si el reclamo tiene razón, ¿a quién más le llegó?

## Los datos que faltaban

La base sembrada no traía **ningún** reclamo, así que la sección no se podía ver ni probar a mano. `npm run seed:trazabilidad` crea uno contra una factura que de verdad llevó unidades asignadas a un lote —un reclamo contra una factura sin trazabilidad mostraría justo el caso que no hace falta sembrar—. Solo si no hay ninguno: el trabajo de alguien no se toca.

## Verificación en navegador (`erp_dev`)

| Caso | Qué muestra |
| --- | --- |
| RCL-00001, factura F001-00000001 | «La factura llevó un solo lote» → LG-00001, Grasa Chasis, Aprobado, 2 unidades, ENV-00001 · Pote 1 lb × 2 |
| Reclamo temporal contra F001-00000014 (3 lotes) | «La factura llevó 3 lotes: el reclamo corresponde a alguno de ellos» → LG-00001, LG-00003, LG-00002 |
| Reclamo temporal sin factura | «Este reclamo no tiene factura relacionada, así que no hay por dónde llegar al lote» |

Los dos reclamos temporales se crearon para ejercitar las ramas y se borraron después.

`tests/reclamo-al-lote.test.ts`: 17 pruebas. La guarda de los dos caminos se verificó quitando la rama de la guía de la pantalla: se pone en rojo.
