# Con qué instrumento se midió cada cosa

Es la mitad que faltaba del laboratorio. El sistema sabía que un instrumento estaba vencido y sabía qué densidad se había medido, pero **no los unía**: no podía contestar *«¿qué lotes se liberaron con este instrumento?»*, que es la pregunta del día que una calibración vuelve fuera de tolerancia.

Se construyó ahora, antes de que el laboratorio opere, por una razón concreta: **si no se captura desde el primer día, los ensayos de los próximos meses quedan sin rastro y no se puede reconstruir después**.

## Dónde se registra

El **plan de inspección** declara con qué instrumento se espera medir cada característica. Es el valor por omisión del ensayo, no una obligación.

El **resultado del ensayo** registra con cuál se midió de verdad. Ese es el hecho. Si el ensayo no lo dice, rige el del plan; si el plan tampoco, queda en `null` — que es la verdad: no se sabe.

## La decisión que vale la pena discutir: derivar, no congelar

El estado de calibración del momento **no se guarda con la medición**. Se deriva del historial del instrumento cada vez que se consulta.

Congelarlo sería lo natural —es lo que haría un sistema pensado como archivo— y está mal por dos motivos:

1. **Fijaría una respuesta que va a mejorar sola.** Mientras el laboratorio se pone en marcha se van a cargar calibraciones viejas que faltaban. Cada una de esas cargas debería corregir el respaldo de los ensayos que cubre, sin tocar los ensayos.
2. **Podría discrepar del ledger sin que nada lo avise.** Dos fuentes para el mismo hecho es exactamente el defecto que este proyecto corrigió con la densidad.

Verificado: una medición aparecía como *«Sin calibración vigente a esa fecha»*; al cargar la calibración que faltaba pasó a *«Con calibración vigente»* **sin tocar el ensayo**.

## Los tres respaldos posibles

| Respaldo | Cuándo |
| --- | --- |
| `CALIBRADO` | una calibración conforme cubría esa fecha |
| `EN_DUDA` | la cubría, pero la verificación **siguiente** salió fuera de tolerancia |
| `SIN_RESPALDO` | ninguna calibración conforme cubría esa fecha |

`EN_DUDA` es el caso clásico: si el instrumento se encontró fuera de tolerancia, **todo lo medido desde su última calibración buena queda en cuestión**. Nadie podía saberlo entonces.

Distinto es lo medido **después** de esa verificación fallida: ahí ya se sabía que el instrumento estaba mal, así que no queda en duda — queda sin respaldo.

El sistema **informa, no dictamina**. Si una medición en duda invalida el lote, obliga a reensayar o no cambia nada, es criterio de calidad y no se decide desde acá.

### Un defecto que encontró la prueba

La primera implementación devolvía `EN_DUDA` para una medición **posterior** a la verificación fallida, y además dependía del orden en que la base devolviera las calibraciones —tomaba «la primera que encajara» en vez de la más reciente—. Las dos cosas están corregidas, con una prueba que compara el resultado contra el historial invertido.

## Verificación en navegador (`erp_dev`)

1. El plan de inspección gana columna de **Instrumento**, con `DM-01 — Densímetro digital` disponible.
2. La ficha del instrumento contesta la pregunta del ciclo:

   | Lote | Fecha del ensayo | Medición | Valor | Respaldo |
   | --- | --- | --- | --- | --- |
   | LG-00004 | 16 set. 2026 | Densidad a 15 C | 0.8814 kg/L | Sin calibración vigente a esa fecha |

3. Se carga la calibración que faltaba (2 jun. 2026 → 2 jun. 2027) y la misma fila pasa a **«Con calibración vigente»**, con el instrumento en **«Calibrado»**. El ensayo no se tocó.

`tests/trazabilidad-instrumento.test.ts`: 20 pruebas, incluida una que recorre la cadena contra filas reales y comprueba que borrar el instrumento **no borra el ensayo** — la medición es un hecho y queda con `instrumentoId` en `null`.

## Lo que queda fuera, y por qué

- **No se bloquea ni se advierte al liberar un lote** con un instrumento sin calibración vigente. Si corresponde bloquear —parando la liberación— o solo advertir es criterio de calidad, y el negocio lo decidirá cuando el laboratorio opere. El sistema ya tiene todo lo necesario para hacerlo el día que lo decidan.
- **El certificado de análisis no menciona el instrumento.** Es información interna por ahora; incluirla en un documento que va al cliente es una decisión que no corresponde tomar acá.
- **La ficha muestra las últimas 50 mediciones.** Con volumen real hará falta paginarlas o filtrarlas por fecha.
- **No hay una pantalla que liste, ante una calibración fallida, todos los lotes afectados de una vez.** Hoy se ven por instrumento; la consulta «qué hay que reensayar» todavía se arma a mano.
