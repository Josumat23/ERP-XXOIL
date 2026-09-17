# Encontrar el material en la pantalla de trazabilidad

La pantalla se construyó con dos listas desplegables: una con **todos** los lotes de la historia y otra con las últimas 200 recepciones. Con los datos de hoy —cinco lotes, siete recepciones— funciona perfecto. Con volumen real, buscar en una lista de miles es imposible, y el día de un recall es cuando menos tiempo hay.

## Se busca por el dato con el que llaman

| Campo | Por qué |
| --- | --- |
| **Lote del proveedor** | Es con el que llama quien reporta el problema, y **el único que no se puede deducir de los demás** |
| Código y nombre del insumo | Lo que uno recuerda |
| Número de recepción | Si ya se tiene el documento a la vista |

Y el selector de lotes granel, que no tenía filtro **ni tope**, ahora tiene los dos: se filtra por código de lote o nombre de producto.

La búsqueda pasa por `contiene()`, no por `contains` directo: en PostgreSQL `contains` distingue mayúsculas, y quien atiende la llamada escribe en minúsculas. Hay una prueba que lo fija contra la base, buscando en minúsculas un lote guardado en mayúsculas.

## Las listas dicen cuánto muestran

Un selector acotado **sin decirlo** es peor que uno largo: quien no encuentra su lote concluye que no existe, y el día de un recall esa conclusión es cara.

- Sin filtro y con más de 50: «Se muestran los 50 más recientes de N. Use el filtro para encontrar el resto.»
- Con filtro y resultados: «1 de 3 materiales consumidos coinciden con «aceite».»
- Con filtro y sin resultados: «Ningún resultado para «prov-nb» entre los 3 materiales consumidos.»

## Un defecto que apareció al verificar

Al buscar algo que no existe salían **dos mensajes contradictorios**:

> Ningún resultado para «prov-nb» entre los 3 materiales consumidos.
>
> Todavía no hay recepciones consumidas en producción.

El segundo colgaba de `recepciones.length === 0`, que antes solo podía significar «no hay ninguna» y ahora también significa «ninguna coincide». El lector quedaba eligiendo a cuál creerle.

Es el mismo defecto que ya apareció con el catálogo de especificaciones: **un estado vacío que no distingue «no existe nada» de «no coincide nada»**. Corregido contra el total, con prueba.

## Verificación en navegador (`erp_dev`)

| Búsqueda | Resultado |
| --- | --- |
| `aceite` (minúsculas) | encuentra `RC-00001 · MP-ACEITE-BASE — Aceite base mineral 500N`, y dice «1 de 3 coinciden» |
| `prov-nb` | «Ningún resultado… entre los 3 materiales consumidos», sin el mensaje contradictorio |

`tests/buscar-material-trazabilidad.test.ts`: 7 pruebas.

## Lo que queda fuera, y por qué

- **No busca por cliente.** «¿Qué material recibió el producto que le vendí a este cliente?» es la cadena al revés y arranca en otra pantalla.
- **El tope es fijo en 50.** Paginar de verdad hace falta cuando el filtro ya no alcance; hoy alcanza de sobra.
- **El selector sigue siendo un `<select>`.** Con el filtro delante cumple; un buscador con autocompletado sería mejor y es más trabajo del que este problema justifica hoy.
