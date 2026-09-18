# La factura del reclamo: el selector que dejaba clientes sin facturas

La pantalla de reclamos traía las **100 facturas más recientes de toda la compañía** y las filtraba por cliente **en el navegador**.

Con los datos de hoy —19 facturas— funciona. Con volumen real, un cliente cuyas facturas no estén entre esas cien aparece **sin ninguna**, y quien registra el reclamo concluye que no tiene facturas y lo deja sin relacionar.

Y ese reclamo es exactamente el que después **no puede decir de qué lote salió**: el defecto silencioso de una lista desactiva la pantalla que se construyó encima.

Es la misma familia que el tope compartido de la ficha del instrumento y que el recall por una sola recepción —una respuesta incompleta con cara de completa— pero acá el daño no es leer mal: es **registrar mal, para siempre**. Un reclamo sin factura no se arregla mirándolo otra vez.

## Se elige el cliente, y recién entonces se consultan sus facturas

Dos pasos, por GET y sin JavaScript de cliente, como el resto del sistema:

1. **Reclamo de qué cliente** — lista acotada a 50, filtrable por razón social o código.
2. Con el cliente elegido, **sus** facturas vigentes — acotadas a 50, filtrables por número.

Las dos listas dicen cuántas opciones muestran de cuántas hay. Un selector acotado sin decirlo es peor que uno largo.

El cliente viaja al alta en un campo oculto, y **la acción lo vuelve a comprobar**: que pertenezca a la compañía activa, que esté activo, y que la factura sea de ese cliente. Que la pantalla lo haya resuelto no lo convierte en un dato de confianza — llega por la URL.

## Se dice lo que implica no relacionar la factura

Debajo del selector:

> Relacionarla es lo que después permite saber de qué lote salió lo reclamado.

Y si el cliente no tiene ninguna:

> Este cliente no tiene facturas vigentes. Sin factura, el reclamo no va a poder decir de qué lote salió.

«No hay» a secas dejaría creer que da igual.

## El aviso de alcance, en un solo lugar

El componente que dice «se muestran los N más recientes de M» vivía dentro de la pantalla de trazabilidad. Al necesitarlo la **tercera** lista se extrajo a `src/components/AlcanceDeLista.tsx` en vez de copiarse: tres mensajes que dicen lo mismo con palabras distintas se desincronizan, y el que quede viejo va a ser el de la pantalla que menos se mira.

La guarda que ya existía sobre la pantalla de trazabilidad se actualizó para comprobar lo mismo sobre el componente compartido: que sus **dos** listas lo informen.

## Verificación en navegador (`erp_dev`)

| Caso | Resultado |
| --- | --- |
| Sin cliente elegido | No se muestra el alta; se explica por qué |
| Cliente elegido | Solo sus 3 facturas: F001-00000016, F001-00000011, F001-00000004 |
| Filtro `qFactura=00000011` | Queda una: F001-00000011 |
| Filtro sin coincidencias | «Ningún resultado para «…»» |
| `paraCliente` con un id que no es de un cliente de la compañía | Se ignora: vuelve a pedir que se elija el cliente |

**De extremo a extremo**: se registró un reclamo real desde el formulario contra F001-00000011, y su detalle derivó los dos lotes que esa factura llevó —LG-00001 × 12 y LG-00002 × 1— cada uno con sus enlaces a «quién más lo tiene» y al certificado. La cadena completa, desde el alta hasta el recall, funcionando en pantalla.

`tests/factura-del-reclamo.test.ts`: 14 pruebas.
