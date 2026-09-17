# La ficha del instrumento decía menos de lo que sabía, y no lo decía

«Qué se midió con este instrumento» traía sus filas con un tope de **300 compartido entre todos los instrumentos**, ordenado por fecha descendente, y después se quedaba con las 50 primeras de cada uno.

Con los datos de hoy —seis mediciones— funciona. Con volumen real, el instrumento que más se usa se lleva el tope entero y uno poco usado aparece **sin ninguna medición**.

No «con menos»: con ninguna. Y en pantalla eso se lee exactamente igual que «nunca midió nada», porque la sección simplemente no se renderizaba. La columna que se estaba ocultando es la del **respaldo de calibración** — o sea justo la evidencia que esta pantalla existe para dar. Un jefe de calidad revisando qué quedó sin respaldo después de una verificación fuera de tolerancia habría concluido que no hay nada.

Es el mismo defecto que el recall por lote del proveedor: **una respuesta incompleta con cara de completa**.

## Dos preguntas, dos consultas

| Pregunta | Cómo se contesta |
| --- | --- |
| **¿Cuánto** midió cada instrumento? | Un conteo agrupado en la base (`groupBy`). Exacto, barato, sin traer una sola fila |
| **¿Qué** midió? | Solo del instrumento que se pide ver, con su propio tope de 50 |

Un instrumento ya no puede quedarse sin su tope, porque no lo comparte con nadie. El costo es un clic; a cambio, lo que la pantalla muestra es verdad.

La cuenta se dice **siempre**, incluso cuando es cero: «Todavía no se registró ninguna medición con este instrumento». Ese era el mensaje que faltaba y que hacía indistinguible «no midió nunca» de «su tope se lo llevó otro».

Y si la lista está recortada, lo dice, con el camino a la respuesta completa:

> Se muestran las 2 más recientes de 6; para revisar las que no tienen respaldo, la lista completa y ordenada por urgencia está en **Qué hay que reensayar**.

## El conteo y la lista excluyen lo mismo

Una inspección de recepción **pendiente** no tiene fecha: no se ensayó nada. La lista ya la descartaba; el conteo también tiene que hacerlo, o la pantalla diría «se muestran 3 de 4» teniendo las 3 que hay. La condición se declara una vez (`deRecepcionDeLaCompania`) y la usan las dos, y hay una prueba que cuenta los usos para que no se separen.

## El id viene del navegador

`?mediciones=<id>` se comprueba contra los instrumentos **de esta compañía** antes de usarse. Sin eso, pegar el id de un instrumento ajeno mostraría sus mediciones. Verificado pasando un id que no es de ningún instrumento: la pantalla carga normal, sin detalle abierto y sin error.

## El defecto, reproducido

La prueba que importa no afirma nada sobre el código: **ejecuta la consulta vieja contra la base** con dos instrumentos —uno con tres mediciones recientes, otro con una más antigua— y un tope compartido de 3, y comprueba que el segundo instrumento se queda con **cero** filas. Después ejecuta la consulta nueva y comprueba que ve la suya.

Si algún día esa reproducción dejara de fallar, la prueba lo dice con ese mensaje: el defecto que se está previniendo ya no se puede reproducir, y entonces la guarda hay que revisarla.

## Verificación en navegador (`erp_dev`)

| Instrumento | Qué muestra |
| --- | --- |
| DM-01 Densímetro digital | «6 mediciones registradas… Ver qué midió» |
| PEN-01 Penetrómetro de grasas | «1 medición registrada… Ver qué midió» |
| BAL-01, TER-01, VIS-01 | «Todavía no se registró ninguna medición con este instrumento» |

Abriendo DM-01: las 6 mediciones, de las tres clases de ensayo (liberación de lote, re-análisis de vigencia e inspección de recepción), ordenadas por fecha, con su respaldo. Solo una sección queda abierta a la vez.

Para ver el aviso de recorte se bajó el tope a 2 momentáneamente: aparece «Se muestran las 2 más recientes de 6» y la tabla trae exactamente 2 filas. Restaurado a 50.

`tests/ficha-instrumento-sin-truncar.test.ts`: 11 pruebas.

## Lo que este ciclo NO hizo

`revisarReensayos()` carga **todas** las mediciones de todos los instrumentos, sin tope. Es el defecto opuesto: no miente, pero no escala. No se toca acá porque un tope mal puesto ahí produciría exactamente la mentira que este ciclo elimina, y hacerlo bien es un cambio de otro tamaño. Queda anotado, no corregido.
