# Cuadre de inventario: la pregunta al revés

```
npm run cuadre:inventario
npm run cuadre:inventario -- --base=erp_demo
```

Es de **solo lectura**. No escribe, no corrige y no crea bases: por eso apunta a la base configurada en `DATABASE_URL`, que es justamente la que interesa auditar. `fugas:entre-empresas` y el runner de pruebas se fijan su propia base porque **ellos sí escriben**; este no.

## Qué faltaba

La cantidad de un ítem vive en tres niveles a la vez, y eso es deliberado:

| Nivel | Dónde |
| --- | --- |
| Agregado de toda la compañía | `Insumo.stock` / `Presentacion.stock` |
| Por almacén | `SaldoAlmacen.cantidad` |
| Por zona dentro del almacén | `SaldoZona.cantidad` |

`registrarMovimiento` (`src/lib/inventario.ts`) los mantiene sincronizados en una sola transacción, con cerrojo optimista en cada nivel. Está bien hecho, y el propio archivo lo documenta en su línea 113.

Lo que no existía era la pregunta al revés: **¿siguen cuadrando?**

Las pruebas verifican valores después de operaciones concretas. Eso no detecta el descuadre que **ya ocurrió** —por una transacción interrumpida, por una escritura directa a la base, por una fila de `SaldoAlmacen` duplicada— porque para verlo hay que mirar los datos que hay, no los que una prueba acaba de crear. Comprobar un invariante en los datos y comprobarlo en un caso de prueba no son lo mismo, y hasta ahora solo existía lo segundo.

## Las cuatro invariantes

Tres son igualdades y una es desigualdad. Viven en `src/lib/cuadreInventario.ts` como funciones puras, sin Prisma, para poder sembrarles un descuadre en una prueba.

**1. El agregado del maestro es la suma de sus almacenes.** Un ítem sin ninguna fila de saldo cuenta como cero, no se omite: el caso que más importa es el maestro que dice 40 cuando no hay saldo en ningún almacén.

**2. El saldo del almacén es el que dejó el último movimiento del kardex.** `registrarMovimiento` escribe `saldoNuevo` y actualiza `SaldoAlmacen` a ese mismo valor en la misma transacción. Si divergen, alguien movió el saldo sin pasar por el kardex — y entonces `/inventario/valorizacion`, que se apoya en el costo congelado del movimiento, está valuando una cantidad que ya no existe. Un almacén con saldo y sin ningún movimiento también cuenta: ese saldo no pudo nacer sin kardex.

**3. Lo repartido en zonas no supera el saldo del almacén.** Desigualdad, no igualdad, y así está documentado en `docs/particion-stock-por-zona.md`:

```
saldoAlmacen = suma(saldoZona) + sinZona
```

`sinZona` es derivado, no almacenado. La suma de zonas **puede** ser menor; lo que no puede es ser mayor, porque eso es stock contado dos veces.

**4. Una sola fila de saldo por (almacén, ítem).** `SaldoAlmacen` lleva `@@unique([almacenId, tipoItem, presentacionId, insumoId])` con dos columnas nuleables, y **tanto SQLite como PostgreSQL consideran dos NULL distintos**: la clave no impide la fila duplicada. Hoy lo evita un cerrojo en la aplicación, que es exactamente la clase de garantía que conviene comprobar en los datos en vez de confiarle. `SaldoZona` no tiene el problema porque lleva `itemId` no nuleable — se corrigió al crearla, y está contado en `docs/particion-stock-por-zona.md`.

Los duplicados se informan **primero**, porque son causa de los descuadres de la invariante 1: una fila repetida hace que el almacén se cuente dos veces. Leer la causa antes que el síntoma ahorra el viaje en falso.

## Capaz de fallar

Un detector que nadie vio fallar no es un detector. `tests/cuadre-inventario.test.ts` siembra **un descuadre por invariante** y comprueba que cada uno se reporta: el maestro adelantado, el saldo movido sin kardex, el almacén con saldo y sin movimientos, las zonas pasadas de rosca, la fila duplicada. Y las dos que tienen que quedarse calladas: las zonas sumando menos que el almacén (eso es `sinZona`), y la fila en cero sin movimientos (eso es una salida que consumió todo).

También está fijada la tolerancia. Es `1e-6` y **no es holgura de negocio**: es el error de punto flotante de sumar `Decimal` como `number`. La prueba verifica las dos direcciones — que `0.1 + 0.2` contra `0.3` no dispare, y que un gramo de diferencia sí.

## El valor contra la cuenta contable se INFORMA, no se aprueba

Aquí hay una decisión que conviene entender antes de leer la salida.

