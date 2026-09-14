# Un cliente, varias direcciones

Dónde está domiciliado un cliente ante SUNAT no es dónde quiere recibir la factura, ni dónde hay que dejarle los cilindros, ni dónde se le va a cobrar. El maestro tenía **una sola** dirección.

La consecuencia real no estaba en el maestro sino en el pedido:

```prisma
direccionEntrega String?   // texto libre, retipeado en cada pedido
```

El vendedor escribía a mano el destino **cada vez**. Un cliente minero con tres unidades, o un distribuidor con dos almacenes, no se podía modelar: la dirección del despacho dependía de que alguien la escribiera bien, y dos pedidos al mismo sitio podían quedar con dos textos distintos.

## Cuatro tipos, una principal por tipo

`DireccionCliente` con `tipo` en `FISCAL`, `FACTURACION`, `ENTREGA`, `COBRANZA`, y por cada una: etiqueta operativa («Planta Toquepala»), dirección, referencia, ubigeo, departamento/provincia/distrito heredados, código postal, país, contacto y teléfono propios, coordenadas, estado activo y notas.

La regla de «una sola principal por tipo» **vive en la base**, no en el código:

```prisma
principalDe TipoDireccionCliente?
@@unique([clienteId, principalDe])
```

`principalDe` vale lo mismo que `tipo` cuando la dirección es la principal de su tipo, y `null` cuando no lo es. Como en SQLite y en PostgreSQL los NULL no chocan entre sí en un índice único, pueden convivir muchas no principales y una sola principal — y el segundo intento de marcar dos principales del mismo tipo falla en la base, no en una validación que alguien puede olvidar. Una prueba lo ejerce contra la base real.

## Decisiones que no son obvias

**Solo la de entrega exige ubigeo.** Es la que el reparto usa para agrupar y la que la licitación de flete necesita para cotizar un tramo. Las otras tres son administrativas y muchas veces llegan sin distrito; exigirlo obligaría a inventar uno.

**Con varias direcciones de entrega y ninguna principal, `direccionPara` devuelve `null`.** Adivinar a cuál de tres plantas va el despacho es peor que pedir que alguien lo diga. Con una sola activa no hay ambigüedad y la devuelve.

**Una dirección inactiva no puede ser principal.** Dejaría al tipo sin principal utilizable, que es peor que no tener ninguna.

**Las coordenadas son `Decimal`, no `Float`.** Una coordenada mal redondeada manda un camión a otra cuadra.

**Se reclaman `FISCAL` y `ENTREGA`, no las cuatro.** Sin domicilio no hay comprobante, y sin destino no hay despacho. Facturación y cobranza caen en la fiscal cuando no se declaran.

## El pedido guarda una foto, no una referencia viva

`Pedido.direccionEntrega` —el texto— **se conserva**, y se suma `direccionEntregaId` que dice de qué dirección del maestro salió.

No es redundancia: un pedido despachado no puede cambiar de destino porque alguien editó la ficha del cliente después. El texto es el compromiso que se tomó; el id es la trazabilidad de dónde se copió. Es el mismo criterio con el que la factura ya congela `clienteDireccion`.

## La migración no pierde nada

La dirección que cada cliente tenía pasa a ser su domicilio **FISCAL principal**, con su ubigeo y su contacto. Los cinco clientes de la base quedaron con su ficha completa desde el primer día; los que no tenían dirección cargada no generan una fila vacía.

## Lo que este ciclo no hace

El formulario de direcciones y el selector de destino en el pedido van en el ciclo siguiente. Este deja el modelo, las reglas y la migración —con la garantía de que ninguna dirección existente se perdió— para que la pantalla se monte sobre algo ya probado.
