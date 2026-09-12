# Lista técnica de repuestos del mantenimiento preventivo

Cierra el pendiente del Blueprint 05 sobre `Equipo`: *lista de materiales técnica planificada, además del consumo real registrado en `RepuestoOrdenMantenimiento`. Útil para presupuestar mantenimiento antes de ejecutarlo.*

## Va en el plan, no en el equipo

El diccionario lo pedía sobre `Equipo`, pero un equipo no tiene "los repuestos que necesita": los necesita **por trabajo**. Un cambio de aceite lleva aceite y filtro; una calibración no lleva ninguno. La lista cuelga de `PlanMantenimiento`, que es donde el trabajo está definido, y de ahí sale el presupuesto: costo por ejecución × ejecuciones al año.

Es la misma distinción que SAP hace entre la lista de materiales del equipo y la de la hoja de ruta de la tarea.

## Separada del consumo real, a propósito

```prisma
model RepuestoPlanMantenimiento { planMantenimientoId, insumoId, cantidad, notas }
```

`RepuestoOrdenMantenimiento` sigue registrando lo que se consumió **de verdad**, y las dos tablas no se tocan.

**La orden generada desde un plan no se prellena con los repuestos previstos.** Prellenarla haría que el sistema diera por gastados repuestos que quizá no se usaron, y ese consumo mueve kardex y costo real. El plan es una previsión; qué se usó lo confirma el operario al cerrar la orden. Una prueba de la suite lo vigila: falla si el generador de órdenes preventivas empieza a escribir consumo.

Un repuesto aparece **una sola vez por plan** (`@@unique([planMantenimientoId, insumoId])`): si hacen falta cuatro unidades, van en la cantidad, no en cuatro filas.

## El presupuesto dice "no estimable", no cero

```ts
export function ejecucionesPorAnio(tipo, frecuenciaDias): number | null
```

Devuelve `null` —y la pantalla muestra *"anual no estimable"*— en dos casos:

- **Planes por contador.** Cuántas veces al año se hace un cambio cada 5000 km depende de cuánto se use el equipo. Suponerlo sería inventar un dato del negocio.
- **Frecuencia cero o negativa.** Es dato inválido, no "infinitas ejecuciones".

Un cero se lee como *"no cuesta nada"*, que es exactamente lo contrario de *"no se sabe"*. Cubierto por prueba.

El costo por ejecución usa el **costo promedio vigente** de cada insumo y se redondea por línea, para que la suma en pantalla coincida con lo que se ve en vez de arrastrar centésimas invisibles. Es una estimación, no un compromiso: el costo cambia con cada compra.

## Dónde se ve

En la ficha del equipo (Producción → Equipos → *equipo*), la tabla de planes gana una columna **Repuestos previstos** con el costo por ejecución y el anual proyectado, y cada plan activo se expande con su lista técnica, el subtotal por línea y el formulario para agregar o quitar.

## Verificación

**7 pruebas** (211 en total): la suma por línea y el redondeo; la lista vacía cuesta cero sin fallar; las ejecuciones solo se estiman cuando se pueden saber; el costo anual es `null` y no cero cuando no se puede estimar; la lista se guarda por plan, rechaza el repuesto repetido y se borra con el plan; la guardia de que la lista planificada **no** escribe consumo real; y que agregar un repuesto valide plan e insumo contra la compañía activa — los dos ids llegan del navegador.

**Navegador**, sobre un plan "Cambio de aceite de motor" cada 90 días con 4 kg de aceite base (S/ 6.83/kg) y 1 kg de jabón de litio (S/ 18.30):

| | |
|---|---|
| Costo por ejecución | **S/ 45.60** |
| Proyección anual (365/90 = 4.06 ejecuciones) | **S/ 185.14 al año** |

Con las líneas desglosadas (S/ 27.30 y S/ 18.30) y el selector para seguir cargando.

## Lo que no hace

- **No consolida el presupuesto de mantenimiento de toda la planta.** Cada plan muestra el suyo; un reporte que sume todos los equipos es trabajo aparte, y conviene definir con el negocio si se agrupa por centro de costo, por ubicación técnica o por planta antes de construirlo.
- **No reserva stock ni genera necesidad de compra.** La lista no entra al MRP. Hacerlo exigiría decidir con cuánta anticipación se compra un repuesto preventivo, que es criterio del negocio.
