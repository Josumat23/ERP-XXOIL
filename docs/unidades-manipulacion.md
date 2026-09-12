# Unidades de manipulación

Cierra la última parte del ítem *Picking/oleadas/HU de almacén*. El pallet, la caja o la jaula pasan a ser **una cosa con nombre**, que se mueve y se prepara entera.

## La decisión estructural: una tercera capa aditiva

El stock ya tenía dos capas. Las HU son la tercera, con exactamente la misma forma:

```
saldoAlmacen = suma(saldoZona)                       + sinZona
saldoZona    = suma(contenido de las HU de esa zona) + suelto
```

Lo que hay sobre un pallet **ya está contado** en el saldo de su zona. Armar una unidad no crea ni destruye stock: dice que esas unidades están apiladas en vez de sueltas en el rack.

Reusar la forma no es estética. Significa que `suelto` se **deriva** igual que `sinZona` —nunca negativo, y un descuadre queda visible comparando lo que está sobre unidades contra el total—, que desactivar las HU es dejar de mirarlas sin migrar nada, y que quien ya entendió una capa entiende la otra.

Verificado con números: 126 en el almacén, 100 en A-01, 60 sobre el pallet. Es decir **60 sobre el pallet + 40 sueltas en la zona + 26 sin zona = 126**.

## Qué mueve cada operación

| Operación | Saldo almacén | Saldo zona | Kardex |
|---|---|---|---|
| **Armar / cargar** | — | — | — |
| **Mover de zona** | — | **sí** | — |
| **Desarmar** | — | — | — |
| **Preparar en una oleada** | — | **sí** | — |

Solo mover y preparar tocan algo, y siempre la capa de zonas. **El kardex no se toca nunca**: la salida de inventario la sigue haciendo la guía cuando el camión sale.

Cargar y desarmar no mueven nada porque son la misma operación en dos sentidos: reorganizar dentro de la zona. Hay una guardia estructural que falla si alguna de las dos empieza a tocar saldos.

## Mover entre almacenes está prohibido

Cambiar una HU a una zona de **otro almacén** se rechaza con un mensaje explícito: eso es un traslado, con su kardex y su documento. Arrastrar el saldo de un almacén a otro por la puerta de las ubicaciones lo movería sin dejar rastro donde corresponde.

## Preparar un pallet entero

Es la razón por la que las HU existen. En vez de contar 60 unidades, se elige `HU-00001` y la oleada avanza de una.

**Se exige que todo su contenido quepa en lo pendiente.** Si el pallet trae de más, o trae un ítem que la oleada no pide, se rechaza y el mensaje manda a la preparación por cantidad. Bajar un pallet con sobrante obligaría a devolverlo al rack en el mismo acto —y el sistema no sabría a qué zona—; llevárselo sería stock saliendo sin documento.

Al prepararla, la unidad **deja la zona** (`zonaAlmacenId` a `null`, estado `EN_PLAYA`): su contenido ya no suma al saldo de ninguna zona, que es exactamente donde está mientras espera en la playa de despacho. Es el mismo destino al que va el picking por cantidad.

## Lo que no lleva: el lote

La trazabilidad de lote de una venta ya existe por `Envasado` → `AsignacionLoteVenta`, atada al documento. Repetirla en el contenido de la HU daría **dos respuestas a «qué lote salió»**, y la que valdría ante un recall sería la del documento. Un lote por HU es útil, pero antes hay que decidir cuál de las dos manda — y eso es trabajo del módulo de trazabilidad, no de este.

## Detalles

- **El código es la etiqueta.** En blanco se numera solo (`HU-00001`); si el pallet ya trae una impresa, se escribe, porque es la que alguien va a leer. Único por compañía.
- **Una línea por presentación** dentro de una unidad: dos filas del mismo ítem serían dos verdades sobre cuántas tiene encima.
- **Solo se sube lo suelto.** Lo que ya está sobre otro pallet no se puede subir a este sin bajarlo antes; si se permitiera, el mismo stock quedaría sobre dos unidades.
- **Borrar una unidad se lleva su contenido, no el stock**: el saldo de la zona queda intacto, porque nunca fue de la unidad.

## Verificación

**10 pruebas** (361 en total): la composición de las tres capas con datos reales, el descuadre que queda visible, que solo se suba lo suelto, la unicidad de ítem por unidad y de código por compañía, las tres razones para rechazar un pallet completo, y tres guardias — que armar y desarmar no toquen saldos, que mover entre almacenes se rechace, y que preparar valide compañía, almacén y use reclamo optimista.

**En navegador**, sobre una base de demostración nueva:

| Caso | Resultado |
|---|---|
| Crear unidad en A-01 | `HU-00001`, correlativo automático |
| Cargar 60 (de 100 en la zona) | **Almacén 126 y zona 100, sin cambios**; cero kardex |
| El suelto se recalcula | La pantalla pasó a ofrecer «40 sueltas» |
| Cargar 41 más | **Rechazado**: «La zona no tiene esa cantidad suelta: el resto ya está sobre otra unidad» |
| Mover a ENV-01 | A-01 100 → **40**, ENV-01 0 → **60**, almacén **126 sin cambios**, cero kardex |
| Preparar el pallet en una oleada | Línea 0 → **60 en un gesto**; HU a `EN_PLAYA` sin zona; ENV-01 60 → **0**; almacén **126**; cero kardex |

## Lo que este ciclo no hace

- **No anida unidades** (un pallet con cajas encima, cada una con su código). Añade una jerarquía y las preguntas que trae —mover el padre mueve a los hijos, ¿un hijo puede salir solo?— sin que nadie lo haya pedido.
- **No imprime la etiqueta.** El código está listo para imprimirse, pero el formato y el tipo de etiqueta son una decisión del almacén.
- **No pesa ni mide.** Peso y volumen por unidad servirían para planificar el camión; no hay quien los cargue hoy.
- **No devuelve automáticamente una unidad de la playa al rack.** Se hace desde el reparto entre zonas, por lo mismo que se decidió en el picking: el sistema no sabe dónde la dejaron.
