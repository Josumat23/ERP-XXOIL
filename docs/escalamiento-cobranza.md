# Escalamiento automático de cobranza

Cierra el ítem del Blueprint 03 §7 *Escalamiento de cobranza (dunning)*, registrado como **Parcial** desde la auditoría del 2026-08-06: existía el registro de avisos, no una máquina de estados.

## La decisión que define todo el diseño

**El sistema no emite el aviso por su cuenta.**

No es una limitación técnica ni una etapa pendiente. En este ERP no hay correo ni mensajería en ninguna parte —se verificó: cero dependencias de envío en todo el repositorio—, así que «Registrar aviso» **no manda nada**: deja constancia de que alguien contactó al cliente. Un trabajo por temporizador que creara esas filas estaría **fabricando un registro de contacto que nunca ocurrió**, y ese registro es justamente el que se mira después para decidir si se corta el crédito o se pasa a cobranza judicial.

Así que el escalamiento hace lo único que puede hacer con honestidad: **dice qué corresponde hoy y por qué**. La llamada la hace una persona, y al registrarla queda el nivel que la política pedía.

Por la misma razón **ningún cliente queda bloqueado automáticamente**. El bloqueo de cobranza sigue siendo manual.

## Cómo se enciende

`PoliticaCobranza` tiene una fila por compañía y **la fila existe solo si alguien la definió**. Sin política no hay escalamiento y la pantalla funciona exactamente como antes: nivel sugerido por antigüedad, decidido por una persona. Cuándo escalar es política de cobranza y el sistema no elige una por su cuenta.

Apagarla es **borrar la fila**, no un campo `activa`: un interruptor habría dejado umbrales guardados sin efecto y la duda permanente de si están rigiendo.

| Ajuste | Por defecto | Qué pasa si se deja vacío |
|---|---|---|
| Aviso formal desde (días) | 15 | — (obligatorio) |
| Aviso final desde (días) | 30 | — (obligatorio) |
| Escalar tras N días sin respuesta | *vacío* | **La regla no corre** |
| Días de gracia tras compromiso incumplido | *vacío* | **La regla no corre** |
| No escalar en disputa | activado | — |

Los 15 y 30 son los umbrales que el código ya traía fijos: definir la política no cambia, por sí solo, el nivel que se venía sugiriendo. Las dos reglas nuevas nacen apagadas — definir la política no las enciende, cada una es una decisión propia.

El único valor por defecto que opina es **no escalar en disputa**: perseguir a un cliente por una factura que todavía se le está investigando es el desenlace que nadie quiere. Es un valor por defecto, no una regla; se desmarca con un clic.

## Las reglas

1. **Un compromiso vigente pausa todo**, por vencida que esté la factura. Perseguir a alguien el día después de que quedó en pagar el viernes es la forma más rápida de perder el compromiso. La palanca es la fecha: quien la registra decide hasta cuándo se espera.
2. **Una disputa pausa**, si la política lo dice.
3. Si no hay pausa se juntan los candidatos —antigüedad, aviso sin respuesta, compromiso incumplido— y **gana el nivel más alto**. A igual nivel gana el motivo más específico, porque es el que le sirve a quien va a llamar al cliente.
4. Pasado el aviso final **no se inventa un nivel 4**.

## Los dos detalles que no se ven a simple vista

**Un compromiso sin fecha no pausa nada.** Si bastara el estado, guardar un compromiso vacío sería la forma de congelar el escalamiento de una factura para siempre. Cubierto por prueba.

**El aviso final agotado es un estado propio.** Cuando una regla pide subir por encima del nivel 3, la acción no es «nada que hacer»: es `Sin nivel disponible`, con su contador aparte en la cabecera. Lo que sigue —cobranza judicial, castigo, bloqueo— es una decisión de una persona, y esconderla detrás de un «al día» sería perder justo las cuentas que más atención necesitan.

## El defecto que la política destapó

`registrarAvisoCobranza` **reimplementaba los umbrales en línea**:

```ts
const nivel = dias > 30 ? 3 : dias > 15 ? 2 : 1;   // ya no
```

Una copia de `nivelSugerido()` que nadie había notado porque daba el mismo resultado. Con umbrales configurables deja de darlo: el botón habría registrado un nivel distinto del que la columna «Acción debida» estaba pidiendo, y la cola habría seguido reclamando el mismo escalón para siempre. Ahora el nivel sale de la misma política que pinta la pantalla, y una guardia estructural falla si vuelve a reimplementarse.

De paso, `nivelSugerido()` quedó sin usos —`nivelPorAntiguedad()` la reemplaza con umbrales configurables— y se eliminó; su comentario («umbrales fijos, no configurables») ya era falso.

Si la política dice que **no** toca nada, o que está pausada, el botón igual registra por antigüedad: una persona puede decidir volver a contactar al cliente y el sistema no le discute esa decisión.

## Verificación

**23 pruebas** (295 en total): cada regla por separado, las dos en `null`, el borde exacto de cada plazo, el desempate a igual nivel, el compromiso sin fecha, el nivel 4 que no se inventa, la validación de la política, unicidad por compañía y borrado en cascada. Más tres guardias estructurales: que nada fuera de esa acción cree avisos, que ninguna tarea programada los toque, y que la acción debida no se guarde en el modelo.

**En navegador**, con la base de demostración y datos retrocedidos para simular días transcurridos:

| Caso | Resultado |
|---|---|
| Sin política | Sin columna, umbrales por defecto en el texto, enlace para definirla |
| Aviso final por debajo del formal | Rechazado, nada guardado |
| Factura en disputa | `En pausa` |
| Aviso de hoy, 12 días vencida | `Al día` |
| Aviso de hace 11 días sin respuesta | `Toca aviso formal — El aviso lleva 11 días sin respuesta` |
| Botón «Registrar aviso» en esa fila | Grabó **nivel 2**, el escalado, no el 1 de la antigüedad |
| Aviso final sin respuesta hace 8 días | `Sin nivel disponible` + contador en la cabecera |
| Apagar la política | Columna fuera, pantalla igual que antes |

La política guardada y la borrada quedaron en la auditoría de maestros (`CREAR` y `ELIMINAR`), como corresponde a algo que decide a quién se persigue por una deuda.

## Lo que este ciclo no hace

- **No envía nada** ni bloquea clientes solos, por lo explicado arriba.
- **No hay un nivel 4** ni cobranza judicial modelada: exigiría definir el procedimiento legal de la empresa, que es decisión del negocio y de su asesoría.
- **No corre por temporizador.** La acción se deriva en cada render, como el compromiso incumplido: depende del día de hoy y guardarla sería garantizar que se quede vieja.
