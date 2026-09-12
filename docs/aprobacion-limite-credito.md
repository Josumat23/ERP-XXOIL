# Aprobación del cambio de límite de crédito

Cierra el ítem del Blueprint 03 §7 *Workflow de aprobación de cambio de límite de crédito*, registrado como **Ausente** en la auditoría del 2026-09-11.

## Qué había antes

`Cliente.limiteCredito` era un campo mutable directo: cualquier usuario con permiso de edición en Ventas podía llevarlo de 5 000 a 500 000 y guardar. Quedaba el rastro —la auditoría de maestros registra el antes y el después— pero **quedaba después del hecho**: el límite ya estaba aplicado y el pedido siguiente ya pasaba el chequeo de crédito con la exposición nueva.

Lo que sí existía era la **aprobación del pedido que excede el límite**. Son controles distintos: ese autoriza una operación puntual contra un límite dado; este decide cuál es el límite.

## Las cuatro decisiones

**1. El límite no cambia hasta que se aprueba.** Aplicar primero y aprobar después vaciaría el control: entre la edición y la resolución cabe toda la facturación que se quiera. El resto de la ficha del cliente **sí se guarda** en ese mismo envío — quien estaba corrigiendo un teléfono no tiene por qué perder el cambio.

**2. Solo los aumentos.** Bajar un límite reduce la exposición. Exigir aprobación para bajarlo solo lograría que nadie los baje.

**3. El umbral mira el límite *resultante*, no cuánto subió.** La exposición es el límite que queda: un cliente con 200 000 son 200 000 de riesgo, venga de 190 000 o de 1 000. Es el mismo criterio del umbral de compras, que mira el total de la orden y no su variación.

**4. El control nace apagado.** `ConfiguracionEmpresa.montoAprobacionCredito` es `Decimal?` y la migración lo deja en `NULL`: los límites se siguen editando directo, exactamente como venían funcionando. Ponerle un número lo enciende. El umbral es la política de crédito de la empresa y **el sistema no elige una por su cuenta**.

## El detalle que casi se pasa por alto

En este sistema **`limiteCredito = 0` significa *sin límite***, no "no puede comprar" (así está documentado en el esquema desde siempre, y así lo lee la evaluación de crédito). Es decir: el número que parece el más chico es en realidad el más grande.

Por eso:

| Cambio | ¿Aprobación? |
|---|---|
| 5 000 → 0 | **Sí** — quitar el tope es la mayor exposición posible |
| 0 → 900 000 | No — ponerle tope a quien no tenía ninguno *reduce* la exposición |
| 19 900 → 20 100 (umbral 20 000) | Sí |
| 1 000 → 1 100 (umbral 20 000) | No |
| 1 000 → 20 000 (umbral 20 000) | No — el umbral es el máximo permitido sin aprobación, igual que en compras |

Una implementación que solo comparara `nuevo > anterior` habría dejado pasar el primer caso, que es el más grave de todos. Está cubierto por prueba.

## El alta de un cliente

Un cliente nuevo no tiene límite anterior, y "sin crédito" no es lo mismo que 0. Con el control encendido, **un alta por encima del umbral se rechaza** en vez de quedar pendiente: dejar el cliente creado con un límite provisional obligaría a inventar un número, y crearlo con el límite pedido sería exactamente el control que se quiere evitar. El mensaje dice qué hacer — crearlo dentro del umbral y solicitar el aumento desde su ficha.

## Lo que no se confía del navegador

- **El límite anterior se lee del registro guardado**, dentro de la misma transacción. Si la decisión se tomara con el valor que manda el formulario, bastaría con declarar un límite anterior alto para saltarse la aprobación. Hay una guardia estructural sobre esto.
- **El id de la solicitud llega del navegador**: se busca siempre acotada a la compañía activa, y el cliente al que se le aplica el límite sale de la solicitud, nunca de otro id del formulario.
- **Quien pide no resuelve** (`puedeResolverSolicitud`), igual que en órdenes de compra y pagos.
- **Cierre optimista**: el `updateMany` está condicionado a `estado: "PENDIENTE"` y exige `count === 1`. Dos aprobadores simultáneos no aplican el límite dos veces.
- Un cliente no puede acumular dos solicitudes pendientes.

## Dónde se ve

- **Ficha del cliente** — panel ámbar con el límite vigente, el solicitado, quién lo pidió y el motivo; aprobar o rechazar (con motivo obligatorio) para Gerencia/Admin con permiso de aprobación en Ventas. Debajo, el historial de las resueltas.
- **`/aprobaciones`** — cuarta sección, *Límites de crédito*, junto a excepciones de crédito, órdenes de compra y pagos.
- **Configuración → Empresa** — el umbral, con su explicación y la indicación de dejarlo vacío para apagar el control.

El motivo de la solicitud es **obligatorio**: quien aprueba necesita saber por qué se pide, y un histórico sin motivo no sirve para revisar una cartera después.

## Verificación

**9 pruebas** (272 en total): las reglas puras caso por caso —incluido el 0 en ambos sentidos y el borde exacto del umbral—, que el límite no se mueve mientras la solicitud está pendiente, que la segunda resolución no encuentra nada que cerrar, que borrar el cliente se lleva sus solicitudes, que el umbral nace en `NULL`, y dos guardias estructurales: la decisión se toma sobre el límite guardado, y el resolutor valida rol, compañía, segregación de funciones y cierre optimista.

Limitación conocida: la comprobación en navegador de los envíos de formulario no se pudo completar en este entorno (React no procesa el submit con el panel de vista previa oculto). Las pantallas se revisaron renderizadas; los caminos de escritura están cubiertos por las pruebas de arriba, que sí corren contra una base real.

## Lo que este ciclo no hace

- No toca la **evaluación de crédito del pedido** ni la del momento de facturar: siguen leyendo `Cliente.limiteCredito`, que es justamente el valor que este control protege.
- No hay **cadena de mando** de varios niveles como en compras. Un solo resolutor, que no puede ser el solicitante. Si hiciera falta escalonarlo, la pieza a reutilizar es `PasoAprobacionCompra`.
- No hay **límite de crédito compartido entre compañías** — es la pregunta abierta 23 del Blueprint 10, que sigue esperando una decisión de política corporativa.
