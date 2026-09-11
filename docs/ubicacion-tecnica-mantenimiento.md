# Ubicación técnica de mantenimiento (Oleada 1, PM)

Equivalente reducido a *Functional Location* de SAP PM: el sitio donde vive un equipo, en jerarquía de niveles (planta → línea → estación). Antes un `Equipo` solo podía colgar de un almacén, un centro de trabajo y un centro de costo — tres dimensiones planas, ninguna de ellas el sitio físico.

## El modelo

`UbicacionTecnica` es autorreferenciada (`parentId`), con `@@unique([empresaId, codigo])` y FK física hacia `Empresa`, como el resto del grafo tras el ítem 0.2.

Dos decisiones que vale explicar:

- **La planta se declara solo en las raíces.** `almacenId` se guarda únicamente en los nodos sin padre; los descendientes la heredan recorriendo el árbol. Guardarla en cada nivel permitiría que una línea dijera pertenecer a una planta distinta que su propia planta.
- **El historial no se mueve con el equipo.** Órdenes y avisos siguen colgando del `Equipo`. La ubicación dice dónde está instalado *ahora*; reubicarlo no reescribe nada de su pasado, en línea con el principio del esquema de que la historia no se edita.

`parent` usa `onDelete: Restrict`: una ubicación con descendientes no desaparece en silencio llevándose media jerarquía.

## La jerarquía

`src/lib/ubicacionesTecnicas.ts` son funciones puras que reciben el listado completo de nodos y no tocan la base — mismo patrón que `jerarquiaCentrosCosto`:

| Función | Para qué |
| --- | --- |
| `idsSubarbolUbicacion` | el nodo y todos sus descendientes |
| `creariaCicloUbicacion` | si reubicar cerraría un ciclo |
| `rutaUbicacion` / `etiquetaRutaUbicacion` | cadena raíz → nodo, y su forma legible `PLANTA-1 › LINEA-A › ENV-02` |
| `nivelUbicacion` | profundidad, 0 para una raíz |
| `ordenarArbolUbicaciones` | orden de árbol para listados, con el nivel de indentación |

Todas toleran datos con ciclos. La acción los bloquea antes de escribir, pero una fila corrupta no debe dejar la pantalla colgada en un bucle infinito, y un nodo con padre inexistente se emite igual al final del listado en vez de desaparecer.

## Dónde se ve

- **Producción → Ubicaciones técnicas** (`/produccion/mantenimiento/ubicaciones`): alta, árbol indentado con conteo de equipos por nodo, activar/desactivar y un selector para mover una ubicación bajo otra. El selector excluye los descendientes del propio nodo, así que el ciclo ni siquiera se puede intentar desde la UI — y la acción lo vuelve a comprobar, porque el formulario no es la frontera de seguridad.
- **Alta de equipo**: selector de ubicación técnica con la ruta completa.
- **Ficha del equipo**: la ubicación aparece en la cabecera junto al almacén y el centro de trabajo.

## Verificación

`tests/ubicaciones-tecnicas.test.ts`: funciones puras de jerarquía (subárbol, ciclos, ruta, nivel, orden de árbol, datos corruptos), más un escenario sobre base efímera que arma planta → línea → estación en una compañía, comprueba que el mismo código convive en otra, mueve un equipo entre niveles, y confirma que borrar una ubicación con hijos y crear una en compañía inexistente fallan por FK.
