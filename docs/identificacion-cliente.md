# Quién es el cliente, y en qué estado está

Bloque 1 del maestro. Dos huecos, y el segundo tenía consecuencias.

## El maestro no sabía si el cliente era una persona o una empresa

De ese dato dependen dos cosas que el sistema ya hace: **qué comprobante se emite** y **qué documento puede tener**. Se estaba infiriendo del número, contando dígitos.

Ahora `tipoPersona` es NATURAL o JURIDICA, y hay reglas que impiden que las dos declaraciones se contradigan:

- Una **persona jurídica no se identifica con DNI, carné de extranjería ni pasaporte**.
- **El RUC y el tipo de persona no pueden contradecirse.** SUNAT estructura el RUC con dos dígitos iniciales que dicen qué es el contribuyente: **10** persona natural, **20** persona jurídica.

Esa última regla juzga **solo esos dos prefijos**. Existen otros (15, 17…) con historia y excepciones, y clasificarlos por cuenta propia sería inventar una regla tributaria: quedan sin juzgar y no bloquean la carga.

Tampoco se valida dígito verificador ni se consulta a SUNAT: **no hay servicio conectado**. Lo único que se comprueba es lo que se puede comprobar con los datos a la vista, que es que no se contradigan entre sí.

Se agregaron al catálogo de documentos los que faltaban para el caso peruano: **DNI**, **carné de extranjería** y **pasaporte**, con sus códigos del Catálogo 06 de SUNAT anotados.

## Dos controles distintos, no uno

`activo` era un booleano. El negocio pidió **ACTIVO / BLOQUEADO / INACTIVO**, y ahí apareció la decisión de diseño de este ciclo: ya existía `bloqueadoCobranza`, que también impide vender.

**Se dejan ortogonales a propósito.**

| | `estado` | `bloqueadoCobranza` |
| --- | --- | --- |
| Quién lo pone | Una persona, con motivo | El sistema, por deuda vencida |
| Quién lo levanta | Ventas, en el maestro | Finanzas, en Cobranza |
| Qué significa | Falta documentación, orden de legal | Tiene facturas vencidas sin regularizar |

Fundirlos habría hecho que **regularizar una deuda desbloquee a un cliente que legal había frenado**, que es exactamente lo que un control no debe permitir. Para vender hay que pasar los dos, y eso lo resuelve una sola función, `motivoNoOperable`, que el pedido consulta.

El orden del mensaje importa: un cliente inactivo **y** con deuda tiene un problema más grande que la deuda, así que se le nombra ese.

**Bloquear o desactivar exige motivo** — es lo que va a leer quien lo reactive — y queda registrado quién y cuándo. Reactivar no necesita explicación.

## La migración traduce dentro del INSERT

Quitar una columna en SQLite obliga a reconstruir la tabla: se crea la nueva, se copia, se borra la vieja y se renombra. Si la traducción fuera un `UPDATE` posterior, **ya no habría de dónde leer `activo`** — la tabla que lo tenía se borró en el mismo paso — y todos habrían quedado ACTIVO, incluidos los dados de baja.

Por eso va dentro del propio `INSERT ... SELECT`:

```sql
CASE WHEN "activo" = 1 THEN 'ACTIVO' ELSE 'INACTIVO' END,
CASE
  WHEN "tipoDocumentoFiscal" = 'RUC' AND "ruc" LIKE '10%' AND LENGTH("ruc") = 11 THEN 'NATURAL'
  WHEN "tipoDocumentoFiscal" = 'RUC' AND "ruc" LIKE '20%' AND LENGTH("ruc") = 11 THEN 'JURIDICA'
  ELSE NULL
END
```

`BLOQUEADO` no sale de la migración: es una decisión de una persona, y nadie la ha tomado todavía.

Se ejerció contra una base sombra con cinco casos —empresa, persona natural, dado de baja, sin documento y extranjero— y los cinco se traducen como corresponde. En la base local, los cinco clientes quedaron ACTIVO/JURIDICA.

## Una guardia que no miraba nada

La prueba que comprueba que `Cliente` no vuelva a tener `activo` cortaba el esquema entre `model Cliente` y `model DireccionCliente`. Pero `DireccionCliente` está **antes** en el archivo, así que el corte quedaba **vacío** y la prueba pasaba sin mirar nada.

Corregido el corte, y agregada la comprobación de que el texto examinado no esté vacío — la misma lección de las otras guardias: una que pasa porque dejó de mirar es peor que ninguna.
