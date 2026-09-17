# Un lote del proveedor puede haber llegado en varias recepciones

La pantalla de trazabilidad / recall contestaba «¿qué se fabricó con este material?» por **recepción**. Pero el proveedor no llama por una recepción: llama por **su lote** —«el L-2026-014 salió con la viscosidad fuera»— y ese lote pudo entrar en dos, tres o cinco descargas.

Consultando una sola, la pantalla devolvía **la mitad de lo fabricado, con cara de respuesta completa**: ningún dato en pantalla decía que faltaba algo. En un recall es el peor error posible, porque quien lee concluye que el alcance es menor de lo que es y deja producto afuera.

## No se amplía en silencio

Agregar las hermanas por nuestra cuenta habría contestado *otra* pregunta. A veces la consulta **sí** es por una entrega puntual: llegó dañada, se descargó mal, se reclamó esa guía. Las dos preguntas son legítimas y la pantalla no puede decidir cuál se está haciendo.

Por eso el aviso aparece siempre que hay hermanas, y ampliar es un clic:

> El lote del proveedor **PROV-NB-77** también llegó en RC-00007. Esta consulta cubre solo RC-00001. [Ver todo el lote del proveedor]

Ampliado, el aviso cambia de color y dice qué cubre, con los números a la vista:

> Alcance ampliado: el lote del proveedor **PROV-NB-77** llegó en 2 recepciones y esta consulta las cubre todas (RC-00001, RC-00007). [Ver solo RC-00001]

El camino de vuelta importa tanto como el de ida: sin él, la pregunta por la entrega puntual quedaría sin forma de hacerse.

## Qué define «hermana»

Tres condiciones, y ninguna de más:

| Condición | Por qué |
| --- | --- |
| Mismo **material** | Un número de lote del proveedor no identifica nada por sí solo: dos productos del mismo proveedor pueden traer la misma numeración |
| Mismo **número de lote del proveedor** | Es la pregunta |
| Misma **empresa** | Dos empresas del grupo pueden comprarle al mismo proveedor y recibir el mismo lote; sin el filtro, el recall de una mostraría los lotes fabricados por la otra |

Las dos primeras están probadas contra la base con dos trampas sembradas —el mismo número de lote en otro material, y el mismo material con otro lote—; la tercera, creando una segunda empresa que recibe ese mismo número de lote.

## El encabezado cuenta lo mismo que la tabla

Era el riesgo de la corrección: dejar «Recibido 300 kg» encima de un consumo de 600. Una contradicción impresa, y de la clase que alguien copia a un informe.

Las cifras del encabezado se suman sobre el alcance vigente y las etiquetas lo dicen: **Recibido (todo el lote)**, **Sin consumir (todo el lote)**.

«Sin consumir» sobre el alcance completo es, además, el dato más accionable del día del recall: **cuánto del lote sospechoso sigue en el almacén** y se puede inmovilizar antes de que entre a un lote más.

## Un lote fabricado con dos descargas sale en una sola fila

Si el LG-00007 consumió 120 kg de una descarga y 80 de la otra, lleva **200 kg** de ese lote del proveedor. Dos filas de 120 y 80 harían creer que son dos lotes distintos, y el resumen diría «2 lotes fabricados» donde hay uno. Lo resuelve `lotesQueConsumieron()`, que ya agrupaba por lote; la unión de alcances solo le da más filas de entrada.

Lo devuelto a almacén sigue sin contar: una asignación devuelta por completo no es un consumo, y acusar al lote de llevar material que volvió al estante ampliaría el recall sin motivo.

## El dato que no estaba cargado

Nada de esto se podía estrenar: las recepciones que siembra `seed-demo.ts` **no traen número de lote del proveedor**. El campo es opcional y nadie lo llenaba, así que la pantalla se abría pero no había con qué buscar.

`npm run seed:trazabilidad` lo completa. Solo escribe ese campo: no crea recepciones, no mueve stock, no toca costos ni contabilidad. Cuando un material tiene dos o más recepciones, las dos primeras quedan bajo el mismo lote —que es el caso que la pantalla tiene que saber contestar—, y si alguna ya traía uno cargado a mano se respeta el suyo. Si ningún material se recibió más de una vez, **no inventa una recepción** para que el caso exista: lo avisa y termina.

Es idempotente: la segunda corrida escribe cero.

## Verificación en navegador (`erp_dev`)

Escenario sembrado: `PROV-NB-77` llegó en RC-00001 (300 kg, consumidos enteros por tres lotes) y RC-00007 (100 kg, todavía en almacén).

| Alcance | Recibido | Sin consumir | Lotes | Clientes |
| --- | --- | --- | --- | --- |
| Solo RC-00001 | 300.000 kg | 0.000 kg | 3 | 5 |
| Todo el lote del proveedor | 400.000 kg | **100.000 kg** | 3 | 5 |

El material usado en la tabla suma 300 kg en los dos casos —lo de RC-00007 no entró en ningún lote—, que es exactamente la respuesta correcta: hay 100 kg del lote sospechoso sin consumir, y ahora se ven.

RC-00007 no aparece en el selector, porque el selector solo ofrece recepciones ya consumidas: ofrecer las demás lo llenaría de opciones que no contestan nada. El aviso de hermanas es justamente el camino por el que esa recepción entra en la consulta.

`tests/recall-por-lote-proveedor.test.ts`: 11 pruebas. Las dos guardas que importan —el filtro por material y la coherencia del encabezado— se verificaron reintroduciendo el defecto: se ponen en rojo.
