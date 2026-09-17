# Qué hay que reensayar

El ciclo anterior dejó al sistema contestando, **instrumento por instrumento**, qué lotes había medido cada uno y con qué respaldo. Faltaba la pregunta al revés, que es la que se hace de verdad el día que una calibración vuelve fuera de tolerancia:

> ¿Qué tengo que reensayar, de todo el laboratorio, y por dónde empiezo?

Ir instrumento por instrumento no sirve ese día: hay que abrirlos todos para descubrir cuáles tienen trabajo pendiente, y el que se olvida es justo el que importaba.

## La decisión del ciclo: qué ordena la lista

Una lista sin orden obliga a leerla entera para saber qué urge, y con volumen real nadie la lee entera. Lo que manda **no es la gravedad del problema de medición** sino **dónde está el producto**:

| Orden | Destino | Por qué |
| --- | --- | --- |
| 1 | Ya está en poder del cliente | No se arregla reensayando. Hay que decidir qué se le dice |
| 2 | Aprobado, todavía sin despachar | Se reensaya y se acabó: es trabajo de laboratorio |
| 3 | Nunca salió | No hay producto expuesto |

Recién dentro de cada grupo pesa el problema de medición, y ahí también al revés de lo que parece:

- **`EN_DUDA` pesa más que `SIN_RESPALDO`.** `EN_DUDA` es un problema confirmado: el instrumento se verificó y estaba fuera de tolerancia. `SIN_RESPALDO` casi siempre es un hueco de datos —una calibración que existe en papel y todavía no se cargó— y se resuelve cargándola, sin tocar el producto.

Y al final, el ensayo más reciente primero; entre dos lotes idénticos, por código, para que la lista no cambie de orden sola entre dos visitas.

## Lo que aporta sobre el ciclo anterior

La ficha del instrumento ya decía qué lotes había medido. Lo nuevo es que **cruza el laboratorio con la cadena comercial**: para cada lote en cuestión dice si el producto sigue en almacén o si ya salió, a cuántas unidades y a cuántos clientes, con enlace directo a la vista de recall que lista uno por uno a quiénes.

Esa es la diferencia entre un aviso y una decisión. Un sistema de calidad que solo dice «el lote 4 está en duda» deja el trabajo difícil sin hacer.

## Una regla de negocio que estaba escrita tres veces

El neto vigente por línea de venta —`ASIGNADA` menos `LIBERADA`, descartando facturas anuladas y devoluciones— estaba copiado a mano en la ficha del envasado, en la vista de recall y hacía falta por tercera vez acá. Se extrajo a `src/lib/despachoLote.ts`.

Al extraerlo apareció un defecto que llevaba tiempo ahí: cuando una guía tenía **todas** sus facturas anuladas, `join(", ")` sobre una lista vacía devolvía `""`, que no es nulo, así que la columna «Factura» salía **en blanco** en vez de mostrar «—». Corregido, con prueba.

## Cómo se conecta

- **Pantalla:** `/produccion/calidad/reensayos`, en el menú de Producción y en la cabecera de Control de calidad.
- **Panel general:** la fila de Calidad suma una señal nueva. Un lote despachado es **crítico**; los que siguen en casa, **atención**. Va gobernada por el mismo interruptor de control de calibración que el resto del laboratorio: con el control apagado, el panel no dice nada y la pantalla se puede consultar igual.
- **Una sola consulta** (`src/lib/reensayosConsulta.ts`) sirve al panel y a la pantalla. No es un detalle de estilo: dos derivaciones del mismo hecho terminan discrepando sin que nadie lo note, y este proyecto ya pagó ese precio con la densidad.

## Verificación en navegador (`erp_dev`)

1. Se registra en `DM-01` una verificación **fuera de tolerancia** con fecha de hoy. El ensayo de `LG-00004` (16 set. 2026) pasa solo a *«En duda: la siguiente verificación salió fuera de tolerancia»*.
2. La pantalla lista los dos lotes afectados, y **`LG-00001` sale primero aunque su ensayo es más viejo** (14 set. contra 16 set.): ya está despachado. Es exactamente la regla de orden del ciclo, funcionando.

   | Lote | Ensayo | Respaldo | Dónde está |
   | --- | --- | --- | --- |
   | LG-00001 | 14 set. 2026 | En duda | **Ya está en poder del cliente** — 120 unidades en 5 clientes |
   | LG-00004 | 16 set. 2026 | En duda | Aprobado, todavía sin despachar |

3. El enlace «ver a quiénes» lleva al recall del lote, que muestra los mismos **120** y los mismos **5 clientes** — las dos pantallas cuentan igual porque cuentan con la misma función.
4. Con el control de calibración encendido, el panel general muestra **Calidad → «1 lote despachado con mediciones sin respaldo» → Crítico**.

`tests/reensayos-pendientes.test.ts`: 33 pruebas. Las guardas se comprobaron reintroduciendo el defecto:

- Invertir el orden de urgencia hace fallar **3** pruebas.
- Quitar los dos filtros de compañía hace fallar la prueba de aislamiento.

## Un defecto en la propia prueba

La prueba de aislamiento empezó siendo inútil: buscaba una segunda compañía con `findFirst` y hacía `if (!otra) return`. La base de pruebas trae solo los maestros mínimos —una sola compañía—, así que **se saltaba en silencio y salía verde sin comprobar nada**. Ahora crea la segunda compañía ella misma.

Además el caso que prueba se volvió el que de verdad hay que aislar: un ensayo que apunta a un instrumento de la compañía 1 y a un lote de la 2. Que cada compañía vea sus propios instrumentos es fácil; el cruce es lo difícil, porque la pantalla llega al lote **por** el instrumento.

## Lo que queda fuera, y por qué

- **No bloquea ni advierte al liberar un lote.** Sigue esperando la misma decisión de calidad del ciclo anterior: si corresponde bloquear o solo advertir. El sistema ya tiene todo lo necesario.
- **Las mediciones sin instrumento declarado no entran en la lista.** No hay historial contra el cual derivar nada. Se cuentan aparte y se dice explícitamente que **no** están respaldadas: no se sabe. Los ensayos anteriores a este módulo no traen el dato y no se puede reconstruir.
- **Sin paginar.** Con volumen real la consulta recorre todas las mediciones que declaran instrumento. Hoy son pocas; el día que no lo sean habrá que acotarla por fecha.
- **No propone qué hacer.** La pantalla informa. Si una medición sin respaldo obliga a reensayar, a retener el lote o a avisarle al cliente es criterio de calidad, y no se decide desde el sistema.
