# Incidencias contables: el fallo de posteo deja de ser silencioso

Cierra el pendiente más accionable del Blueprint 05: *"Alerta activa cuando una transacción no generó asiento por `ControlContable` faltante — hoy es silencioso"*.

## El problema

`postearAsiento()` es **best-effort a propósito**, y esa decisión sigue siendo la correcta: cuando falta un control contable, el período fiscal está cerrado o el presupuesto del centro de costo se excede, la operación comercial **no se revierte**. El documento ya existe, el stock ya se movió, el cliente ya tiene su factura; anular todo eso porque el contador no configuró una cuenta sería peor que el problema.

Lo que faltaba era el rastro. La función devolvía `{ ok: false, motivo }` y **casi todos los llamadores descartaban el resultado**: de los 83 puntos de llamada, solo `finanzas/centros-costo/actions.ts` mostraba el motivo al usuario. Una venta podía registrarse sin su asiento y nadie se enteraba hasta cuadrar libros, semanas después, sin saber cuál de las operaciones del mes fue.

## La solución

Un modelo `IncidenciaContable` y, sobre todo, **quién lo escribe**:

> La incidencia la registra `postearAsiento()` misma, no el llamador.

Esa es la decisión de diseño que importa. Pedirle a 83 llamadores que atiendan un valor de retorno es exactamente cómo se perdió el aviso la primera vez; un llamador nuevo que se olvide reintroduce el defecto sin que nada falle. Al ponerlo dentro de la función, el aviso es **imposible de saltarse por omisión**.

Los cinco caminos de fallo pasan hoy por un único helper interno:

```ts
const sinAsiento = async (motivo: string) => {
  await tx.incidenciaContable.create({ data: { empresaId, origen, glosa, referencia, motivo, ... } });
  return { ok: false as const, motivo };
};
```

El contrato con el llamador **no cambia**: sigue devolviendo el mismo `{ ok: false, motivo }` de siempre, así que ninguna operación existente altera su comportamiento.

### Se escribe dentro de la transacción de la operación

Es deliberado. Si la operación comercial hace rollback, la incidencia desaparece con ella — no queda el aviso de un asiento que al final nunca hizo falta. Cubierto por prueba.

### Resolver no borra

Una incidencia se marca resuelta cuando el contador ya posteó el asiento a mano o configuró lo que faltaba. La fila **se conserva**, con quién la cerró, cuándo y con qué nota. El rastro de que hubo un hueco en la contabilidad no se borra.

La nota de resolución es obligatoria: el sistema no puede verificar que el asiento manual se hizo —un asiento manual no lleva vínculo con la incidencia—, así que lo mínimo es que quede escrito qué se hizo.

## Dónde se ve

- **`/finanzas/incidencias-contables`** (Finanzas → Contabilidad): lista las abiertas con fecha, origen, glosa, referencia, **por qué no se posteó** y quién registró la operación. Filtro por abiertas/resueltas y búsqueda por glosa, referencia o motivo.
- **Panel general**: el semáforo de Finanzas pasa a **crítico** cuando hay operaciones sin asiento, por encima de las facturas vencidas. Una factura vencida es gestión de cobranza; una operación sin asiento son libros que no cuadran, y el hueco no se cierra solo.

Que el aviso esté en el panel general es la mitad que faltaba: una pantalla que hay que visitar no alerta de nada si nadie sabe que tiene que visitarla.

## Motivos que se registran

| Motivo | Qué hacer |
|---|---|
| `Controles contables sin configurar: X, Y` | Configurar esas claves en Finanzas → Plan de cuentas |
| `Período fiscal M/AAAA cerrado` | Reabrir el período o postear el asiento en el período corriente |
| `Asiento descuadrado (debe X vs haber Y)` | Revisar los importes de la operación de origen; suele indicar un defecto de cálculo |
| `Asiento con menos de dos líneas` | Igual que el anterior: la operación no produjo importes válidos |
| `Presupuesto excedido en centro de costo C` | Ampliar el presupuesto del centro/período o reclasificar el gasto |

## Verificación

**9 pruebas nuevas** (187 en total) sobre base efímera:

- control faltante, período cerrado y asiento descuadrado dejan incidencia con su motivo exacto;
- un asiento que sí postea **no** deja ninguna;
- una operación que hace rollback se lleva su incidencia;
- las incidencias quedan acotadas a su compañía;
- resolver deja constancia, no borra, y resolver dos veces no cuenta dos veces (la condición `resueltoEn: null` es lo que impide que dos personas la cierren a la vez).

**Guardia estructural**: una prueba lee el cuerpo de `postearAsiento()` y falla si aparece una salida `return { ok: false }` que no pase por `sinAsiento()`. Sin ella, agregar un camino de fallo nuevo reintroduce el silencio sin que TypeScript ni lint digan nada — que es precisamente cómo nació este defecto. **Se verificó que la guardia falla de verdad** revirtiendo a mano uno de los cinco caminos antes de darla por buena.

## Alcance: lo que esto no hace

- **No reintenta el posteo automáticamente.** Un reintento a ciegas puede postear en un período que el contador cerró a propósito, o con una cuenta configurada de apuro. Cerrar la incidencia es un acto deliberado de quien lleva los libros.
- **No vincula el asiento manual con la incidencia.** El contador anota el número en la nota de resolución; el sistema no lo valida.
- **No cubre los fallos anteriores a este cambio**: las operaciones que ya quedaron sin asiento no tienen incidencia retroactiva, porque no hay de dónde deducirlas. El balance de comprobación sigue siendo la herramienta para encontrarlas.
