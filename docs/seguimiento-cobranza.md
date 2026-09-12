# Seguimiento del aviso de cobranza

Cierra la mitad no ambigua del ítem *Escalamiento de cobranza (dunning)* del Blueprint 03 §7, que la auditoría del 2026-09-11 dejó como **Parcial**: «existe el registro, no existe una máquina de estados de cobranza».

## Qué había antes

`AvisoCobranza` guardaba nivel (amistoso / formal / final), días vencidos, fecha y quién lo emitió. Un **log de avisos emitidos**: se sabía a quién se le había escrito y **nunca qué había contestado**. Si un cliente prometía pagar el viernes, esa promesa vivía en la memoria de quien llamó.

## Qué se agregó

Al aviso, la respuesta del cliente:

| Estado | Qué significa |
|---|---|
| `PENDIENTE` | Emitido, todavía sin respuesta. Es el valor por defecto, y es lo que son todos los avisos ya emitidos |
| `COMPROMISO_PAGO` | El cliente se comprometió a una fecha (obligatoria) |
| `EN_DISPUTA` | El cliente objeta la factura (detalle obligatorio) |
| `SIN_RESPUESTA` | Se le contactó y no contestó |

Con quién la registró y cuándo, como en el resto del sistema.

## Lo que **no** se guarda

**`COMPROMISO_INCUMPLIDO`** — el compromiso venció y la factura sigue impaga — se **deriva** en cada render y por eso no tiene columna.

Guardarlo sería garantizar que se quede viejo: se vence solo con el calendario, y deja de valer en cuanto entra el cobro, sin que nadie toque el aviso. Una bandeja que acusa incumplimientos ya pagados se deja de mirar a la semana. Hay una prueba estructural que falla si alguien le agrega al modelo una columna de incumplimiento.

No hay una situación "cobrada": la pantalla descarta las facturas sin saldo antes de derivar nada, así que esa rama no la alcanzaría ningún dato. Se escribió y se quitó al comprobarlo.

### El detalle del día

El incumplimiento se compara **por día, no por instante**:

```ts
const incumplido = inicioDelDia(aviso.compromisoPagoEn) < inicioDelDia(hoy);
```

Quien se comprometió *para hoy* tiene todo el día para pagar. Marcarlo incumplido a las nueve de la mañana sería una acusación falsa. Cubierto por prueba en los tres bordes: la mañana del día comprometido, las 23:59 de ese mismo día, y el minuto siguiente.

## En pantalla

`/finanzas/cobranza` gana una columna **Seguimiento**: la situación con su color, la fecha comprometida si la hay, el detalle, y el formulario para registrar la respuesta. La fecha solo se pide cuando el estado es un compromiso; el detalle solo aparece cuando hay algo que contar.

Arriba, un aviso con el conteo de **compromisos incumplidos** — la única fila que hay que mirar primero en una bandeja de cobranza.

Al cambiar de `COMPROMISO_PAGO` a otro estado, la fecha se limpia: si no, quedaría un compromiso fantasma del que se seguiría derivando un incumplimiento que ya nadie sostiene. Por lo mismo, volver a «sin respuesta aún» borra el texto de la respuesta anterior — esa fila diría dos cosas contrarias a la vez.

### Un defecto encontrado al verificarlo

La primera versión del formulario tenía el selector **controlado** (`value={seleccion}`) y su estado inicializado del aviso. Dos problemas, ambos vistos en el navegador:

1. Después de guardar, el selector conservaba lo último elegido en pantalla aunque en base hubiera quedado otra cosa: se llegó a ver «Compromiso de pago» sobre un aviso guardado como `PENDIENTE`.
2. Si el valor del DOM y el estado de React se separaban, **se enviaba el del DOM** mientras la pantalla mostraba el otro.

Se corrigió por los dos lados: el selector pasó a ser **no controlado** —lo que se envía es exactamente lo que se ve elegido, y `seleccion` solo decide qué campos extra aparecen— y el formulario lleva una `key` que incluye lo guardado, de modo que cuando el aviso cambia en base la pantalla se reinicia desde ahí en vez de quedarse con lo anterior.

## La migración

Seis `ALTER TABLE ... ADD COLUMN`, todas nulas o con default. Prisma proponía un `RedefineTables` (crear tabla nueva, copiar, borrar, renombrar); para columnas aditivas eso es más riesgo sin ninguna ventaja. **Ninguna fila existente cambia de significado**: los avisos ya emitidos quedan en `PENDIENTE`, que es exactamente lo que son.

## Lo que este ciclo no hace, y por qué

- **No hay escalamiento automático.** El nivel lo sigue sugiriendo la antigüedad (1–15 amistoso, 16–30 formal, +30 final) y lo confirma una persona. Que el sistema suba de nivel solo, o que un compromiso incumplido dispare el aviso final, es una **política de cobranza** — cuántos días de gracia, cuántos intentos antes de escalar, qué pasa con un cliente en disputa. No se inventa.
- **No hay castigo ni provisión de incobrables.** Declarar una deuda incobrable tiene consecuencias contables y tributarias; es una decisión del contador, no un estado más del selector.
- **El bloqueo por cobranza sigue siendo manual**, como estaba, y sigue siendo de Gerencia.
- Los umbrales de días siguen fijos en el código, como se documentó al construirlos.

## Verificación

**7 pruebas** (279 en total): los tres bordes del día del compromiso; los estados que se muestran tal cual; un compromiso sin fecha y una disputa sin detalle rechazados; un estado inventado rechazado; que cada estado registrable tenga etiqueta y que el derivado **no** sea elegible; que un aviso nazca en `PENDIENTE` y que registrar la respuesta deje quién y cuándo. Más dos guardias: la situación derivada no se persiste, y la acción valida la compañía activa sobre un id que llega del navegador.

**En navegador**, sobre una base de demostración nueva:

| Paso | Resultado |
|---|---|
| Pantalla de cobranza con dos facturas vencidas | Columna **Seguimiento** en «—» mientras no hay avisos |
| Registrar aviso | Aparece el formulario con **exactamente los cuatro estados registrables** — ninguno derivado |
| Elegir «Compromiso de pago» | El campo de fecha aparece solo entonces |
| Envío forzado sin fecha (quitando el `required` del HTML) | Rechazado por el servidor: «Un compromiso de pago necesita la fecha comprometida» |
| Compromiso al 5/9/2026, con hoy 12/9 | Insignia roja **«Compromiso incumplido · 5/9/2026»** y aviso arriba: «1 compromiso de pago incumplido» |
| Recarga de la pantalla | El selector vuelve a mostrar lo guardado, con su fecha (el defecto de arriba, ya corregido) |
| Cambiar ese mismo aviso a «En disputa» con detalle | La fecha comprometida **queda en `null`** aunque el formulario todavía la llevara, y la insignia pasa de «Compromiso incumplido» a «En disputa»: no queda compromiso fantasma |
