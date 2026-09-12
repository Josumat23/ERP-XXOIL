# Checklist de cierre de período

Cierra el pendiente del Blueprint 05: *checklist de cierre de período (tareas con dependencias, no solo abierto/cerrado)*.

## El problema de construir esto sin inventar nada

Un checklist de cierre contable pide, aparentemente, una lista de tareas. Pero **qué incluye un cierre es criterio del contador**: qué se concilia, en qué orden, con qué evidencia. Sembrar una lista por defecto sería inventar un procedimiento profesional que nadie pidió — exactamente lo que las instrucciones de este proyecto prohíben.

La salida fue separar el checklist en dos clases de punto, con orígenes distintos:

### 1. Verificaciones automáticas

Hechos **verificables sobre los datos del propio período**. El sistema puede afirmarlos con certeza porque los calcula de su propia base, sin suponer nada:

| Verificación | Qué comprueba |
|---|---|
| Operaciones sin asiento contable | `IncidenciaContable` sin resolver con fecha en el período |
| Comprobantes electrónicos sin aceptar | Documentos del período en estado PENDIENTE, ENVIADO, RECHAZADO o ERROR |
| El período tiene asientos registrados | Si el mes no tiene ninguno |

La última no es una falla: un mes sin actividad puede cerrarse legítimamente sin asientos. Se marca como **punto a revisar**, con ese texto, para que no pase inadvertido.

**Se muestran todas, las superadas incluidas.** Un checklist que solo lista lo que falta no sirve para dar un cierre por revisado: quien lo firma necesita ver qué se comprobó.

### 2. Tareas propias

Las que la empresa define, con su texto y su orden. El sistema aporta el **mecanismo** —orden, dependencia y constancia de quién la dio por hecha— no el contenido. Cuando no hay ninguna, la pantalla lo dice así: *"El sistema no propone una lista: qué incluye el cierre lo define quien lleva los libros."*

Una prueba de la suite falla si algún seed empieza a sembrar tareas predefinidas.

## La dependencia es el orden

Una tarea no se puede completar si queda alguna **anterior** pendiente. Un cierre es una secuencia —no se concilia el banco antes de registrar los cobros del mes—, y el orden lo define quien arma la lista.

Es deliberadamente más simple que un grafo arbitrario de dependencias: eso nadie lo pidió, y habría traído ciclos, nodos huérfanos y una pantalla que explicar. En la práctica, el botón de la tarea que no toca aparece deshabilitado con el motivo en su `title`.

## Cerrar sigue siendo decisión del contador

El período se cierra con puntos abiertos si quien lo cierra así lo decide. **Bloquearlo podría dejar los libros sin poder cerrarse** por un dato menor — un comprobante que SUNAT no respondió, por ejemplo.

Lo que sí queda es constancia: `PeriodoFiscal.pendientesAlCerrar` guarda cuántos puntos estaban abiertos en ese momento, y la pantalla lo muestra junto al estado. Es la misma filosofía que `IncidenciaContable`: no bloquear la operación, dejar el rastro.

## Verificación

**11 pruebas** (240 en total). Las puras: las verificaciones se devuelven todas con su conteo y su enlace; el período sin asientos se marca para revisar; la dependencia por orden habilita solo la siguiente; no se completa una tarea ya hecha ni en un período cerrado; las tareas se agregan al final tolerando huecos; y el conteo de pendientes suma verificaciones abiertas más tareas sin completar.

Sobre base efímera: las tareas cuelgan del período, el orden es único, y borrar el período se las lleva.

**Tres guardias**: que ningún seed siembre tareas predefinidas, que cerrar no lance por tener pendientes, y que ambas acciones validen contra la compañía activa.

**Navegador** — render real del calendario fiscal de 2026:

- **Septiembre** (2 pendientes): las tres verificaciones en ✓, y las dos tareas propias, con la **primera habilitada y la segunda deshabilitada** con el título *"Complete primero las tareas anteriores"*.
- **Octubre** (1 pendiente): dos verificaciones en ✓ y la tercera en **!** — *"El período no tiene ningún asiento. Puede ser correcto si no hubo actividad, pero conviene confirmarlo antes de cerrar"*.

El checklist usa `<details>` y no estado de cliente: el contenido queda en el HTML aunque esté plegado, así se imprime y se lee sin JavaScript, como el resto de estas pantallas.

## Lo que no hace

- **No propone tareas.** Ya dicho, pero es la decisión central de este ciclo.
- **No es un flujo de aprobación.** Quien marca una tarea es quien la hizo; no hay un segundo que la revise. Si el negocio necesita esa segregación, es un ciclo aparte con su propia regla.
- **Las tareas no se copian de un mes al siguiente.** Repetirlas a mano es tedioso, pero copiarlas automáticamente supondría que el cierre de enero es igual al de diciembre, y eso no es cierto —el cierre anual lleva pasos propios—. Una plantilla de cierre es una función distinta, y conviene definirla con el contador antes de construirla.
