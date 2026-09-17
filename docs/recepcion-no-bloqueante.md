# La inspección de entrada deja de retener el material

**Decisión del negocio, 2026-09-17:** todo insumo se compra y puede ir directo a producción, pase o no por laboratorio.

## El bloqueo que nadie había decidido

Hasta este ciclo, marcar un insumo como «requiere inspección» tenía una consecuencia que no estaba escrita en ninguna parte y que nadie eligió: **la recepción no ingresaba el stock**. Ni kardex, ni costo promedio, ni saldo disponible. La materia prima estaba físicamente en el almacén y producción no la podía consumir hasta que calidad la mirara.

Es el bloqueo más caro del sistema. Y era el efecto secundario de una casilla del maestro de insumos.

Ahora es el mismo control de tres niveles que ya rige la calibración, y **nace en `ADVIERTE`**:

| Nivel | Crea la inspección | Ingresa el stock |
| --- | --- | --- |
| `NO_APLICA` | no | sí |
| **`ADVIERTE`** (por omisión) | **sí** | **sí** |
| `BLOQUEA` | sí | no — el material espera |

`BLOQUEA` reproduce el comportamiento anterior, pero ahora es algo que alguien eligió.

## Dos decisiones que estaban colapsadas en una

- **`requiereInspeccion`, del insumo**, dice **si** se mira.
- **El nivel, de la compañía**, dice **cuánto pesa**.

Antes eran la misma cosa: marcar el insumo era, sin decirlo, elegir `BLOQUEA`. Un insumo que no requiere inspección entra directo en cualquier nivel.

## Lo que `ADVIERTE` no hace

**No apaga la inspección.** Se crea igual, queda pendiente, el laboratorio la resuelve cuando puede, y sus mediciones entran en «Qué hay que reensayar» como cualquier otro ensayo.

Lo único que cambia es que la planta no espera.

Si la inspección sale **rechazada** y el material ya se consumió, el sistema **no revierte solo**: deshacer un ingreso que producción ya usó dejaría el kardex mintiendo. Queda registrado, y qué hacer —devolución al proveedor, ajuste, reclamo— son flujos propios con sus propias consecuencias contables. **Para eso existe la trazabilidad de recepción a cliente**: contesta en el acto qué se fabricó con ese material y hasta dónde llegó.

## El material no entra dos veces

Con `ADVIERTE` el stock entró al recibirlo. Aprobar la inspección **no** lo vuelve a ingresar: sería el mismo material dos veces en el kardex y el costo promedio calculado sobre el doble de cantidad.

Lo garantiza `InspeccionCompra.stockIngresadoEnRecepcion`, que la recepción pone y la inspección consulta. Las inspecciones creadas antes de este cambio quedan en `false`, que es la verdad: nacieron cuando la recepción retenía, y su aprobación sigue siendo la que ingresa.

## Un solo tipo para los dos controles

El enum `NivelControlCalibracion` pasa a llamarse `NivelControl`: gobierna dos controles distintos —la calibración al liberar un lote y la inspección de lo que entra— y mantener dos enumeraciones idénticas es garantizar que diverjan.

## Verificación en navegador (`erp_dev`)

Orden de compra de 100 kg de aceite base mineral 500N, un insumo **marcado como «requiere inspección»**. La recepción se registró por la pantalla, con su factura y su lote de proveedor.

| | Antes | Después |
| --- | --- | --- |
| Stock del insumo | 2 272 kg | **2 372 kg** |
| Saldo disponible de la recepción | — | **100 kg** |
| Movimientos de kardex | — | **1** |
| Inspección | — | **PENDIENTE**, `stockIngresadoEnRecepcion = true` |

Con el comportamiento anterior, ese mismo material habría quedado en 0 disponible y sin movimiento de kardex.

Después se resolvió la inspección desde la pantalla, con `11.9 cSt` medidos con `DM-01`, resultado aprobado:

| | |
| --- | --- |
| Stock del insumo | **2 372 kg** — sin cambio |
| Movimientos de kardex de esa OC | **1** — sin duplicar |

`tests/recepcion-no-bloqueante.test.ts`: 13 pruebas.

## Lo que queda fuera, y por qué

- **El rechazo de material ya consumido no dispara nada automático.** No hay reversión, ni alerta, ni retención de los lotes que lo usaron. Cualquiera de esas cosas sería una decisión de calidad que nadie tomó; la consulta para decidirla ya existe.
- **El nivel es por compañía**, no por insumo ni por proveedor. Un proveedor nuevo en período de prueba podría justificar `BLOQUEA` solo para él, pero eso hay que pedirlo.
- **No hay aviso de inspecciones pendientes en el semáforo.** Con `ADVIERTE` el material fluye, así que una inspección olvidada ya no frena nada — y por eso mismo es más fácil olvidarla. Vale la pena mirarlo cuando haya volumen real.
