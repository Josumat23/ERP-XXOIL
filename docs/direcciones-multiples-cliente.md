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

---

# El formulario y el selector (2026-09-14, segundo ciclo)

## Una duplicación que era mía

Al montar la pantalla apareció algo que debí ver antes de construir el modelo: **ya existía un sistema de direcciones genérico** —`Direccion`, polimórfico por `entidadTipo`/`entidadId`— y su `PanelDirecciones` estaba montado en esta misma ficha, además de en Proveedores y Empleados.

Construí un segundo sistema en paralelo sin comprobarlo. Debí haberlo revisado primero.

Revisado ahora, el tipado es el que corresponde conservar, y no por gusto:

| | `Direccion` (genérico) | `DireccionCliente` |
| --- | --- | --- |
| `empresaId` | **No tiene** — queda fuera del aislamiento multiempresa | Sí, con FK |
| FK a la entidad | No: dos strings sueltos, sin integridad ni cascada | Sí, con `onDelete: Cascade` |
| Tipos | FACTURACION / ENVIO / OTRA | Los cuatro del negocio |
| Una principal por tipo | Booleano sin garantía | Índice único en la base |
| Ubigeo, coordenadas, contacto | No | Sí |
| Filas en uso | **0** en las tres fichas | 5 migradas |

Que no tenga `empresaId` es lo decisivo: el proyecto dedicó diez migraciones a que los 76 modelos con datos de negocio lo tuvieran, y este quedó afuera. Con dos compañías, las direcciones de una habrían sido visibles desde la otra.

`PanelDirecciones` **se retiró de la ficha de clientes** — dos sistemas de direcciones en la misma pantalla es peor que cualquiera de los dos. Sigue montado en Proveedores y Empleados, donde también tiene cero filas; qué hacer con él ahí es un ciclo propio y una decisión aparte.

## El formulario

Alta, edición y **desactivación** —nunca borrado: una dirección puede estar citada por pedidos ya despachados, y borrarla rompería la trazabilidad de a dónde fue esa carga—. Cada dirección con su etiqueta operativa, referencia, ubigeo por el selector de tres niveles, país, quién recibe, teléfono propio y coordenadas.

**El distrito se exige solo cuando el tipo es ENTREGA**, y la pantalla lo explica ahí mismo: el reparto agrupa por distrito y la licitación de flete cotiza por tramo.

**Marcar una principal desmarca la anterior en la misma transacción.** El índice único ya impide dos, pero rechazaría la escritura en vez de reemplazar — y reemplazar es lo que quien edita está pidiendo. No hay un instante con dos ni con ninguna.

**Desactivar quita la marca de principal.** Una principal inactiva dejaría al tipo sin principal utilizable.

La ficha avisa cuando falta el domicilio fiscal o la dirección de entrega: sin el primero no hay comprobante, sin la segunda no hay despacho.

## El selector en el pedido

Al elegir el cliente se ofrecen **sus direcciones de entrega activas** —ni domicilios fiscales ni direcciones dadas de baja— y se preselecciona la principal, o la única si hay una sola. **Con varias y ninguna principal no se elige ninguna**, y la pantalla dice cuántas hay y pide que se elija: mandar la carga a una de tres plantas por orden alfabético es el error que este ciclo viene a evitar.

El texto sigue siendo editable y es lo que se guarda. **Si alguien lo edita a mano, la procedencia se borra**: un pedido no puede decir que viene de una dirección del maestro si su destino ya no coincide con ella.

Y del lado del servidor, ese id no se cree: se comprueba que la dirección sea de **ese** cliente, de la compañía activa, de tipo entrega y activa. Si no lo es, el pedido no se rechaza —el destino escrito sigue siendo válido— pero se guarda **sin** procedencia antes que con una falsa.
