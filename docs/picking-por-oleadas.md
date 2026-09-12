# Picking por oleadas

Cierra la parte de *picking/oleadas* del ítem de Oleada 2, que estaba condicionado a que la partición por zona estuviera en producción y el volumen lo justificara.

## Qué resuelve

Preparar varias guías **en una sola recorrida**. Sin esto, quien despacha camina el almacén una vez por documento, y si el mismo ítem aparece en tres guías pasa tres veces por el mismo rack.

La lista se **consolida por presentación**: el que camina quiere saber cuántas unidades llevarse de un ítem, no repetirlo una vez por documento. El reparto entre guías lo hace el despacho, que ya sabe qué línea pertenece a cuál.

## La decisión que gobierna todo: preparar no descuenta inventario

La salida de inventario la hace **la guía cuando el camión sale**. Descontar también al preparar cobraría el stock dos veces — el mismo error que la nota de débito por mora evita al no recargar lo que el recargo ya aplicó.

Lo que el picking sí mueve es la **capa de zonas**: saca el ítem de su zona y lo deja «sin zona», que es exactamente donde está mientras espera en la playa de despacho. Así se mantiene cierta la invariante del diseño por capas:

```
suma(zonas) + sinZona = saldoAlmacén
```

Verificado con números reales: un ítem con 126 en el almacén y 80 en la zona A-01 quedó, tras preparar 15, con **126 en el almacén** (sin cambios), **65 en A-01** y 61 sin zona. Cero movimientos de kardex.

De paso, esto cierra una asimetría que la biblioteca de zonas tenía: «sin zona» ya valía como **origen** de un movimiento pero no como **destino**. Ahora vale para los dos lados, que es lo que el picking necesita.

## Qué puede entrar a una oleada

Cuatro condiciones, cada una por una razón:

| Condición | Por qué |
|---|---|
| Guía en `PLANIFICADO` | Si ya salió, no hay nada que preparar |
| El pedido requiere entrega | Un traslado no comercial no mueve inventario |
| El pedido tiene almacén | Sin él no se sabe de dónde tomar el stock |
| No está en otra oleada abierta | Dos personas preparando lo mismo es stock contado dos veces |

Y todas las guías de una oleada salen del **mismo almacén**: una recorrida ocurre en un solo lugar.

El orden de las razones importa y está probado: una guía en ruta **y además** sin almacén sigue siendo, sobre todo, una guía que ya salió — el mensaje tiene que decir eso.

## La oleada es un lote cerrado

Las guías se eligen al armarla y **no se agregan después**. Quien ya salió a caminar con la lista no puede recibir ítems nuevos a mitad del recorrido, y una lista que cambia sola deja de ser la lista que se imprimió.

Por lo mismo, `cantidadRequerida` se **congela** al armar: es lo que se le pidió al picker. Si una guía se anula después, el trabajo ya se hizo y la lista no se reescribe.

## De dónde tomar cada ítem

Se muestran las zonas con stock ordenadas por **código** —que es como están rotuladas y, con slotting, como están dispuestas— y al final lo que está sin zona, porque es lo que hay que salir a buscar. Una zona en cero no se sugiere: mandar a alguien a un rack vacío es peor que no decirle nada.

**El sistema no elige la zona.** No sabe cuál está más cerca de la puerta ni cuál tiene la mercadería más vieja; muestra las opciones con lo que hay en cada una y decide la persona.

## Los dos límites al preparar

- **Nunca más de lo pedido.** Preparar de más no es un sobrante que alguien note en el momento: es stock saliendo del almacén sin documento que lo respalde.
- **Nunca más de lo que hay en el origen elegido**, con el mismo reclamo optimista que usa el reparto manual entre zonas.

## Completar con faltante sí; cancelar con mercadería abajo no

**Completar con faltante está permitido** y el faltante queda a la vista. Bloquearlo dejaría al almacén sin poder cerrar el trabajo del día por una unidad que no apareció.

**Cancelar una oleada con mercadería ya preparada está bloqueado.** El sistema no sabe a qué zona volvió cada unidad, y devolverla es una decisión que se toma a conciencia en el reparto entre zonas. El mensaje dice exactamente dónde hacerlo.

## Verificación

**13 pruebas** (351 en total): las cuatro razones de no elegibilidad y su orden, la consolidación por presentación, el orden de las sugerencias y la exclusión de zonas vacías, los dos límites al preparar, el avance y el faltante, «sin zona» como destino válido, la invariante de las capas con datos reales, la unicidad guía–oleada y la cascada. Más tres guardias: que el picking no toque el kardex, que valide compañía con reclamo optimista, y que no se cancele con mercadería preparada.

**En navegador**, sobre una base de demostración nueva con dos guías planificadas del mismo almacén:

| Caso | Resultado |
|---|---|
| Guías elegibles | Las dos aparecen; elegida la primera, el resto se limita a su almacén |
| Oleada armada | `OP-00001`, dos guías, **líneas consolidadas**: el pote de 10 + 5 quedó como una línea de 15 |
| Sugerencias de zona | Pote: `A-01 (80)` y `Sin zona (46)` — suman los 126 del almacén. Balde: solo `Sin zona (22)` |
| Preparar 15 desde A-01 | Almacén **126 sin cambios**, zona 80 → **65**, **cero movimientos de kardex** |
| Línea completa | Deja de ofrecer formulario y muestra «Completa» |
| Cancelar con lo preparado | **Rechazado**: la oleada siguió `ABIERTA` (comprobado dos veces) |
| Completar con faltante | `COMPLETADA` por su usuario, con las 2 unidades del balde sin preparar registradas |

## Lo que este ciclo no hace

- **No hay unidades de manipulación (HU).** Paletizar y seguir un pallet como entidad propia es un modelo aparte, con su etiqueta y su historia; no es lo mismo que preparar una lista.
- **No asigna picker ni mide tiempos.** Nadie pidió productividad por operario, y medirla sin haberlo acordado con quien la va a ser medido es una decisión del negocio.
- **No ordena la recorrida por distancia.** Con slotting jerárquico el código ya agrupa por pasillo; una ruta óptima real necesita un mapa del almacén que el sistema no tiene.
- **No reserva el stock preparado.** La reserva la sigue llevando el pedido; el picking no crea una segunda contabilidad de compromisos.
