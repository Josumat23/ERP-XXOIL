# De un material recibido a los clientes que lo tienen

La ficha del lote ya contestaba la pregunta **hacia atrás**: «¿de qué recepciones salió este lote?». Faltaba la de **ida**:

> ¿Qué se fabricó con este material, y dónde está?

Es la consulta del día que un proveedor avisa de un problema con su lote, o del día que una inspección de entrada queda sin respaldo porque el instrumento estaba descalibrado. Sin ella la respuesta se arma lote por lote y a mano, que con volumen real significa que no se arma.

## Es una consulta, no un control

El negocio fue explícito: **todo tiene que estar relacionado, y la solución no puede ser bloqueante**. Así que esto no exige nada, no frena ningún proceso y no agrega un paso a nadie. Solo recorre una cadena que ya existía en la base y que nadie estaba recorriendo.

La prueba lo comprueba literalmente: después de consultar, el saldo de la recepción sigue donde estaba.

## Dónde vive

En la misma pantalla de **Trazabilidad / recall**, como segunda dirección, y no en una pantalla nueva. Es la misma pregunta —«¿a quién le llegó esto?»— entrando por el otro extremo de la cadena; separarlas obligaría a saber de antemano por cuál extremo se entra.

```
recepción de compra → asignaciones → lote granel → envasados → facturas → clientes
        ◄──────────────── ficha del lote ─────────┘
        └──────────────── esta pantalla ────────────────────────────────►
```

## Tres decisiones que cambian lo que se ve

**El consumo es lo asignado menos lo devuelto.** Un material que se asignó a un lote y volvió al almacén no es un consumo; mostrarlo sería acusar a ese lote de llevar algo que nunca llevó. La resta ya existía dentro de `devolverLoteInsumo` y hacía falta acá: se extrajo a `netoConsumido` en vez de copiarse, para que las dos digan lo mismo.

**Los clientes se cuentan como conjunto, no sumando.** Un mismo cliente puede haber recibido producto de dos lotes distintos. Sumar el conteo de cada lote diría que el problema alcanza a más gente de la que alcanza — el error exacto que no se puede cometer al decidir un recall. Verificado con datos reales: tres lotes con 4, 5 y 4 clientes dan **5 clientes alcanzados**, no 13.

**Primero lo que ya salió al cliente**, aunque lleve menos material; después, el que más llevó. Ahí el problema dejó de ser de almacén.

## Verificación en navegador (`erp_dev`)

Recepción `RC-00001` de aceite base mineral 500N, de Química Industrial Andina S.A.:

| | |
| --- | --- |
| Recibido | 300.000 kg |
| Sin consumir | 0.000 kg |
| **Lotes fabricados** | **3** |
| **Clientes alcanzados** | **5** |

| Lote fabricado | Producto | Estado | Material usado | Hasta dónde llegó |
| --- | --- | --- | --- | --- |
| LG-00002 | Grasa Chasis | Aprobado | 176.000 kg | 4 unidades en 4 clientes |
| LG-00001 | Grasa Chasis | Aprobado | 88.000 kg | 120 unidades en 5 clientes |
| LG-00003 | Grasa Chasis | Aprobado | 36.000 kg | 54 unidades en 4 clientes |

Los 5 clientes alcanzados frente a los 4 + 5 + 4 de las filas son la cuenta por conjunto funcionando sobre datos reales.

Cada fila enlaza al recall de ese lote, que lista cliente por cliente con su factura.

`tests/trazabilidad-insumo-a-cliente.test.ts`: 13 pruebas.

## Una limitación declarada que esto elimina

La lista de «Qué hay que reensayar» decía, para una inspección de recepción sin respaldo: *«Qué lotes lo usaron todavía se consulta lote por lote»*. Ahora enlaza directamente a esta consulta.

## Lo que queda fuera, y por qué

- **El selector lista las 200 recepciones más recientes que ya entraron en producción.** Ofrecer las que nunca se consumieron llenaría la lista de opciones que no contestan nada. Con volumen real hará falta buscar por insumo o por lote del proveedor en vez de un selector.
- **No agrupa por lote del proveedor.** Si un mismo lote del proveedor llegó en dos recepciones, hoy se consultan por separado.
- **No hay alerta automática.** Nadie recibe un aviso porque un material haya llegado lejos: hay que venir a preguntar. Convertir esto en alerta sería decidir un criterio de calidad que nadie pidió.
