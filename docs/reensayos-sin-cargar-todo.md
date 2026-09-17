# «Qué hay que reensayar» cargaba el laboratorio entero para descartarlo

`revisarReensayos()` traía **todas** las mediciones de **todos** los instrumentos —sin tope— y después filtraba en memoria las que no tenían respaldo de calibración.

Con seis mediciones es gratis. Con un año de producción son decenas de miles de filas por visita, y no solo en su pantalla: **el semáforo del panel general llama a la misma función**, así que el costo lo paga cualquiera que abra el inicio.

Es el defecto **opuesto** al de la ficha del instrumento: aquel truncaba y mentía; este dice la verdad pero no escala.

## Por qué un tope no servía

El orden que importa —lo que ya está en el cliente primero— se calcula **después** de traer la cadena comercial de cada lote. Recortar antes de ordenar devolvería una lista incompleta con cara de completa, que es exactamente lo que el ciclo anterior acaba de sacar del sistema.

## Se filtra, no se recorta

Lo que se busca son las mediciones **sin respaldo**, que son la excepción y no la regla. Si el laboratorio está al día el resultado es chico; si es enorme, eso mismo es la alarma. El tamaño queda acotado por el tamaño del problema, que es el límite correcto.

Para poder preguntárselo a la base hace falta traducir la regla de respaldo a tramos de fechas. Eso hace `ventanasRespaldadas()`.

## La regla no se reimplementa: se ejecuta

Escribir «una medición está respaldada si cae entre `fecha` y `vigenteHasta` de alguna calibración conforme» en SQL sería una segunda copia de la regla, y la segunda copia es la que se desincroniza. Peor: se equivocaría, porque `EN_DUDA` —la medición cayó dentro de una vigencia, pero la verificación siguiente encontró el instrumento fuera de tolerancia— también tiene que aparecer en la lista.

`ventanasRespaldadas()` no decide nada por su cuenta. Parte la línea de tiempo en los instantes donde la respuesta puede cambiar —cada fecha de calibración y cada vencimiento— y le pregunta a **`respaldoDeMedicion()`** por cada tramo. Los extremos se evalúan aparte, porque la regla los incluye: el día del vencimiento todavía respalda.

Así las dos formas de preguntar no pueden discrepar por construcción. Y hay una prueba que las compara sobre **mil fechas al azar** con semilla fija, más otra que recorre los bordes exactos de cada calibración a ±1 ms — que es donde una implementación por tramos se equivoca sin que nadie lo note.

## La base acota, la regla decide

El filtro SQL trae un conjunto que **contiene** a las mediciones sin respaldo; `respaldoDeMedicion()` sigue dictaminando cada una en memoria, igual que antes. Si algún día un tramo se calculara de más, la consulta traería filas de sobra y la regla las descartaría: el resultado seguiría siendo correcto, solo más caro. Sin ese segundo paso, un tramo mal calculado se convertiría en silencio en la respuesta.

## Lo que se contaba y ya no se puede contar así

`medicionesEvaluadas` —«las N mediciones con instrumento declarado tienen calibración vigente»— salía de contar lo que la consulta había traído. Ahora que solo se trae lo que falta, sale de un `count()` en la base. Hay una prueba que lo fija: con una medición respaldada y otra sin respaldo, `items` trae **1** y `medicionesEvaluadas` dice **2**.

## Verificación: lo viejo contra lo nuevo, sobre datos reales

Se ejecutaron las dos implementaciones contra `erp_dev` y se compararon medición por medición:

```
mediciones sin respaldo (forma vieja): 7
mediciones sin respaldo (forma nueva): 7
evaluadas vieja: 7 | nueva: 7
FALTAN en la nueva: []
SOBRAN en la nueva: []
IGUALES
```

Y en pantalla: «Qué hay que reensayar» muestra 6 ensayos a revisar, 3 ya en poder del cliente y 228 unidades despachadas; el semáforo del panel general dice «Calidad — 3 lotes despachados con mediciones sin respaldo — Crítico». Lo mismo que antes del cambio.

## Las guardas no pasan de casualidad

Se rompió `ventanasRespaldadas()` a propósito, devolviendo un tramo que cubre toda la historia: **9 de las 15 pruebas se ponen en rojo**, incluidas las dos que importan —la que comprueba que lo sin respaldo vuelve y la que comprueba que lo que quedó en duda vuelve—. Un tramo de más esconde trabajo real, y eso se nota.

`tests/reensayos-sin-cargar-todo.test.ts`: 15 pruebas.
