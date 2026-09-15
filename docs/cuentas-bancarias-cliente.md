# Cuentas bancarias del cliente

Bloque 8 del maestro, y el dato más delicado de todos: **un número de cuenta cambiado por quien no debía tocarlo es una transferencia que se va a otro lado.**

Por eso el bloque no es «unos campos más»: es una restricción de acceso y una bitácora que no filtre lo que protege.

## Las administra Finanzas, no Ventas

El resto de la ficha del cliente la edita quien tiene permiso de **Ventas**. Las cuentas bancarias, no: exigen permiso de **Finanzas**. Un vendedor puede corregir una dirección de entrega; no puede cambiar a qué cuenta se le transfiere a un cliente.

Una guardia estructural falla si la autorización de este módulo vuelve a mencionar el permiso de Ventas.

## La bitácora guarda el número enmascarado

La auditoría de maestros ya borraba los secretos —contraseñas, claves SOL, tokens— reemplazándolos por `[PROTEGIDO]`. Una cuenta bancaria no es un secreto de ese tipo, pero tampoco debería quedar completa ahí: **la bitácora es otro lugar, con otras reglas de acceso**, y quien puede leer la auditoría no es necesariamente quien puede ver una cuenta.

Borrarla del todo dejaría un registro inútil —«alguien cambió la cuenta», sin decir cuál—, así que se enmascara:

```json
{"banco":"BCP","numeroCuenta":"••••••••••0089","cci":"••••••••••••••••8912","titular":"visible"}
```

Se ve **qué** cuenta cambió sin dejar el número entero. Los secretos siguen borrándose por completo: son dos categorías distintas y el código las trata distinto.

## Lo que se valida, y lo que no

**El CCI sí**: son exactamente 20 dígitos en Perú, un formato publicado. Los separadores no cuentan.

**El número de cuenta, casi no.** Cada banco usa su propio largo y su propio formato; inventar uno haría rechazar cuentas buenas. Lo único que se exige es que no lleve letras y tenga al menos seis dígitos — «cuenta del gerente» no es un número de cuenta.

**No se valida el dígito de control del CCI ni se deduce el banco de sus primeros dígitos.** Eso exige la tabla oficial de códigos; adivinarla rechazaría cuentas válidas.

## El titular puede no ser el cliente

Muchas EIRL cobran en la cuenta personal de su titular. Anotarlo evita que el banco rechace el abono por diferencia de nombre — y evita la llamada de vuelta preguntando por qué no llegó.

## No se elige cuenta cuando hay ambigüedad

`cuentaParaAbonar` devuelve la principal de esa moneda, o la única activa en esa moneda. Con varias y ninguna principal devuelve `null`: **elegir a cuál de tres cuentas se transfiere plata no es una decisión que corresponda automatizar.**

Y la moneda separa de verdad: una cuenta principal en soles no sirve para abonar dólares.

## Desactivar, no borrar

Un cobro o una devolución ya hechos apuntan a la cuenta que se usó. Borrarla dejaría esos movimientos sin explicación de a dónde fue la plata.

## Una principal por cliente

El mismo mecanismo que ya sostiene las direcciones y los contactos: `esPrincipal` es `true` o `null`, nunca `false`, y el índice único hace que convivan varias secundarias con una sola principal.

## El medio de pago preferido va en el cliente

No en la cuenta: quien paga en efectivo no tiene cuenta que declarar. Reutiliza el enum `MedioPago` que ya existía para los movimientos de caja, en vez de crear una lista paralela.
