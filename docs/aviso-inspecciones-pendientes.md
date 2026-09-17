# Inspecciones de entrada que nadie resolvió

Este ciclo existe por un efecto secundario del anterior, y vale la pena decirlo así.

Mientras la recepción **retenía** el material, una inspección olvidada se hacía notar sola: producción venía a reclamar su materia prima. Esa presión era el único mecanismo que hacía que alguien mirara la bandeja de inspecciones.

Al quitar el bloqueo, la presión desapareció. **El material fluye, y por eso mismo es más fácil olvidar la inspección.**

Quitar un bloqueo sin poner una alerta es cambiar un problema visible por uno invisible. Esta es la alerta.

## Qué dice, y cuándo

| Situación | Severidad | Mensaje |
| --- | --- | --- |
| Alguna recepción **retenida** (control en `BLOQUEA`) | **Crítico** | «N recepciones retenidas esperando calidad» |
| Pendientes sin retener (control en `ADVIERTE`) | Atención | «N inspecciones de entrada pendientes» |
| Ninguna pendiente | — | no dice nada |

Una recepción retenida es crítica porque hay **materia prima parada en el almacén esperando una firma**. Las demás son trabajo acumulado del laboratorio, no una planta parada.

La severidad sale de los datos —si hay o no material retenido—, no del nivel configurado. Es más honesto: dice lo que está pasando, no lo que la configuración permitiría que pasara.

## La antigüedad va en el mensaje

«2 inspecciones pendientes» no dice nada. **«2 pendientes, la más antigua de 45 días»** sí: distingue una bandeja al día de una bandeja abandonada. Es lo que convierte el aviso en algo accionable.

## Dos decisiones de dónde ponerlo

**Fuera del interruptor de calibración.** Una inspección de entrada sin resolver es trabajo pendiente con o sin laboratorio en régimen. Colgarla del interruptor la escondería justo en la empresa que todavía no encendió nada — que es donde más se olvida.

**Antes de las homologaciones, y no por casualidad.** El semáforo muestra una línea por módulo y, entre señales de la misma severidad, gana la primera.

Puesta después, **este aviso no se veía nunca**: lo comprobé en el navegador antes de reordenarlo — la fila de Calidad mostraba «1 homologación vencida» y la inspección de 12 días quedaba invisible.

El criterio: una inspección sin resolver es trabajo no hecho sobre material que **ya está en producción**; una homologación vencida es documentación que dejó de imprimirse. Las dos avisan; una de las dos se puede hacer hoy.

Hay una prueba que fija ese orden, con el motivo escrito.

## Verificación en navegador (`erp_dev`)

Con una inspección pendiente de 12 días, sin material retenido:

> **Calidad** · «1 inspección de entrada pendiente (la más antigua, 12 días)» · **Atención**

Antes de reordenar, esa misma fila decía «1 homologación vencida» y el aviso no aparecía.

`tests/aviso-inspecciones-pendientes.test.ts`: 9 pruebas.

## Lo que queda fuera, y por qué

- **No hay un umbral de días que escale a crítico.** «A los N días sin inspeccionar esto es grave» es un criterio de calidad, y no lo invento. Hoy lo grave es que haya material retenido; la antigüedad se informa para que alguien juzgue.
- **No hay aviso por correo ni recordatorio.** El sistema no manda nada a nadie: muestra el estado a quien entra.
- **El semáforo sigue mostrando una sola línea por módulo.** Con varias cosas pendientes a la vez, la de menor severidad queda tapada. Es un límite de diseño del panel, no de esta señal.
