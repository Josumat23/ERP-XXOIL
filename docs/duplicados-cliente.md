# El mismo cliente, cargado dos veces

El índice único sobre `ruc` ya impedía el duplicado **exacto**. El que se cuela es el otro: el mismo contribuyente como `20123456789` y como `20-123456789`, o la misma empresa como «Ferretería San Martín S.R.L.» y «FERRETERIA SAN MARTIN SRL».

Importa más de lo que parece. El cliente es la llave de casi todo lo construido en los últimos ciclos: **un duplicado parte en dos el historial de crédito, el saldo de cascos y la cobranza** — y cada mitad parece estar al día.

## El documento lo rechaza la base

`documentoNormalizado` guarda el documento sin separadores y en mayúscula, con índice único por compañía. Así **la base** rechaza el duplicado disfrazado; no depende de que alguien se acuerde de comparar.

El índice sobre `ruc` se conserva: ese protege el valor tal como se escribió.

Los clientes sin documento conviven sin problema — los NULL no chocan entre sí en un índice único, la misma propiedad que ya sostiene «una dirección principal por tipo» y «un solo contacto principal».

## El nombre se avisa, no se bloquea

Dos empresas pueden llamarse parecido y ser distintas. Así que el parecido de razón social **avisa** y pide confirmación explícita: quien sabe que es otro cliente marca «Es un cliente distinto: créelo igual» y sigue.

La clave de comparación quita tildes, puntuación, los espacios de más y la forma jurídica.

**La forma jurídica se quita solo al final.** «SA» en medio de un nombre puede ser parte del nombre, y borrarlo ahí convertiría dos empresas distintas en la misma: «SA Motors EIRL» no es «Motors EIRL».

**Y se compara ignorando los espacios**, porque `S.R.L.` llega a esa altura convertido en `S R L` — sin eso, justamente la forma de escribirlo que produce el duplicado quedaba fuera. Fue un defecto real de la primera versión: las pruebas lo atraparon.

Si el nombre entero es la forma jurídica, se conserva: una clave vacía se parecería a cualquier otra clave vacía.

## El umbral, y por qué no más bajo

0.85 de similitud. Deja pasar una letra cambiada en un nombre corto y dos o tres en uno largo, que es el error de tipeo real.

Bajarlo llenaría el aviso de falsos positivos —«Grifo Norte» y «Grifo Sur» se parecen mucho y son dos clientes— y **un aviso que salta siempre se ignora siempre**.

## La dirección refuerza, no acusa

La dirección **no basta por sí sola**: en una galería o un mercado conviven decenas de clientes en la misma puerta. Solo sube la sospecha cuando el nombre ya se parece, y entonces el motivo pasa de «nombre parecido» a «nombre y dirección parecidos».

## El orden de la migración

Primero la columna, después el relleno, y recién al final el índice. Si el índice fuera primero, el `UPDATE` fallaría a la mitad dejando unas filas normalizadas y otras no.

**Si la migración falla al crear el índice, es porque ya existen dos clientes que son el mismo contribuyente.** Eso no se resuelve solo: hay que decidir a mano cuál sobrevive y a dónde va su historial. Fallar es la respuesta correcta — fusionarlos por cuenta propia sería peor.

Se ejerció contra dos bases sombra: una con datos limpios (normaliza, deja los nulos en paz, y después rechaza el duplicado con otra puntuación) y otra que **ya traía** el duplicado disfrazado, donde la migración falla como debe.

SQLite no tiene expresiones regulares, así que el relleno quita los separadores que realmente aparecen —espacio, guion, punto y barra—. La normalización completa la hace la aplicación de aquí en adelante.
