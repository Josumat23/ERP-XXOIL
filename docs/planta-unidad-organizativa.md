# Planta como unidad organizativa (ítem 0.3)

Hasta ahora "planta" no era un concepto del modelo: un `Almacen` hacía de planta solo por tener un `CalendarioProduccion` asociado, o un `CentroCosto` de tipo `PRODUCCION` apuntándole. Era una convención de uso, no una regla de datos (Blueprint 03 §2).

## El campo

`Almacen.tipo` con tres valores, los que fija el diccionario de campos faltantes (Blueprint 05, fila `tipo`/`rol`, P0):

| Valor | Qué es |
| --- | --- |
| `PLANTA` | Fabrica. Aporta capacidad de producción. |
| `ALMACEN_DISTRIBUCION` | Guarda y despacha, no fabrica. Es el valor por defecto. |
| `ALMACEN_TRANSITO` | Paso intermedio de mercadería. |

## La migración no cambia el comportamiento

El relleno traslada la convención anterior: un almacén con `CalendarioProduccion` queda como `PLANTA`, el resto como `ALMACEN_DISTRIBUCION`.

```sql
CASE WHEN EXISTS (SELECT 1 FROM "calendarios_produccion"
                  WHERE "calendarios_produccion"."almacenId" = "almacenes"."id")
     THEN 'PLANTA' ELSE 'ALMACEN_DISTRIBUCION' END
```

Como `horasDisponiblesEnRango` antes tomaba "todos los almacenes con calendario" y ahora toma "todas las plantas", y la migración marcó como plantas exactamente a aquéllos, el resultado de Proyecciones es idéntico el día del despliegue. Diverge recién cuando alguien reclasifica un almacén — que es justamente el punto.

## Dónde se ve

- **Configuración → Almacenes**: el rol se elige al crear y se cambia después con un selector propio (`actualizarTipoAlmacen`), separado del alta porque mover un almacén a planta es una decisión de estructura, no una corrección de datos. La pantalla muestra el conteo por rol y el rol de cada almacén.
- **Proyecciones**: el bloque "Capacidad de planta" suma solo plantas, y el desglose `porAlmacen` lista solo plantas.

## Qué no incluye

- **MRP por planta.** `logistica/mrp` netea a nivel compañía (`almacenId: null`). Hacerlo por planta exige decidir contra qué stock netea cada una, y eso depende de la pregunta abierta 2 del Blueprint 10: si una planta puede tener varios almacenes subordinados o si 1 planta = 1 almacén.
- **Jerarquía `plantaId`.** Es P1 en el diccionario de campos y depende de la misma pregunta. No se inventa una respuesta.

## Verificación

La suite crea una planta, un centro de distribución y un almacén de tránsito en una compañía propia, comprueba que el valor por defecto no convierte a nadie en planta, que listar plantas devuelve algo distinto de listar almacenes de distribución, y que la capacidad suma 40 h con una sola planta aunque los tres tengan calendario de 8 h diarias — y 80 h al reclasificar el centro de distribución como planta. Una segunda prueba lee el SQL de la migración y falla si se pierde el relleno por convención.
