# Lo que falta desarrollar no frena la operación

Principio fijado por el negocio y repetido tres veces:

> «Igualmente no se debe bloquear la operación con lo que está pendiente desarrollar, ya que se puede agregar e integrar más adelante.»

Un módulo a medio construir que detiene el trabajo del día **se termina desactivando entero** — y con él se pierde también lo que sí funcionaba. Ese es el costo real, y es asimétrico: el bloqueo protege de un riesgo hipotético y destruye una capacidad cierta.

## El estado, auditado

Se revisó cada punto donde un dato maestro todavía sin cargar podría frenar algo:

| Situación | Qué pasa |
| --- | --- |
| Producto **sin plan de inspección** | Evaluación heredada: calidad decide a mano |
| Ensayo **sin instrumento** declarado | Se registra con `null` — «no se sabe», que es la verdad |
| Producto **sin densidad** cargada | No rompe: devuelve el motivo y quien la llama decide |
| Insumo marcado para inspección | El material **entra** y producción lo usa |
| Instrumento **sin calibración vigente** | No frena, salvo que la empresa encienda `BLOQUEA` |
| **Catálogo técnico vacío** | El certificado sale igual, sin esa sección |
| Pantallas nuevas **sin datos** | Abren y explican que todavía no hay nada |

**Ningún caso bloquea.**

## Por qué hacía falta una prueba

Estaba resuelto, pero como **doce decisiones sueltas**. Cada ciclo volvió a tomarla por su cuenta, y nada impedía que el próximo la tomara al revés.

De hecho ya había pasado: marcar un insumo como «requiere inspección» retenía el stock —el bloqueo más caro del sistema— **sin que nadie lo hubiera decidido**. Era el efecto secundario de una casilla del maestro de insumos, y sobrevivió hasta que alguien lo miró.

`tests/la-operacion-no-se-bloquea.test.ts` junta el principio en un solo lugar. **No prueba funcionalidad: prueba que nada frene.**

Incluye una guarda que comprueba que **ningún control nace en `BLOQUEA`** — lo contrario de lo que suele venir configurado en un ERP, donde el bloqueo es el estado natural y lo primero que hace el implantador es desactivarlo entero.

## Qué pasa si mañana algo sí debe frenar

Se enciende un control. Los dos que existen son explícitos, están en la configuración de la compañía, y cada nivel dice en pantalla qué hace:

| Control | Nace en | Dónde se cambia |
| --- | --- | --- |
| Calibración al liberar un lote | `NO_APLICA` | Producción → Instrumentos de medición |
| Inspección de lo que entra | `ADVIERTE` | Logística → Inspección de compras |

Lo que no va a pasar es que el comportamiento por omisión cambie sin que nadie lo decida. Eso ahora está verificado, no prometido.

## Lo que esta prueba NO garantiza

- **No cubre reglas de negocio legítimas.** Que un lote rechazado no se pueda envasar, o que una orden sobre el monto de aprobación espere a Gerencia, son controles que el negocio sí quiso. La prueba mira solo los bloqueos por *dato maestro faltante*.
- **No se ejecuta contra una base vacía.** Comprueba las rutas de código que contemplan el caso, no el comportamiento con el catálogo en cero. Hacerlo de verdad pediría una base de prueba sin sembrar, y hoy toda la suite comparte la que trae los maestros mínimos.
