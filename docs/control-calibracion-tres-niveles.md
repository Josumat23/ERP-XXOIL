# El control de calibración: tres niveles, no un interruptor

**Decisión del negocio, 2026-09-17.** Durante cuatro ciclos el sistema quedó esperando una respuesta: liberar un lote con un instrumento sin calibración vigente, ¿se **bloquea** o solo se **advierte**?

La respuesta fue que la pregunta estaba mal planteada. No son dos opciones sino **tres**, y la tercera es la que importa:

| Nivel | Qué hace |
| --- | --- |
| `NO_APLICA` | No se mira. Ni semáforo ni aviso al liberar. **Para que el proceso siga su curso.** |
| `ADVIERTE` | Avisa y deja pasar. El lote se libera y queda listado en «Qué hay que reensayar». |
| `BLOQUEA` | No deja liberar hasta que el instrumento tenga calibración. |

El principio que el negocio fijó: **el laboratorio no tiene que ser un bloqueante.**

## Por qué eso es lo correcto, y no una concesión

Un control de calidad que detiene la producción el día que alguien olvidó cargar un certificado **no se usa**: se apaga. Y cuando se apaga, se apaga todo lo demás con él — el semáforo, la lista de reensayo, la trazabilidad. Se pierde el 100 % de la información por exigir el 100 % del cumplimiento.

Por eso el sistema nace en `NO_APLICA` y **nunca** frena por omisión. Frenar es algo que la empresa elige, cuando el laboratorio ya está en régimen y el certificado que falta es una excepción y no la norma.

Es lo contrario de lo que suele venir configurado en un ERP, donde el bloqueo es el estado natural y lo primero que hace el implantador es desactivarlo.

## Dónde aplica, y dónde no

Aplica al **liberar un lote granel**, que es el punto donde el producto se vuelve vendible.

**No** aplica a la inspección de recepción ni al re-análisis de un envasado. Frenar una recepción detendría la cadena de suministro por un certificado de laboratorio, que es exactamente lo que el negocio dijo que no debe pasar. Si algún día se quiere extender, la decisión es de ustedes y no la toma el sistema.

En los tres casos la medición se registra igual y entra en «Qué hay que reensayar»: **lo que el nivel gobierna es el control, no el registro.**

## El aviso va antes, no después

Cuando el nivel es `ADVIERTE`, el aviso aparece **en el formulario, antes de liberar** — que es cuando todavía se puede medir con otro instrumento o cargar el certificado que falta. Una advertencia posterior solo informa de algo ya hecho.

Y el aviso de `BLOQUEA` dice **qué hacer**, no solo que no se puede:

> El instrumento DM-01 no tiene calibración vigente, y el control está en BLOQUEA. Cargue la calibración que falta en Instrumentos de medición, o baje el control a ADVIERTE si el negocio acepta liberar con esta medición.

Quien libera un lote a las once de la noche necesita saber si eso se resuelve con un certificado o llamando a alguien.

## El botón deshabilitado no es el control

El formulario desactiva el botón cuando el nivel bloquea. Eso es **comodidad**, no seguridad: el control real está en el servidor, que lee el nivel de la configuración de la compañía y no confía en lo que mande el navegador.

Verificado quitando a mano el `disabled` del botón y enviando igual: el servidor rechazó, el lote siguió `PENDIENTE_CALIDAD` y no se creó ningún control de calidad.

## Un interruptor que se reemplaza, no que convive

`ConfiguracionEmpresa.controlCalibracion` (booleano) se reemplaza por `nivelControlCalibracion`. No se dejan los dos: dos fuentes para el mismo hecho terminan discrepando, y es el defecto que este proyecto ya corrigió con la densidad.

La conversión es fiel a lo que hacía cada valor — encendido avisaba en el semáforo y no frenaba nada, que es exactamente `ADVIERTE`.

## Verificación en navegador, con datos reales

El lote **LG-00005** se llevó por el flujo completo, no por un atajo: se finalizó la cocción desde la orden de producción (48 kg) y pasó a `PENDIENTE_CALIDAD`. `DM-01` está fuera de tolerancia desde la verificación del 17 set.

1. **`BLOQUEA`** — al elegir `DM-01` el formulario avisa en rojo y desactiva el botón. Forzando el envío, el servidor rechaza. `LG-00005` sigue `PENDIENTE_CALIDAD`, sin control de calidad creado.
2. **`ADVIERTE`** — el mismo ensayo avisa en ámbar *«El lote se libera igual y queda listado en “Qué hay que reensayar”»*, el botón queda habilitado, y el lote se aprueba: densidad `0.88 kg/L` medida con `DM-01`.
3. El lote aparece acto seguido en la lista de reensayo, *«Todavía en almacén»* — exactamente lo que el aviso prometió.
4. **`NO_APLICA`** — se vuelve a ese nivel desde la pantalla y el semáforo se apaga.

`tests/control-calibracion-tres-niveles.test.ts`: 16 pruebas.

## Lo que queda fuera, y por qué

- **Ningún nivel está adoptado todavía.** La compañía quedó en `NO_APLICA`, que es donde nace. Elegir cuándo pasar a `ADVIERTE` o `BLOQUEA` es de ustedes; el sistema no lo decide ni lo sugiere solo.
- **El nivel es por compañía, no por producto ni por instrumento.** Un control más fino —bloquear solo en productos críticos, por ejemplo— es una decisión de calidad que nadie pidió todavía.
- **La inspección de recepción y el re-análisis no se bloquean nunca**, por lo dicho arriba.
