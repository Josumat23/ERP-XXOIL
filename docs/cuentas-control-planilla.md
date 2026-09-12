# Cuentas de control de planilla

Salda la deuda que dejó anotada la guardia de claves de control del 2026-09-13.

## El defecto

Seis claves de `ControlContable` se usaban en los asientos de **planilla, gratificación, CTS y liquidación**, pero **nunca se sembraron**:

| Clave | Qué representa |
|---|---|
| `GASTO_PERSONAL` | Remuneración y EsSalud de cargo del empleador |
| `ESSALUD_POR_PAGAR` | Aporte patronal por pagar |
| `ONP_AFP_POR_PAGAR` | Descuento previsional retenido |
| `RETENCION_5TA_POR_PAGAR` | Renta de quinta retenida al trabajador |
| `SUELDOS_POR_PAGAR` | Neto que se le debe al trabajador |
| `CTS_POR_PAGAR` | CTS por depositar |

Como `postearAsiento` es **best-effort** —la operación comercial no se revierte si falta un control contable—, nada fallaba: el asiento se descartaba entero y solo quedaba la `IncidenciaContable`. En una instalación nueva, **la contabilidad de planilla no salía**, y solo se notaba al cuadrar libros.

Es la tercera aparición de la misma clase de defecto, después de `seed-ubigeos.ts` que nadie ejecutaba y del almacén de tipo `PLANTA` que el seed no creaba.

## Por qué la suite no lo veía

Dos razones, y las dos valen más que el arreglo:

**1. La prueba de planilla fabrica sus propias cuentas y controles.** `critical-flows` crea cuentas `TEST-*` y reapunta los seis controles a ellas antes de postear. Construía justo lo que producción no tenía, y pasaba en verde. Una prueba que se trae su propia configuración no puede detectar que la configuración falta.

**2. La guardia que encontró el defecto tenía un agujero.** Su expresión era `[A-Z_]+`, así que **cualquier clave con un dígito era invisible**: no se contaba como usada ni como sembrada, y pasaba sin que nadie la mirara. Por eso el reporte original decía cinco claves; eran **seis** — `RETENCION_5TA_POR_PAGAR` se descubrió recién al ir a saldar la deuda. La clase de carácter ahora es `[A-Z0-9_]+`, y hay una aserción que falla si esa clave vuelve a quedar fuera del conjunto.

## Las cuentas

| Clave | Cuenta | Naturaleza |
|---|---|---|
| `GASTO_PERSONAL` | 6211 Sueldos y salarios | Gasto |
| `ESSALUD_POR_PAGAR` | 4031 EsSalud por pagar | Pasivo |
| `ONP_AFP_POR_PAGAR` | 4032 ONP / AFP por pagar | Pasivo |
| `RETENCION_5TA_POR_PAGAR` | **40173** Renta de quinta categoría por pagar | Pasivo |
| `SUELDOS_POR_PAGAR` | 4111 Sueldos y salarios por pagar | Pasivo |
| `CTS_POR_PAGAR` | 4151 CTS por pagar | Pasivo |

Son un **valor inicial razonable del PCGE, no una afirmación**: el control se reapunta desde **Finanzas → Plan de cuentas**, que es donde el contador decide. Una prueba exige que las seis claves tengan etiqueta, porque sin etiqueta no aparecen en esa pantalla y la cuenta sembrada dejaría de ser inicial para volverse fija.

**40173 es la única cuenta de cinco dígitos del plan sembrado.** En cuatro, el 4017 es «Impuesto a la renta» a secas, y ahí terminaría mezclada la plata retenida a los trabajadores con el impuesto propio de la empresa. Son dos cosas distintas y no pueden compartir cuenta.

## Una simplificación que queda a la vista

`GASTO_PERSONAL` absorbe la remuneración **y** el EsSalud de cargo del empleador, porque el asiento usa una sola clave para los dos. En el PCGE el aporte patronal va a 627 y no a 621.

No se arregló aquí: separarlo cambia cómo postea el módulo de planilla, y eso es trabajo de ese módulo. Se ve en el asiento real de la verificación —2500 de sueldo y 225 de EsSalud patronal, ambos en 6211— y queda como tarea aparte.

## La migración

El seed solo corre en instalaciones nuevas; sin migración, una base ya instalada se quedaba sin los controles para siempre. La migración los crea con el mismo patrón idempotente que se usó para `INGRESO_PENALIDAD`:

- Cada control apunta a la cuenta del plan de **su propia compañía**, no a una ajena.
- **No pisa nada**: si una compañía ya tenía la cuenta 6211 con otro nombre, o el control ya configurado, se respetan.
- Repetirla no duplica.

Probado sobre una base con **dos compañías**, una de ellas con un 6211 propio llamado «Remuneraciones» y su control ya apuntado: las dos terminaron con los seis controles, cada uno contra su propio plan, y el nombre personalizado quedó intacto.

## Verificación

**5 pruebas** (336 en total): que una instalación recién sembrada tenga los seis controles contra cuentas activas, que el plan traiga las seis cuentas con su naturaleza correcta, que postear las seis claves produzca un asiento cuadrado sin incidencias, que cada clave tenga etiqueta, y que la migración cubra las compañías existentes sin pisar nada.

Las aserciones se escribieron **contra el plan de cuentas y no contra el control**, precisamente porque la prueba de planilla de `critical-flows` reapunta esos controles a sus fixtures y la suite comparte base. Comprobar el control habría sido una prueba que depende del orden de ejecución.

**En navegador**, sobre una base de demostración nueva con un empleado en ONP y S/ 2 500 de básico, se generó la planilla del mes desde su pantalla:

- La cabecera muestra **«asiento contable AS-00096»** — antes no se generaba ninguno.
- El asiento quedó cuadrado en **S/ 2 725**: 6211 debe 2 500 + 225; 4032 haber 325 (ONP 13%); 4031 haber 225 (EsSalud 9%); 4111 haber 2 175 (neto).
- **Cero incidencias contables.**

## Hallazgo menor, no corregido

La pantalla de planilla muestra el error crudo de Prisma cuando algo falla —durante la preparación de datos apareció un `Invalid prisma.empleado.findMany() invocation ... Value 'INDEFINIDO' not found in enum 'TipoContrato'` completo, con ruta de archivo incluida—. Es comportamiento preexistente de esa pantalla y no de este ciclo; queda anotado.
