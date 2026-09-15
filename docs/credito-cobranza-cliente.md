# Crédito y cobranza del cliente

Bloque 6 del maestro. Lo interesante de este ciclo fue **cuánto no había que agregar**.

## Tres cosas que no se construyeron, y por qué

**No hay `diasCredito`.** `CondicionPago` ya expresa los días —CONTADO, 15, 30— y está embebida en pedidos, facturas y en las aprobaciones de crédito. Un campo paralelo serían dos fuentes de verdad para el mismo dato, y el día que se contradigan nadie sabría cuál manda. Si el negocio necesita 45 o 60 días, se agrega al enum: es un cambio chico y explícito. Una guardia falla si aparece un `diasCredito` en el cliente.

**No hay columna `estadoCredito`.** Se **deriva** de `bloqueadoCobranza` y de la bandera de aprobación:

| | |
| --- | --- |
| Bloqueado por cobranza | BLOQUEADO |
| Sujeto a aprobación | SUJETO_A_APROBACION |
| Ninguno | HABILITADO |

Con los dos primeros a la vez manda el bloqueo: un cliente frenado por deuda no está «sujeto a aprobación», está frenado. Una tercera columna que hay que mantener en sintonía con las otras dos es exactamente cómo tres banderas terminan contradiciéndose — y ya hay dos: el estado del maestro y el de cobranza.

**No hay puntaje de riesgo calculado.** Traducir un historial a BAJO/MEDIO/ALTO con una fórmula sería inventar una política de crédito que nadie definió. El nivel lo pone una persona; lo que sí se calcula es el **comportamiento de pago**, y se muestra al lado para que esa persona clasifique mirando hechos.

## Lo que sí se agregó

**`nivelRiesgo` + `motivoNivelRiesgo`.** Clasificar como riesgo alto **exige motivo**: restringe a alguien, y esa decisión tiene que poder releerse. Bajo y medio no lo necesitan.

**`toleranciaVencimientoDias`.** Días de gracia antes de contar una factura como vencida **para este cliente**. Corre la política de escalamiento de la compañía, no la reemplaza ni la apaga: `null` significa que rige la política tal cual. Se acota a 90 días — más que eso desactiva la cobranza en la práctica, y si es lo que se quiere corresponde revisar la condición de pago, no la tolerancia.

**`requiereAprobacionCredito`.** «Sujeto a aprobación»: toda venta a crédito pasa por la bandeja, esté o no dentro del límite. Es distinto de no tener cupo — **es no tener autonomía** — y por eso es una bandera propia y no un límite en cero.

## Los dos campos hacen algo

Es la parte que evita que sean decorativos:

- **El pedido** manda a la bandeja de aprobación a un cliente marcado como sujeto a aprobación, aunque le sobre cupo.
- **La cobranza** calcula los días vencidos con la gracia de cada cliente. Se calcula **en un solo lugar** de la pantalla: dos cálculos distintos es cómo la tabla y el resumen terminan diciendo cosas diferentes. Una guardia comprueba las dos cosas.

## El comportamiento de pago

Sale del historial real: cuántas facturas cerró, cuántas pagó fuera de plazo, el atraso promedio y el máximo.

Dos decisiones del cálculo:

- **Solo cuenta facturas cerradas.** Una pendiente todavía no dice si se pagó tarde, y meterla como «0 días de atraso» mejoraría el promedio de quien simplemente no ha pagado.
- **El promedio va sobre todas las cerradas, no solo sobre las tardías.** El promedio de las tardías diría «paga 20 días tarde» de quien pagó puntual 19 de 20 veces.

La fecha de cancelación **no se guarda**: es la del último cobro de esa factura. Derivarla evita un campo más que mantener en sintonía.

## El cupo disponible

`creditoDisponible` devuelve `null` cuando el cliente no tiene tope —el estado heredado—, porque «disponible» no significa nada sin techo y devolver un número grande invitaría a compararlo. Puede ser negativo: ya se pasó del límite, y esconderlo sería peor que mostrarlo.

## El responsable de cobranza ya existía

No se agregó un campo: los contactos ya distinguen quién atiende cobranza, y la ficha muestra a quién le corresponde reclamar. Si nadie está designado, lo dice.
