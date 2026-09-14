# El límite de crédito tenía el signo invertido

El maestro de clientes nacía con `limiteCredito = 0`, y eso parecía la opción segura. **Significaba crédito ilimitado.**

```ts
excede: limite > 0 && exposicionProyectada > limite + 1e-9
```

Con `limite = 0` la condición es falsa para cualquier monto. El valor con el que nace todo cliente nuevo era el más permisivo del sistema.

## El mismo número quería decir tres cosas

Peor que el signo invertido era la ambigüedad. En el mismo dominio, `0` se leía de tres maneras según quién lo mirara:

| Dónde | Qué significaba el 0 |
| --- | --- |
| `evaluarCredito` | Sin tope: nunca excede |
| `creacionRequiereAprobacion` | Sin tope: **bloquea el alta** si el control está encendido |
| `crearPedido` / `facturarPedido` | «Contado, no evalúes» |

La segunda tenía una consecuencia perversa: con el umbral de aprobación configurado, el vendedor **no podía** crear un cliente con 0. Estaba obligado a escribir algún número positivo, es decir, a otorgar crédito para poder dar de alta a alguien. Y con el umbral apagado, el 0 era barra libre.

## Tres estados, ninguno un número mágico

```
null  = sin tope, heredado y sin evaluar nunca
0     = SIN CRÉDITO: solo contado, hasta que Créditos lo evalúe
> 0   = el techo real
```

`evaluarCredito` pasa a `limite !== null && exposicion > limite`. Un cliente en 0 no puede facturar a crédito **ni un sol**, que es lo que la palabra significa.

«No evaluar» dejó de decirse con un número: las dos acciones de pedidos usan ahora una bandera propia, `evaluaCredito = condicionPago !== "CONTADO"`. Una venta al contado no expone crédito, y eso es distinto de no tener techo.

`creacionRequiereAprobacion(0, umbral)` devuelve `false`: el estado seguro con el que debe nacer un cliente nunca necesita que nadie lo apruebe.

`decidirCambioLimiteCredito` se simplificó. Antes bajar a 0 era «el mayor aumento de exposición posible» y pasaba por aprobación; hoy es la reducción más grande que existe y no la necesita. Ponerle un techo a quien venía sin tope tampoco: reduce exposición.

## La migración no cambia la operación de nadie

Los clientes que existían estaban todos en `0`, o sea sin tope. Pasarlos a «sin crédito» los habría dejado sin poder facturar de un día para otro.

```sql
UPDATE "clientes" SET "limiteCredito" = NULL WHERE "limiteCredito" = 0;
```

Conservan exactamente lo que tenían, ahora dicho sin ambigüedad. El `0 = sin crédito` rige para las altas nuevas, que es donde importa. `SolicitudCambioCredito.limiteAnterior` también es nullable: una solicitud sobre un cliente heredado tiene que poder decir «venía sin tope» en vez de fingir que su límite anterior era cero.

`null` es un estado de transición, no un destino: ninguna alta nueva lo produce, solo la migración. En pantalla se muestra como **Sin tope (heredado, nunca evaluado)** para que se vea qué carteras faltan evaluar.

## Qué lo fija

- `evaluarCredito(0, 1, 0).excede === true` — sin crédito es sin crédito.
- `evaluarCredito(999_999, 999_999, null).excede === false` — el heredado opera como antes.
- `creacionRequiereAprobacion(0, 20_000) === false` — el valor seguro ya no está prohibido.
- `decidirCambioLimiteCredito(5_000, 0, …)` no requiere aprobación; `(null, 900_000, …)` tampoco.

En `tests/critical-flows.test.ts` había una línea que afirmaba `evaluarCredito(800, 300, 0).excede === false`: **el defecto escrito como prueba**. Ahora afirma lo contrario, con el porqué al lado.
