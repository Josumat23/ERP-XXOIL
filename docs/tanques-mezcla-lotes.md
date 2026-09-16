# Tanques: trazabilidad cuando los lotes se mezclan

**2026-09-16.** La base lubricante llega en cisterna y se descarga sobre el remanente de la recepción anterior. Desde ese momento los lotes están **mezclados**: ningún kilo que salga de ahí se puede atribuir a una sola recepción. Es un hecho físico, no una limitación del sistema.

Hasta hoy el sistema no tenía dónde representarlo, y eso producía el peor de los resultados posibles — que se explica más abajo.

Lo que llega **envasado** (cilindro, IBC) no pasa por acá: cada envase conserva su lote y la trazabilidad existente ya alcanza. El negocio confirmó el 2026-09-16 que se reciben **las dos formas**.

## Qué hacen los ERP grandes, y por qué está mal

**SAP** mantiene los lotes como stocks separados dentro de la misma ubicación y al consumir **obliga a elegir uno**. El registro queda diciendo «esto salió del lote A» cuando físicamente salió de una mezcla.

Eso es peor que no tener trazabilidad: es una **respuesta equivocada con aire de certeza**. El día de un reclamo manda a revisar el lote que no era, y a dar por buenos los que sí participaron. Para modelarlo de verdad hace falta la gestión de silos de su solución de petróleo, que se vende aparte. **Epicor** directamente no lo modela.

## Cómo se modela acá

El consumo se reparte **en proporción** a lo que cada recepción aporta al tanque en ese momento.

```
Tanque con 6.000 kg del lote A y 4.000 del lote B
Consumo de 1.000 kg  →  600 kg de A  +  400 kg de B
```

Dos asignaciones, no una inventada.

**La cadena de trazabilidad no cambia de forma: cambia de cardinalidad.** Sigue siendo `LoteGranel → AsignacionLoteInsumo → RecepcionCompraDetalle → lote del proveedor`; lo único que pasa es que un consumo desde tanque genera varias asignaciones en vez de una. Las consultas de recall que ya existían siguen funcionando sin tocar una línea, y ahora además responden **con qué porcentaje** participó cada lote.

## El modelo

| Modelo | Para qué |
| --- | --- |
| `Tanque` | almacén, insumo que contiene, capacidad, contenido actual |
| `AporteTanque` | qué recepción aporta cuánto: `cantidadKg` (lo que queda) y `cantidadInicialKg` (lo que entró) |

**Un tanque contiene un solo insumo.** Mezclar productos distintos no es un caso a soportar: es un incidente, y el sistema no debe ayudar a provocarlo — descargar otro insumo se rechaza.

**`cantidadInicialKg` se conserva aparte de lo que queda**, y no es redundante: la proporción de hoy no es la de ayer. Sin ese dato no se puede reconstruir la mezcla de un despacho pasado, que es justo lo que hace falta el día de un reclamo.

## El defecto más silencioso, y el que más costaba ver

`asignarLoteInsumo` consumía FIFO de las recepciones con saldo suelto. Una base descargada en tanque tiene **`cantidadDisponible = 0`** — el saldo se movió al tanque — así que el FIFO no encontraba nada y el consumo quedaba **sin trazar**, amparado en un comentario que decía «best-effort, no es un error».

Es decir: el insumo donde la trazabilidad más importa, porque es el que llega a granel, habría sido justamente el único sin trazar. Y sin un error, sin un aviso.

Ahora, cuando el saldo suelto se agota, el consumo continúa **desde los tanques del mismo insumo**. El orden importa y está fijado con una prueba: primero lo suelto, después el tanque — **sin tanques, el comportamiento es idéntico al de siempre**.

## Las dos reglas que protegen los kilos

**El reparto suma exactamente lo pedido.** No es un detalle de presentación: cada kilo repartido descuenta de la disponibilidad de una recepción, así que un reparto que suma de menos deja stock fantasma y uno que suma de más sobregira un lote. El resto del redondeo se asigna al aporte más grande, que es el que mejor lo absorbe, y ningún aporte puede repartir más de lo que tiene.

**El total declarado se puede contrastar contra su detalle.** `Tanque.contenidoKg` se mantiene para no recalcularlo en cada consulta de stock, y eso lo vuelve un dato que puede desincronizarse. `contenidoRealTanque()` existe para comprobarlo — un total que nadie contrasta contra su detalle es un total en el que no se puede confiar.

## Lo que se ve en pantalla

`/inventario/tanques` lista los tanques con contenido, capacidad y cuántos lotes hay en la mezcla. La ficha muestra la **composición actual**:

| Recepción | Lote del proveedor | Ingresó (kg) | Queda (kg) | % de la mezcla |
| --- | --- | --- | --- | --- |
| RC-00001 | LP-2026-A | 300,00 | 300,00 | 60,00 % |
| RC-00001 | LP-2026-B | 200,00 | 200,00 | 40,00 % |

Verificado en el navegador contra la base demo: las dos descargas, la composición resultante, y la suma de aportes cuadrando contra el contenido declarado.

## Lo que NO hace

**No corrige el volumen por temperatura.** El contenido se lleva en kilogramos. Convertir a volumen necesita la densidad, que ya existe (`docs/densidad-masa-volumen.md`), y corregir por temperatura necesitaría el coeficiente de expansión del producto — que no está en el sistema y que nadie pidió.

**No modela la medición física del tanque.** El contenido es el que resulta de las descargas y los consumos registrados, no el de una regla o un sensor. Contrastarlo contra una medición real sería un conteo cíclico de tanque, y es otro trabajo.

## Dónde mirar

- `src/lib/tanques.ts` — el reparto proporcional, puro y probado.
- `src/lib/tanquesServicio.ts` — descargar y consumir contra la base, dentro de una transacción.
- `src/lib/trazabilidad.ts` — dónde el consumo de producción continúa hacia los tanques.
- `tests/tanques.test.ts` y `tests/tanques-persistencia.test.ts` — 20 pruebas.
