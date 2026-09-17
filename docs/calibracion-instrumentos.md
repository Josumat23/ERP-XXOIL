# Calibración de los instrumentos del laboratorio

El negocio confirmó el **2026-09-17** que XXOIL está implementando su laboratorio. Ese es exactamente el disparador que la Oleada 3 del roadmap esperaba —*«incorporación de instrumentos de medición que la requieran»*— y la norma del repositorio es no construirla antes.

## Por qué importa más acá que en otro rubro

Desde el ciclo de la densidad, el densímetro produce el número que convierte kg en litros en **cada comprobante**. Una medición tomada con un instrumento descalibrado no se queda en el laboratorio: llega a la factura, al volumen declarado y al certificado de análisis que el cliente recibe.

## Las tres decisiones de diseño

### El instrumento no es un `Equipo`

Comparten identidad —código, marca, serie— pero no ciclo de vida. `Equipo` exige almacén, arrastra órdenes de mantenimiento, centro de trabajo y horómetro; un densímetro aparecería en pantallas donde no pinta nada. Modelo propio.

Queda dicho por si mañana conviene unirlos: si un instrumento necesita además mantenimiento, se le agrega la relación. Hoy sería un campo sin lector.

### La vigencia sale del certificado, no de una política

Cada calibración trae su `vigenteHasta`, que es lo que firmó quien calibró. La frecuencia del instrumento es **opcional** y solo sirve para sugerir la próxima fecha en pantalla.

Los sistemas que calculan «última calibración + frecuencia» terminan afirmando una vigencia que discrepa en silencio con el papel. Acá la frecuencia sugiere; el certificado manda.

### El interruptor gobierna el control, no el registro

`ConfiguracionEmpresa.controlCalibracion` nace en **false**, como pidió el negocio. Con el control apagado se pueden cargar instrumentos y calibraciones igual —hace falta mientras se implementa el laboratorio— pero el semáforo y los avisos quedan callados. Encenderlo es una acción con permiso y queda en la pantalla.

## Los estados, y por qué son cinco y no dos

| Estado | Qué significa |
| --- | --- |
| `SIN_CALIBRAR` | nunca se calibró: no debió usarse |
| `VIGENTE` | rige |
| `POR_VENCER` | rige, pero vence dentro de 30 días |
| `VENCIDA` | la fecha pasó: **no se sabe** si mide bien |
| `NO_CONFORME` | volvió fuera de tolerancia: **se sabe que no** mide bien |

`NO_CONFORME` **gana sobre la fecha**: un instrumento que volvió fuera de tolerancia no sirve aunque su certificado siga vigente. Es distinto de estar vencido, y por eso son dos estados y no uno.

Qué hacer con los ensayos ya hechos con un instrumento que volvió no conforme **lo decide calidad, no el sistema**. El sistema registra el hecho y lo hace imposible de no ver.

`CONFORME_CON_AJUSTE` —volvió dentro de tolerancia después de ajustarlo— es un instrumento usable, y se distingue para que el historial diga la verdad.

## El aviso deja de ser pasivo

Es la deuda que quedó anotada dos veces —homologaciones por vencer, equivalencias degradadas—: **una alerta que hay que ir a buscar no alerta a nadie**.

El semáforo del panel general gana una fila de **Calidad**, solo cuando el control está encendido. Un instrumento vencido, sin calibrar o fuera de tolerancia lo pone en **crítico**, no en aviso: lo que mida no se sostiene, y no se cierra solo.

Se avisa **30 días antes** del vencimiento porque calibrar toma semanas; avisar el día del vencimiento es avisar tarde.

## Verificación en navegador (`erp_dev`)

1. Pantalla nueva con el control en **«No aplica todavía»** y su explicación.
2. Cargado *DM-01 Densímetro digital, Anton Paar DMA 35, serie SN-77412*. Estado: **Sin calibrar**.
3. Calibración con la vigencia anterior a la fecha: rechazada — *«La vigencia no puede terminar antes de la fecha de calibración»*.
4. Calibración real ya vencida (1 jun. 2025 → 1 jun. 2026): estado **Calibración vencida**, y el aviso interno **no** aparece porque el control está apagado.
5. Panel general: **sin fila de Calidad**. El control apagado no mete ruido.
6. Activado el control: aparece *«1 instrumento activo no está en condiciones de usarse para liberar un lote»* y el panel general pasa a **`Calidad · 1 instrumento(s) sin calibración vigente · Crítico`**.

`tests/calibracion-instrumentos.test.ts`: 22 pruebas. Se verificó que la guardia detecta el defecto — al hacer que la fila del semáforo ignore el interruptor, falla con *«la fila no depende del interruptor»*.

## Lo que queda para el segundo ciclo

Esto es la mitad del trabajo, y es deliberado.

**Falta la trazabilidad**: qué instrumento midió qué en cada ensayo. Hoy el sistema sabe que el densímetro está vencido y sabe qué densidad se midió, pero no los une — no puede contestar *«¿qué lotes se liberaron con un instrumento descalibrado?»*.

Se dejó para después a propósito: esa conexión recién tiene sentido cuando haya ensayos reales con instrumentos reales, y el maestro con su control hace falta desde el primer día para poner el laboratorio en marcha.

También queda fuera, y por la misma razón, **bloquear o advertir al registrar calidad** con un instrumento sin calibración vigente. Si conviene bloquear —parando la liberación de un lote— o solo advertir es una decisión de calidad que el negocio tendrá que tomar cuando el laboratorio opere.
