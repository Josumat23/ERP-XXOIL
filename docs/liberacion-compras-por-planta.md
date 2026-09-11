# Liberación de compras por planta

El esquema multi-nivel ya existía: `NivelAprobacionCompra` define una escalera de niveles por monto, cada uno con su rol aprobador, y una orden recorre en secuencia todos los niveles cuyo umbral alcanzó. Lo que faltaba del criterio del roadmap era la otra dimensión: **por planta**.

## Qué cambia

`NivelAprobacionCompra.almacenId` es opcional:

- `null` → el nivel aplica a toda la compañía.
- con planta → el nivel aplica solo a las órdenes destinadas a esa planta.

`OrdenCompra.almacenId` ya existía como planta de destino; ahora se propaga a la escalera de aprobación.

## La decisión: unión, no reemplazo

Una orden recorre los niveles generales **más** los de su planta. No los reemplaza.

Es deliberado. Con reemplazo, configurar un nivel laxo en una planta *aflojaría* la aprobación respecto del esquema general, y nadie lo notaría hasta auditar. Con unión, configurar una planta solo puede agregar controles. En un mecanismo de control interno, el modo de fallo silencioso tiene que ser el restrictivo.

El costo es real y vale nombrarlo: no se puede hacer que una planta apruebe **menos** que el resto de la compañía. Si el negocio necesita exactamente eso, el cambio está acotado a `nivelesAplicables` en `src/lib/aprobacionesCompra.ts`.

## Detalles que importan

- **El `orden` sigue siendo único por compañía.** Es la posición en la secuencia *combinada*, así que un nivel general y uno de planta no pueden compartirlo. Eso garantiza que la escalera resultante siempre tenga posiciones distintas, que es lo que exige `@@unique([ordenCompraId, orden])` en los pasos.
- **Órdenes sin planta de destino** —liberaciones de acuerdo de suministro y OC adjudicadas desde un RFQ— recorren solo los niveles generales. No se les inventa una planta.
- **El respaldo al umbral histórico no cambió.** Si la compañía no tiene ningún nivel configurado, se conserva el umbral único de `ConfiguracionEmpresa`. El filtro por planta se aplica *después* de traer los niveles de la compañía, a propósito: ese respaldo depende de si la compañía tiene esquema configurado, no de si esta planta en particular quedó sin niveles aplicables.
- **Un rol desconocido cae en GERENCIA**, nunca en ADMIN: ante un dato raro se escala al permiso menor.

## Lo que sigue ausente

**Organización de compras** como unidad propia no existe en el modelo (Blueprint 03 §4 la marca ausente) y no se inventa aquí. El criterio del roadmap decía "por planta/organización"; la planta existe y se implementó, la organización de compras es un modelo nuevo que requiere confirmar si el negocio la necesita.

## Verificación

La selección de niveles se extrajo a `nivelesAplicables`, una función pura, y `pasosAplicablesCompra` quedó como envoltorio de base. `tests/liberacion-compras.test.ts` cubre: el filtro por monto, órdenes sin planta, la unión con la planta, que los niveles de una planta no alcancen a otra (con un nivel que arranca en 0, el caso que más se nota), el orden de la secuencia combinada, que el `Decimal` atraviese sin convertirse, y el rol desconocido.
