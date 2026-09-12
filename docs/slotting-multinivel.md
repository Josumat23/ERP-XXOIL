# Slotting multi-nivel: pasillo → rack → nivel

Cierra el último pendiente que quedaba sobre `ZonaAlmacen` en el Blueprint 05: *slotting multi-nivel (pasillo/rack/nivel). `SaldoZona` resolvió la cantidad por zona, no la jerarquía de ubicaciones.*

## Qué resuelve

`SaldoZona` ya permitía tener un ítem repartido en varias zonas del mismo almacén. Lo que faltaba era poder **organizar esas zonas**: un almacén con cuarenta posiciones planas en una lista es tan difícil de recorrer como uno sin zonas.

`ZonaAlmacen.parentId` da la jerarquía, con la misma forma que `UbicacionTecnica` y `CentroCosto` ya usaban en este repo.

## Decisiones

**El código sigue siendo único por almacén, sin importar el nivel.** Una etiqueta pegada en un estante debe identificar **una sola** ubicación; si `N1` pudiera existir bajo dos racks distintos, leer la etiqueta no diría dónde está uno parado.

**`onDelete: Restrict` hacia el padre.** Desarmar un pasillo que todavía tiene racks debajo tiene que ser un acto deliberado, no un efecto colateral de borrar una fila.

**La zona superior se valida contra el mismo almacén.** El id llega del navegador: colgar un rack de un pasillo de otro almacén dejaría una ubicación imposible de recorrer físicamente. El formulario solo ofrece zonas del almacén elegido y el servidor lo vuelve a verificar.

**El stock no se migra.** Las zonas que ya existían quedaron como raíces con su stock, y `SaldoZona` sigue guardando la cantidad en la zona concreta. Nada obliga a que el stock viva solo en las hojas: forzarlo habría exigido mover saldos, que es exactamente lo que el diseño de `SaldoZona` evita.

## Lo propio y lo del subárbol, siempre juntos

Esa última decisión tiene una consecuencia que había que resolver bien: si un pasillo tiene un ítem suelto en el piso y once repartidos en sus racks, mostrar solo "12" esconde justo el dato que hace falta para ordenar el almacén.

Por eso la columna muestra los dos números:

```
A-01      Producto terminado   1 (3 con subzonas)
└ RACK-2  Rack 2               0 (2 con subzonas)
  └ N1    Nivel bajo           1
  └ N2    Nivel alto           1
```

Se cuentan **ítems distintos, no unidades**: sumar litros de aceite con unidades de balde daría un número sin significado. Lo que el encargado necesita al mirar el árbol es qué está ocupado y qué está libre.

## Verificación

**8 pruebas** (219 en total). Las puras: subárbol, prevención de ciclos, ruta legible (`PASILLO-A › RACK-1 › N2`), nivel, orden de árbol con hermanos por código, y el acumulado propio/subárbol con una zona vacía devolviendo `0` y no `undefined`.

**Datos con ciclo no cuelgan el recorrido y siguen apareciendo en pantalla** — una zona invisible es peor que una mal ordenada.

Sobre base efímera: una zona cuelga de otra del mismo almacén y la ruta se arma; el código repetido en otro nivel se rechaza; **borrar un pasillo con racks debajo se rechaza**; y el stock sigue en la zona concreta — la jerarquía no lo mueve.

**Navegador**: el árbol de arriba es el render real de la pantalla de Almacenes, con la sangría y los dos contadores.

## Lo que no hace

- **No hay reglas de slotting automático.** Qué ítem va en qué posición —por rotación, por peso, por compatibilidad química— es criterio del negocio y no se inventa.
- **No hay tareas de picking ni oleadas.** Siguen condicionadas al volumen de despacho, que es la pregunta abierta que ya venía con `SaldoZona`.
- **No se impide poner stock en una zona con subzonas.** Se muestra por separado, que es lo que permite detectarlo y corregirlo; prohibirlo habría roto los datos existentes.
