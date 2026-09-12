# Licitación de flete

Cierra la segunda mitad del ítem *Maestro de transportistas / licitación de flete* del roadmap. El maestro se construyó el 2026-09-13; esto es comparar cotizaciones antes de contratar.

## Por qué las reglas son las del RFQ

Contratar flete es comprar un servicio. Que sea un camión y no un insumo no cambia el control que hace falta, así que se reusan las tres reglas del RFQ de compras —**dos ofertas como mínimo, justificación escrita, y quien solicita no adjudica**— con los mismos números, incluido el mínimo de 12 caracteres de justificación.

Reusar la regla y no inventar una nueva también significa que si mañana el negocio decide que hacen falta tres ofertas, se cambia en un lugar y vale para los dos flujos.

## Lo que adjudicar NO hace

**No emite la guía de remisión.** Una guía documenta un traslado que ocurre, con su fecha, su peso y sus ítems reales; emitirla al adjudicar fabricaría un traslado que todavía no pasó. Es el mismo criterio que impide que el escalamiento de cobranza emita avisos por su cuenta.

La guía se emite cuando el camión sale, y ahí referencia la licitación. Una licitación puede tener varias guías: un tramo licitado se despacha más de una vez.

## Lo que el sistema sí opina

Adjudicar la oferta **más cara está permitido** — cumple plazo, tiene la unidad adecuada, responde el teléfono, y el sistema no sabe nada de eso. Lo que hace es **decirlo**: la pantalla marca cuál es la más barata y, al adjudicar otra, muestra el sobrecosto exacto junto al campo de justificación.

La justificación se escribe sabiendo lo que se está justificando. Eso es distinto de impedirlo, y es lo máximo que el sistema puede afirmar con honestidad.

## Comparar en la misma moneda

Una oferta en dólares y otra en soles no se comparan por el número suelto: se normalizan a moneda funcional con el tipo de cambio de la oferta. Sin eso, la de menor cifra parecería la más barata por la razón equivocada. Por lo mismo, **una oferta en moneda extranjera sin tipo de cambio se rechaza**: sería incomparable, que es justo para lo que sirve la licitación.

A igual monto gana la de menor tránsito. Si dos cuestan lo mismo, la que llega antes es mejor y no hay nada que decidir.

## Lo que no se confía del navegador

- **La guía toma el transportista de la oferta adjudicada**, no del formulario. Adjudicar a uno y despachar con otro vaciaría la licitación entera. La licitación se relee acotada a la compañía activa **y al estado `ADJUDICADA`**.
- Los dos ids de una oferta llegan del navegador: la licitación tiene que ser de la compañía y estar abierta, y el transportista de la misma compañía y activo.
- **Cierre optimista** al adjudicar: si otro resolvió entre la lectura y la escritura, `count` deja de ser 1 y no se pisa su decisión.

## Detalles del modelo

**Una oferta por transportista y licitación.** Dos cotizaciones del mismo no son dos ofertas, y contarlas como tales vaciaría el mínimo de dos.

**El monto acordado no se copia a la guía.** La guía apunta a la licitación y el precio se lee de la oferta adjudicada: dos números para el mismo precio terminan con uno viejo. Hay una prueba que falla si alguien agrega un `montoFlete` a la guía.

**`DESIERTA` con motivo**, en vez de dejarla abierta para siempre. Por qué no se contrató es información, y una bandeja llena de licitaciones muertas deja de mirarse.

**Las ofertas se van con su licitación** (`Cascade`), pero **un transportista con ofertas no se puede borrar** (`Restrict`): la oferta es parte del sustento de una adjudicación y no puede quedar apuntando a nadie.

## Verificación

**16 pruebas** (331 en total): la comparación en moneda funcional en ambos sentidos del tipo de cambio, el desempate por tránsito, los tres impedimentos para adjudicar, el sobrecosto calculado, la oferta ajena, las validaciones, la unicidad por transportista, la cascada y el `Restrict`. Más cuatro guardias: que adjudicar no emita guía, que la guía derive el transportista de la oferta ganadora, que el monto no se copie, y que las acciones acoten por compañía.

**En navegador**, con dos transportistas y una base de demostración nueva:

| Caso | Resultado |
|---|---|
| Licitación con una sola oferta | Avisa que faltan ofertas; no ofrece adjudicar |
| Dos ofertas cargadas | La de S/ 1500 queda marcada «más barata» |
| Adjudicar siendo quien solicitó | **Rechazado**: «Quien solicitó la licitación no puede adjudicarla» |
| Elegir la de S/ 1800 | Avisa «no es la más barata: S/ 300.00 por encima» |
| Adjudicar como otro usuario | `ADJUDICADA`; la ganadora queda `ADJUDICADA` y la otra `NO_SELECCIONADA` |
| **Guía con `transportistaId` adulterado** | El servidor **ignoró** el transportista perdedor enviado en el formulario y guardó el de la oferta adjudicada |

El último caso se probó habilitando el selector deshabilitado y forzando el transportista perdedor en el envío: el `FormData` salió con `t-norte` y la guía quedó con `t-andinos`.

## Lo que este ciclo no hace

- **No genera la cuenta por pagar del flete.** Requiere decidir el insumo o servicio contra el que se imputa y su cuenta contable; es trabajo del módulo de compras, no de este.
- **No compara contra tarifas históricas** ni sugiere un precio de referencia. Con un tramo licitado no hay serie de la que sacarlo.
- **No hay licitación automática por ruta**: qué tramos se licitan y cada cuánto es criterio del negocio.
