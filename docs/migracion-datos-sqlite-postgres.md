# Traer los datos de SQLite a PostgreSQL

**2026-09-16.** El proyecto cambió de motor el 15 de septiembre y `erp_dev` arrancó vacía: los datos de trabajo quedaron en `local.db`. Este documento dice cómo se movieron y, sobre todo, **qué podía salir mal sin que nadie se enterara**.

## Qué se movió

**2.677 filas en 59 tablas**, verificadas valor por valor: 19.220 comparaciones.

| | |
| --- | --- |
| Catálogo UBIGEO | 1.834 |
| Asientos contables | 95, con 210 detalles |
| Facturas | 19 |
| Pedidos | 22, con 22 detalles |
| Movimientos de kardex | 56 |
| Depreciaciones | 49 |
| Clientes | 5 |

Cotejado contra el negocio y no solo contra el script: los totales coinciden — 19 facturas por S/ 3.557,70 en los dos motores, 210 líneas de asiento sumando S/ 41.767,16.

**No se movió `tareas_programadas`** (75 filas). Es la bitácora de cuándo corrió el planificador, y `erp_dev` genera la suya desde que el servidor arranca. Mezclar dos bitácoras de dos bases distintas enreda la cronología y no aporta nada; además, copiarla habría exigido borrar las filas que el destino ya tenía, que es una operación destructiva para recuperar un registro que a nadie le importa.

## Por qué no es un `INSERT ... SELECT`

Los dos esquemas son **el mismo**: 173 tablas, cero diferencias de columnas, medido antes de tocar nada. Y aun así copiar filas directamente habría corrompido los datos, porque los motores guardan los valores distinto y **ninguna de esas diferencias falla al escribir**. Salen bien y quedan mal.

### 1. Los booleanos

SQLite no tiene booleanos: guarda `0` y `1`. PostgreSQL espera `false` y `true`. Son 82 columnas.

### 2. Los decimales

Viajan como **texto** y no como número de JS, para que el paso por un `double` no cambie un importe. Son 294 columnas.

### 3. Las fechas — la que de verdad importa

SQLite guarda `"2026-09-14T14:19:36.992+00:00"`. Las columnas de PostgreSQL son `timestamp without time zone`.

Si se pasa un `Date` de JavaScript, **el driver lo serializa en la zona horaria de la máquina**. En Perú (UTC−5) eso corre la fecha cinco horas. Son 761 fechas: facturas emitidas cinco horas antes, asientos contables cayendo en otro día. Sin un error, sin una excepción, sin una línea en el log.

Por eso cada fecha se escribe como hora UTC explícita:

```js
new Date(valor).toISOString().replace("T", " ").replace("Z", "")
// "2026-09-14 14:19:36.992"
```

**Esto no es una precaución teórica: se midió.** Se reintrodujo el defecto a propósito y la verificación lo detectó con una diferencia de exactamente 18.000.000 ms — cinco horas — en cada una de las 761 fechas.

## Cómo se verifica

Dos cosas hacen que la migración se pueda creer.

**Todo pasa dentro de una transacción.** Si la verificación encuentra una sola diferencia, se deshace entera. Una migración a medias es peor que ninguna, porque deja la base con datos que *parecen* completos.

**Se comparan todos los valores, no una muestra.** Al terminar de insertar, y antes de confirmar, se traen todas las filas de vuelta y se comparan contra el origen: 19.220 valores. Las diferencias que importan no fallan al escribir, así que la única forma de saber que los datos llegaron bien es traerlos de vuelta y mirarlos.

Después se comprobó además **a través de Prisma**, que es el camino que usa la aplicación de verdad:

```
F001-00000001  2025-10-08T15:00:00.000+00:00 -> 2025-10-08T15:00:00.000Z  | 29.5 -> 29.5
```

## El comando

```bash
node scripts/migrar-datos.mjs --desde local.db --excepto tareas_programadas --simular
node scripts/migrar-datos.mjs --desde local.db --excepto tareas_programadas
```

- `--simular` hace **exactamente el mismo trabajo** —inserta, comprueba las claves foráneas, valida los enums, verifica— y termina con `ROLLBACK`. Un ensayo que no ejerce las mismas escrituras no ensaya nada.
- `--desde` no tiene valor por defecto, a propósito: adivinar qué base leer es como se termina copiando la equivocada.
- Se niega si el destino ya tiene datos, salvo `--forzar`. Copiar encima duplicaría filas o chocaría contra los índices únicos.
- `--excepto` saltea tablas sin tocarlas ni exigir que estén vacías.

El orden de carga sale de las **357 claves foráneas del propio PostgreSQL**, no de una lista escrita a mano: se ordenan las tablas topológicamente y se comprueba que no haya ciclos. Las 7 auto-referencias —una ubicación con ubicación padre, un empleado con jefe— se insertan en `NULL` y se completan al final, cuando todas las filas ya existen.

## Qué queda

`local.db` **no se tocó**: se abre en solo lectura y sigue donde estaba, con su respaldo verificado en `D:\Escritorio\ERP-respaldos`. Conviene conservarlo hasta haber usado `erp_dev` lo suficiente como para confiar en ella.
