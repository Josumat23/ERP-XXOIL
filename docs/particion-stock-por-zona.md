# Partición de stock por zona (ítem 0.4)

Hasta ahora la ubicación de un ítem dentro de un almacén era un **puntero único**: `Presentacion.zonaAlmacenId` / `Insumo.zonaAlmacenId`. Un ítem estaba en una zona, y punto. No se podía representar algo tan común como "300 baldes en el rack de producto terminado y 200 en materia prima".

## El modelo

`SaldoZona` guarda la cantidad por combinación zona + ítem. Es una capa **aditiva** sobre `SaldoAlmacen`, no un reemplazo:

```
saldoAlmacen = suma(saldoZona) + sinZona
```

`sinZona` es **derivado, no almacenado**: lo que todavía no se repartió. Así la suma siempre cuadra con el saldo del almacén, y desactivar la partición es volver a leer solo `SaldoAlmacen` — sin migrar ni perder nada, que es el rollback que pedía el roadmap.

### Por qué el kardex no conoce zonas

Hacer que cada entrada, salida y traslado eligiera zona habría tocado el módulo que más historia inmutable maneja, con el riesgo que eso implica. En cambio, repartir por zona es una operación aparte que **nunca altera el saldo del almacén** y **no genera movimiento de kardex**: inventar entradas y salidas para un cambio de estante ensuciaría la historia de costos con ruido que no es un movimiento real.

### La clave única que sí funciona

`SaldoAlmacen` usa `@@unique([almacenId, tipoItem, presentacionId, insumoId])`, con dos columnas nuleables. **En SQLite dos `NULL` se consideran distintos**, así que esa clave no impide filas duplicadas — el propio código lo rodea tomando un cerrojo sobre el stock agregado del ítem.

Se descubrió al escribir la prueba: la aserción de duplicado no fallaba. Como `SaldoZona` es tabla nueva, se evitó el problema en lugar de heredarlo: lleva `itemId`, una copia **no nuleable** del id del ítem, y la clave es `@@unique([zonaAlmacenId, itemId])`. Con `SaldoZona` duplicada la cantidad de una zona se contaría dos veces, así que aquí la garantía tenía que ser real.

## La zona principal pasa a ser derivada

`zonaPrincipal()` devuelve la zona con más cantidad, con desempate por id para que no dependa del orden en que la base devolvió las filas. Los punteros `zonaAlmacenId` de la ficha se conservan —el cambio es aditivo— pero dejan de ser la verdad sobre dónde está el stock: pasan a ser una etiqueta de referencia, y la pantalla lo dice.

## Dónde se ve

**Inventario → Traslados**, sección "Repartir stock entre zonas del mismo almacén": muestra el reparto actual del ítem (cantidad por zona más lo que está sin asignar y el total del almacén) y permite mover cantidad entre zonas, o desde el stock sin asignar hacia una zona.

La acción autentica, autoriza, valida la entrada y relee almacén, zonas e ítem acotados a la compañía activa. La escritura usa reclamo optimista sobre la cantidad leída: si otra sesión movió la misma zona entremedio, no se aplica y el usuario reintenta.

## Verificación

`tests/saldos-zona.test.ts` cubre las funciones puras (reparto, remanente, datos inconsistentes que no producen un "sin zona" negativo, validación del movimiento con sus cuatro rechazos, zona principal con desempate) y un escenario sobre base efímera donde un ítem queda en dos zonas y el total del almacén no cambia al moverlo.

Recorrido en navegador sobre la base demo, con un insumo de 1.904 unidades:

| Paso | Reparto | Total |
| --- | --- | --- |
| Inicial | todo sin zona | 1.904 |
| Mover 500 a MP-01 | MP-01: 500 · sin zona: 1.404 | 1.904 |
| Mover 300 de MP-01 a A-01 | MP-01: 200 · A-01: 300 · sin zona: 1.404 | 1.904 |
| Intentar mover 999 desde MP-01 | rechazado: *"La zona de origen no tiene esa cantidad disponible"* | 1.904 |

El total del almacén no cambió en ningún paso, que es la garantía central del diseño.

## Lo que no incluye

Picking, oleadas y unidades de manejo (EWM) siguen fuera: el roadmap los condiciona al volumen real de despacho, que es un dato del negocio. Esta partición es la base sobre la que se construirían.
