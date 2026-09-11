# MRP por planta

Hasta ahora el MRP planificaba siempre para la compañía completa: neteaba la demanda contra el **stock agregado** (`Presentacion.stock`, `Insumo.stock`) y tomaba **todos** los pedidos firmes, sin importar de qué planta salieran. La orden de compra que generaba nacía sin almacén de destino.

## El supuesto, dicho antes que nada

**Una planta es un almacén de tipo `PLANTA`.** Es el modelo que existe hoy: el roadmap dejó el modelo `Planta` separado —con almacenes subordinados— condicionado a que el negocio confirme que una planta puede tener varios. Mientras eso no se confirme, planta y almacén son la misma cosa, y el MRP por planta se apoya en esa equivalencia.

Si mañana una planta agrupa varios almacenes, lo que cambia es de dónde sale el stock de la planta: hoy es `SaldoAlmacen` de ese almacén, sería la suma de sus almacenes subordinados. El resto del cálculo no se toca.

## Qué cambia al elegir una planta

| Dimensión | Toda la compañía | Una planta |
| --- | --- | --- |
| Stock de presentaciones | `Presentacion.stock` (agregado) | `SaldoAlmacen` de esa planta |
| Stock de insumos | `Insumo.stock` (agregado) | `SaldoAlmacen` de esa planta |
| Pedidos firmes | todos | solo los de esa planta |
| Capacidad h-h | suma de todas las plantas | la de esa planta |
| Pronóstico | se usa | **se excluye** |
| Almacén destino de la OC generada | ninguno | la planta elegida |

Un ítem **sin saldo en esa planta cuenta como cero**, no como el stock total de la compañía. Es la diferencia entre planificar por planta y ponerle una etiqueta de planta a un cálculo global.

## Por qué el pronóstico queda fuera

`Proyeccion` no tiene dimensión de planta: proyecta ventas por presentación para toda la compañía. Repartir esa cifra entre plantas exige un criterio de asignación —por capacidad instalada, por historia de despacho, por zona comercial— y **eso es una decisión del negocio, no del sistema**.

Suponer uno daría un número plausible y equivocado, que es peor que no darlo: nadie audita un número que parece razonable. Así que al planificar por planta el MRP trabaja solo con **demanda firme**, y la pantalla lo dice en un aviso permanente, no en una nota al pie.

Para planificar con pronóstico está la opción "Toda la compañía", que es además el comportamiento por defecto: el cambio es aditivo y nada de lo que ya funcionaba cambió.

## Verificación

`tests/mrp-por-planta.test.ts` arma una compañía con **dos plantas**, el mismo producto con stock repartido de forma desigual (90 en Norte, 10 en Sur, 100 agregado) y un pedido firme de 50 unidades **solo en Sur**:

- **Toda la compañía**: las 100 unidades agregadas cubren el pedido → no hay que producir nada.
- **Planta Sur**: allí solo hay 10 → faltan 40 unidades → 400 kg de granel → 400 kg de insumo.
- **Planta Norte**: no tiene demanda firme → no necesita nada, aunque sea la que más stock tiene.

Es el caso que distingue las dos lecturas: con el stock agregado el resultado es "no hace falta comprar", y es falso para la planta que tiene que despachar.

Una segunda prueba fija que un pronóstico de 500 unidades planifica producción a nivel compañía y queda en **0** al planificar por planta, y una tercera falla si el aviso desaparece de la pantalla.

Recorrido en navegador: el selector lista las plantas de la compañía activa, el aviso aparece solo al elegir una, y la vista por defecto queda idéntica.

## Lo que sigue abierto

- **Reparto del pronóstico entre plantas.** Necesita el criterio de asignación del negocio.
- **Planta con varios almacenes subordinados.** Pregunta abierta 2 del Blueprint 10.
