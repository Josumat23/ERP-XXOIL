# Las ocho pantallas que se podían abrir y no se podían estrenar

Cotizaciones, hojas de ruta, conteo cíclico, RFQ, acuerdos de suministro, órdenes internas, conciliación bancaria y proyectos de inversión estaban en **cero** en la demo. La pantalla cargaba, decía «no hay registros» y ahí terminaba.

## No es una fila por tabla

Cada una existe para contestar algo, y una fila sola no alcanza para contestarlo. Lo que se sembró es el **caso**:

| pantalla | el caso que hacía falta |
|---|---|
| Cotizaciones y embudo | cinco, en cuatro estados distintos y con distinta probabilidad. Con todas en el mismo estado no hay embudo. Una llega hasta el final: se convierte en pedido y **reserva stock**, como la acción real. |
| Hojas de ruta | una planificada y una **cerrada con resultados**. La cerrada es la que enseña para qué sirve el campo «resultado». |
| RFQ | uno abierto **con dos ofertas** —la más barata no es la de menor plazo, para que la comparación tenga algo que decidir— y uno adjudicado con su orden de compra. |
| Acuerdos de suministro | uno **liberado en parte**: lo que la pantalla muestra es el saldo contractual, y con cero liberado no hay saldo que mirar. La liberación genera su orden de compra contra el contrato. |
| Órdenes internas | una abierta acumulando costos y una ya liquidada. Son dos pantallas del mismo registro. La liquidada **se pasó del presupuesto** (5 600 contra 5 000), que es lo que la pantalla marca. |
| Conciliación bancaria | un extracto donde **dos líneas no concilian** —una comisión y un ITF que el libro no tiene—. Una conciliación donde todo cuadra no enseña nada. |
| Proyectos | uno en progreso con EDT de dos niveles, actividades en tres estados y **costos reales cargados**: sin ellos la columna «costo real» sale en cero y no se puede comparar contra el presupuesto. |
| Conteo cíclico | un conteo que **encuentra una diferencia** y genera su ajuste de kardex. Un conteo donde todo cuadra no prueba nada. |

## Lo que el dato de prueba no puede esquivar

Dos reglas del sistema que un sembrador descuidado rompe sin enterarse, porque escribe la fila directamente en vez de pasar por la operación:

**Quien solicita un RFQ no puede adjudicarlo.** El RFQ adjudicado lo pide Almacén y lo adjudica Gerencia. Si el dato de prueba no cumpliera esa regla, la pantalla mostraría una adjudicación que la aplicación nunca habría aceptado.

**Un conteo con diferencia mueve stock.** El conteo llama a `registrarMovimiento`, la misma función del dominio que usa la acción real, en vez de escribir el detalle y quedarse ahí. Un conteo con diferencia y sin ajuste es un inventario que ninguna operación real puede producir.

Por la misma razón la cotización convertida **reserva** las unidades, y se comprueba el stock libre antes de hacerlo para no dejar a la demo con inventario comprometido que nadie pidió.

## Una guarda que se cumplía por casualidad

Al correr las semillas desde cero, un caso que llevaba ciclos en verde se puso en rojo:

```
✖ ninguna presentación quedó con stock reservado después de despachar (Balde 35 lb: 12)
```

No era un defecto del dato nuevo. Esas 12 unidades son la reserva de la cotización convertida, que está **bien**: un pedido pendiente reserva stock, para eso existe la reserva.

La guarda decía «después de despachar» y comprobaba «no hay ninguna reserva, punto». Eso se cumplía únicamente porque la demo no tenía **ningún pedido pendiente**; en cuanto tuvo el primero, se puso en rojo sobre un dato correcto. Comprobaba «no hay reservas» creyendo comprobar «no hay reservas huérfanas».

Ahora compara lo reservado contra lo que los pedidos vivos justifican, y sigue detectando lo que decía detectar. Inflando a mano la reserva de una presentación:

```
✖ el stock reservado corresponde a pedidos vivos, sin reservas huérfanas
  (Balde 35 lb: 19 reservado, 12 pedido)
```

Para un pedido `PARCIAL` la comparación suma la cantidad original y no el saldo, así que queda del lado laxo: puede dejar pasar una reserva de menos, nunca inventar una huérfana que no existe.

## Que lo sembrado se vea en pantalla

Tener filas en la tabla no es lo mismo que verlas. Las nueve pantallas —las ocho más el embudo— se pidieron por HTTP contra la demo y todas muestran lo sembrado.

Y la contraprueba, para descartar que la marca venga del armazón y no de los datos: **las mismas nueve con la segunda compañía activa**, que no tiene nada de esto, siguen vacías. Si un código apareciera igual, no vendría de la base.

## Los casos quedan comprobados

`npm run semillas:desde-cero` construye una base vacía, corre los ocho sembradores y verifica **49 casos**, diecisiete de ellos nuevos. Los dos sembradores se corren dos veces para exigirles que sean idempotentes: si el segundo pase escribiera algo, se ve.

## Todo es inventado

Razones sociales, precios, plazos, bancos, números de cuenta e importes son datos de prueba. No salen de ningún dato real de XXOIL.