Las cuatro invariantes de arriba **tienen que valer**: un descuadre de cantidad es un defecto y el script termina en rojo. El valor del inventario contra el saldo de su cuenta contable **no**, y decir lo contrario sería vender una comprobación condenada a estar siempre en rojo. Dos razones, las dos ya documentadas:

1. `postearAsiento()` es best-effort **a propósito** (`docs/incidencias-contables.md`): si falta el control contable o el período está cerrado, la operación comercial sigue y el fallo queda en `IncidenciaContable`. El auxiliar puede adelantarse al mayor por diseño.
2. Los movimientos anteriores a la implantación del costo congelado valen cero en la valorización (`docs/valorizacion-inventario.md`), y no se les aplica el costo actual porque eso falsearía un cierre pasado.

Así que el informe da la diferencia y lista las causas **candidatas**. Candidatas, no explicaciones.

> **La primera versión se equivocó justo acá.** Marcaba la diferencia como «ya explicada» en cuanto hubiera un solo ítem sin costo congelado. Corrida contra la base de trabajo informó 32,486 de diferencia con «causa conocida: 1 ítem sin costo» — y un ítem no explica treinta y dos mil. Un detector que invita a descartar lo que acaba de encontrar es peor que no tenerlo. Es la misma trampa que los 118 agujeros inventados de `pantallas:por-rol`, en la dirección contraria: ahí el error era acusar de más, acá era absolver de más.

Lo único que el informe sí afirma sin rodeos es el **signo**: una cuenta de inventario es de activo, y un saldo negativo no lo explica ningún desfase de posteo.

## Lo que encontró la primera corrida

Contra `erp_dev`, 11 ítems, 2 almacenes, 63 movimientos:

```
✔ Cantidad: las cuatro invariantes cuadran.
· Valor INVENTARIO_PT (cuenta 2111): inventario 1,892.86 vs cuenta -854.69 → diferencia 2,747.55
     ! la cuenta de inventario es de activo y su saldo es NEGATIVO
· Valor INVENTARIO_INSUMOS (cuenta 2411): inventario 37,969.81 vs cuenta 5,483.45 → diferencia 32,486.36
```

La cantidad cuadra, que es la noticia: los tres niveles están sincronizados y no hay filas duplicadas.

La diferencia de valor **tiene causa, y no es un defecto del posteo.** Desglosando la cuenta por origen del asiento:

| Cuenta | Origen | Asientos | Debe | Haber |
| --- | --- | --- | --- | --- |
| 2111 | VENTA | 19 | 0 | 854.69 |
| 2411 | COMPRA | 7 | 6,785.00 | 0 |
| 2411 | INICIO_PRODUCCION | 2 | 0 | 1,301.55 |

En 2111 **solo hay cargos de venta y ningún abono de envasado**: no existe un solo asiento de origen `ENVASADO` en la base. El producto terminado sale cuando se vende y nunca entró contablemente, de ahí el saldo negativo.

El motivo es `prisma/seed-demo.ts`: tiene **7 escrituras de stock y cero asientos contables**. El sembrador crea inventario sin su contrapartida. Después los flujos reales —ventas— acreditan contra un stock que nunca se cargó.

**Consecuencia práctica, y conviene decirla fuerte: contra una base sembrada esta comparación de valor va a mostrar diferencia siempre.** No es un hallazgo, es una propiedad de la base. Contra una base construida solo por la aplicación debería cuadrar salvo incidencias de posteo.

## Lo que esto NO hace

- **No corrige.** Ni recalcula el agregado, ni borra la fila duplicada, ni postea el asiento que falta. Un corrector que se equivoca en una base de inventario hace más daño que el descuadre; primero hay que ver cuántos y de qué forma son.
- **No corre en `npm test`.** No puede: las pruebas usan una base efímera que acaban de crear, así que ahí el cuadre siempre pasaría y no diría nada de la base real. Lo que sí corre en la suite es la comprobación de que **el detector detecta**, que es la mitad que se puede probar sin datos reales.
- **No mira saldos huérfanos.** Una fila de `SaldoAlmacen` de un ítem de otra compañía colgada de un almacén de esta aparecería como descuadre de la invariante 2, pero sin nombrar lo que es. Queda como extensión obvia si alguna vez aparece una.

## Pendiente que esto deja servido

Que `prisma/seed-demo.ts` postee la contrapartida contable del stock que siembra. Hoy la base de demostración nace con el mayor incoherente respecto a su propio inventario, y eso le quita filo a cualquier revisión contable hecha sobre ella. No se hizo acá porque toca el sembrador y `npm run semillas:desde-cero`, que es otro cambio con su propia verificación.
