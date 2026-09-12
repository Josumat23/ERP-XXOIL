# Nota de débito por aumento de valor y penalidad

Completa el Catálogo 10 de SUNAT. Hasta ahora el sistema solo emitía el **tipo 01 (interés por mora)**; los tipos 02 y 03 estaban en el enum sin usarse, esperando que el negocio confirmara si los emite. El **2026-09-13 lo confirmó: emite los dos**.

## Lo que el sistema aporta y lo que no

El tipo 01 el sistema **lo calcula**: tiene la tasa configurada, la fecha de vencimiento y los días transcurridos, así que puede decir cuánto es el recargo sin que nadie se lo diga.

Los tipos 02 y 03 no. Cuándo corresponde un ajuste de precio o una penalidad, y sobre qué base, es criterio del negocio y de su contrato con el cliente. Así que **el sistema aporta el mecanismo y la persona aporta el concepto y el importe** — el mismo reparto que ya se usó en el checklist de cierre de período.

Esto no es una limitación: es lo que evita que el ERP invente una regla comercial que nadie le pidió.

## La asimetría contable, que es lo importante

| | Tipo 01 (mora) | Tipos 02 y 03 |
|---|---|---|
| ¿Aumenta el saldo de la factura? | **No** | **Sí** |
| ¿Postea asiento? | **No** | **Sí** |

Parece contradictorio y no lo es. **El recargo por mora ya aumentó el saldo y ya posteó su asiento cuando se aplicó** (`aplicarRecargoAFactura`, con origen `RECARGO_MORA`): su nota de débito solo lo *documenta*, y volver a cargar sería cobrarlo dos veces.

Un aumento de valor o una penalidad **no existían** hasta que alguien los emite. Aquí el documento **es** el hecho económico, y por eso sí carga y sí postea.

Dos guardias estructurales protegen las dos mitades: que la de mora siga sin tocar saldo ni contabilidad, y que la manual sí haga ambas cosas.

## La afectación al IGV no tiene valor por defecto

El formulario pide **¿el concepto está afecto al IGV? Sí / No**, sin ninguna opción premarcada, y el servidor rechaza el envío si no se declaró.

Es deliberado. Que un concepto esté afecto es criterio tributario, y no es el mismo para un ajuste de precio sobre una venta gravada que para una penalidad indemnizatoria. Una casilla premarcada estaría decidiendo por el contador, en silencio, algo con consecuencias ante SUNAT. Aquí sí valía la pena el clic extra — a diferencia de otros valores por defecto de este sistema, que orientan sin comprometer.

La **nota por mora conserva su tratamiento**: base igual al monto, sin IGV, que es como se venía emitiendo. Este ciclo no reinterpreta lo ya emitido.

## Imputación contable

| Tipo | Debe | Haber |
|---|---|---|
| Aumento de valor | Cuentas por cobrar (total) | Ventas (base) + IGV por pagar |
| Penalidad u otros | Cuentas por cobrar (total) | **Otros ingresos de gestión** (base) + IGV por pagar si aplica |

Un aumento de valor es más valor de la misma venta, así que va a `VENTAS`. Una penalidad **no es venta ni interés**, así que tiene control propio: `INGRESO_PENALIDAD`, sembrado en 7599. La cuenta exacta es criterio del contador y el control se reapunta desde **Finanzas → Plan de cuentas**; lo sembrado es un valor inicial, no una afirmación.

Si el IGV es cero, la línea no se agrega: un renglón en cero solo ensucia el asiento.

## Detalles del modelo

`recargoMoraId` pasó a ser **opcional**, porque las notas manuales no nacen de ningún recargo. El índice único se conserva y sigue funcionando: SQLite y PostgreSQL tratan cada `NULL` como distinto, de modo que muchas notas pueden no tener recargo mientras un recargo sigue admitiendo una sola nota.

La clave foránea se declaró **`Restrict`** y no el `SET NULL` que Prisma pone por defecto en una relación opcional: una nota que quedara con `NULL` al borrarse su recargo sería indistinguible de una emitida a mano, que es exactamente lo contrario de lo que documenta.

El relleno de la migración deja las notas existentes con `baseImponible = monto`, `igv = 0`, `afectoIgv = false` — su comportamiento real, no una reinterpretación.

## Un defecto que apareció de paso

Al agregar una guardia que exige que **toda clave de control usada en un asiento esté sembrada**, aparecieron cinco que no lo están: `GASTO_PERSONAL`, `ONP_AFP_POR_PAGAR`, `ESSALUD_POR_PAGAR`, `SUELDOS_POR_PAGAR` y `CTS_POR_PAGAR`. En una instalación nueva, **los asientos de planilla no salen** — la operación no falla porque el posteo es best-effort, así que solo queda la incidencia contable.

Es la tercera aparición de la misma clase de defecto en este repositorio, después de `seed-ubigeos.ts` que nadie ejecutaba y del almacén de tipo `PLANTA` que el seed no creaba.

**No se arregló aquí**: elegir sus cuentas del PCGE es trabajo del módulo de planilla, no del de notas de débito, y mezclarlo habría metido una decisión contable ajena en este ciclo. Queda anotado en la guardia, que falla si alguien lo da por resuelto sin quitarlo de la lista, y falla ante cualquier clave nueva.

## Verificación

**12 pruebas** (304 en total): los tipos manuales, el cálculo del IGV con y sin afectación, el redondeo, que la afectación no se pueda omitir, las validaciones de importe y motivo, que varias notas convivan sin recargo, y las guardias — la asimetría de las dos acciones, la compañía activa y el reclamo optimista, la cuenta de penalidad sembrada, y la guardia general de claves de control.

**En navegador**, sobre una base de demostración nueva:

| Caso | Resultado |
|---|---|
| Emitir sin declarar afectación al IGV | El navegador lo bloquea; el servidor también lo rechaza (prueba) |
| Penalidad S/ 500, no afecta | Saldo 118 → **618**; asiento CxC 500 / **7599** 500 |
| Aumento de valor S/ 200, afecto | Saldo 256.65 → **492.65**; asiento CxC 236 / **7011** 200 / **4011** 36 |
| Total de la factura | **Sin cambios** en ambos casos: la nota no reescribe la factura original |
| Incidencias contables | **Cero** |

## Lo que queda pendiente

El **envío a SUNAT** de la nota de débito sigue bloqueado por el certificado digital real, igual que la de mora y la boleta. Es autorización externa, no desarrollo.
