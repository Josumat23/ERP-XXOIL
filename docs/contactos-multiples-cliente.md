# Un cliente, varias personas

En un distribuidor, quien aprueba el pedido no es quien recibe la factura, ni quien contesta cuando hay que cobrar, ni quien atiende al camión. El maestro tenía **un** contacto, en dos campos sueltos del cliente:

```prisma
contactoNombre   String?
contactoTelefono String?
```

Con un solo casillero, el nombre que quedaba escrito era el del último que llamó.

## Lo que ya existía, y por qué no se usó

Igual que con direcciones, había un `Contacto` **genérico** polimórfico con su panel montado en esta ficha. Esta vez se revisó **antes** de escribir nada, y el diagnóstico es el mismo:

| | `Contacto` (genérico) | `ContactoCliente` |
| --- | --- | --- |
| `empresaId` | **No tiene** | Sí, con FK |
| FK a la entidad | No: dos strings sueltos | Sí, `onDelete: Cascade` |
| Campos | nombre, cargo, teléfono, correo | + apellidos, área, anexo, celular, propósitos |
| Un solo principal | Booleano sin garantía | Índice único en la base |
| Filas en uso | **0** en las tres fichas | — |

Que no tenga `empresaId` es lo decisivo, por lo mismo que en direcciones. `PanelContactos` se retiró de la ficha de clientes; sigue en Proveedores y Empleados, pendiente de su propia decisión.

## Un solo principal, garantizado por la base

```prisma
esPrincipal Boolean?
@@unique([clienteId, esPrincipal])
```

`esPrincipal` es `true` en el principal y **`null`** en el resto — nunca `false`. Esa distinción es el mecanismo, no un detalle: dos `false` chocarían entre sí y solo se podría tener **un secundario** por cliente. Los NULL, en cambio, no chocan, así que conviven muchos secundarios y un solo principal. Una prueba lo ejerce contra la base real, y una guardia estructural falla si alguien cambia el campo a `Boolean @default(false)` o escribe `false` desde la acción.

## Los propósitos no son adornos

`paraPedidos`, `paraFacturacion`, `paraCobranza`, `paraDespacho` responden a «¿a quién le aviso?» cuando hay cuatro nombres en la ficha.

**Marcar un propósito exige teléfono, celular o correo.** Un contacto sin forma de contactarlo sigue sirviendo como dato —saber quién decide vale— pero marcarlo para algo es decir «a este avísenle», y eso sí exige por dónde.

`contactoPara` busca primero a quien esté designado; entre varios designados gana el principal; y si nadie está marcado, cae en el principal del cliente, que es lo que hace una persona cuando no encuentra a quién más llamar. Sin ningún contacto activo devuelve `null`: es información que falta, no un hueco que se tape eligiendo a cualquiera.

`propositosSinContacto` **no** cuenta al principal como comodín. La pregunta es si hay alguien designado para cobranza, y contestarla con «bueno, está el principal» es justamente lo que se quiere dejar de hacer. La ficha lo avisa.

## El correo se comprueba sin fingir que se verifica

`emailPlausible` mira que haya algo antes de la arroba, algo después, un punto en el dominio y ningún espacio. No implementa el RFC a propósito: una expresión regular «completa» rechaza direcciones válidas y da una falsa sensación de verificación. Lo único que prueba que un correo existe es escribirle, y **este sistema todavía no envía correo** — no hay transporte configurado, como ya quedó anotado al construir el escalamiento de cobranza.

Por eso los propósitos hoy son **información para quien opera**, no disparadores automáticos. Decir lo contrario sería prometer avisos que nadie manda.

## Desactivar, no borrar

El histórico dice a quién se le avisó y cuándo. Borrar a la persona deja esos registros hablando de un nombre que ya no existe. Desactivar la saca de los selectores, le quita la marca de principal —uno inactivo dejaría al cliente sin principal utilizable— y conserva el rastro.

## La migración

El contacto que cada cliente tenía pasa a ser su **contacto principal**, marcado para pedidos, con su teléfono y el correo del cliente.

En la base local migró **cero**: el seed no carga `contactoNombre`. Como un respaldo que no se ejecuta no está probado, se ejerció contra una base sombra con datos reales — un cliente con contacto, uno sin él y uno con espacios en blanco. Migra exactamente el primero.
