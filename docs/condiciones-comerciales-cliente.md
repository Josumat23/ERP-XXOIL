# Condiciones comerciales del cliente

Bloque 5 del maestro. Lo que cambia la operación diaria.

## El descuento del cliente reemplaza al del canal

No se suman. Lo más específico manda — y es la única regla que no obliga a inventar cómo se componen dos porcentajes: **15% y 10% podrían ser 25% o 23.5%** según quién lo mire, y elegir por el negocio sería inventarle una política de precios.

Un detalle que importa: **un descuento de cliente en 0 es una decisión**, no un hueco. Significa «a este no le corresponde el descuento del canal». Por eso el estado «sin descuento propio» se expresa con `null` y no con cero — la misma distinción que hizo falta en el límite de crédito, por la misma razón.

## La orden de compra pasa a exigirse de verdad

`Pedido.ordenCompraCliente` ya existía: se podía llenar o dejar en blanco y a nadie le importaba. Ahora el cliente declara si la exige, y sin ella el pedido no se toma.

No es burocracia: **un despacho sin la OC del cliente vuelve rechazado desde su almacén**, con el flete pagado y la carga de vuelta.

Un espacio en blanco no cuenta como orden de compra.

## El mínimo de pedido

Se compara contra el total **en la moneda del pedido**, que es la misma en la que se acordó el mínimo. Convertir acá haría que el mínimo cambiara con el tipo de cambio del día, y eso no es lo que nadie acuerda con un cliente.

La comparación lleva tolerancia de centavo: la aritmética de punto flotante no debe rechazar un pedido que suma exactamente el mínimo.

## El orden de las dos validaciones

La orden de compra se comprueba **antes** que el mínimo. Quien recibe el rechazo necesita saber qué incumplió, y la falta de OC es la que no se arregla agregando líneas al pedido.

Y las dos se comprueban **antes de escribir nada**: si se revisaran después de reservar stock, un pedido rechazado dejaría stock comprometido. Una guardia comprueba ese orden leyendo el código.

## Lo que no se construyó

**La lista de precios.** Asignar una lista exige que exista el maestro de listas con sus ítems y que el cálculo de precio los lea. Un campo `listaPreciosId` apuntando a una tabla vacía sería un dato que nadie usa — exactamente el patrón que estos ciclos vienen evitando. Va como módulo propio, y el precio hoy sale de la presentación, sus escalones por volumen y el descuento que ahora resuelve este módulo.

**El segmento de mercado.** El canal comercial ya distingue distribuidor, mayorista, taller, flota, minera/industria y minorista, y es el que gobierna descuentos y reportes. Un «segmento» además del canal necesita que el negocio diga cuáles son sus segmentos y para qué los usa; inventar una lista de rubros sería llenar un campo que después nadie mantiene.

**El incoterm.** Solo tiene sentido con comercio exterior, que el negocio confirmó que no hay.

## La prioridad de atención

`ALTA / NORMAL / BAJA`, con su orden explícito para que la cola de despacho no dependa de cómo se escriba el enum. Ordena la planificación cuando hay más pedidos que capacidad — que es el caso en el que un maestro tiene que decir a quién se atiende primero.
