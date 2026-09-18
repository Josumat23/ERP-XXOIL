# Una demo puede estar «cargada» y no mostrar nada

Los sembradores se habían probado siempre contra `erp_dev`, que tiene datos cargados a mano desde hace meses. Corriéndolos **desde una base vacía por primera vez** aparecieron dos agujeros que ninguna prueba veía.

## Lo que faltaba

**1. Ningún lote del proveedor llegaba en dos recepciones.**

El aviso de «alcance ampliado» del recall —la función entera del ciclo de PR #405— no aparecía nunca en una instalación nueva. Funcionaba en `erp_dev` por una recepción cargada a mano, no por el sembrado. En su momento decidí no inventar una segunda recepción; desde cero se vio que esa decisión dejaba la función invisible.

**2. Ningún ensayo declaraba con qué instrumento se midió.**

Peor de lo que parecía: los controles de calidad de la demo se creaban **sin una sola medición** —`resultado: "APROBADO"` y nada más—. Es un caso válido (el sistema soporta la «evaluación heredada») pero dejaba **tres pantallas en blanco**:

- El **certificado de análisis** ni siquiera abría: exige mediciones.
- La **ficha del instrumento** no tenía qué mostrar.
- **«Qué hay que reensayar»** decía que no hay nada, habiendo trabajo.

Quien estrena el sistema no concluye «faltan datos»: concluye que la función no está.

## Lo que se sembró

**La compra registra el lote del proveedor.** `comprarInsumo()` lo recibe y lo escribe; cada materia prima sale con el suyo.

**Una segunda entrega del mismo lote**, `AB-2026-014`, **después** de producción y con fecha reciente: así la primera (300 kg) se fue entera a los tres lotes y la segunda (100 kg) queda en almacén. El recall puede entonces decir *cuánto del lote sospechoso sigue sin consumirse*, que es el dato accionable del día.

**Las mediciones de liberación**, tomadas del plan de inspección que el propio sembrador publica, con el instrumento que ese plan declara. Solo sobre controles **sin** mediciones: un ensayo cargado por pantalla es trabajo de una persona y no se pisa. Sin plan publicado no se inventa qué se midió: el lote queda como evaluación heredada, que también vale verlo.

La densidad medida se escribe en el lote, igual que cuando se carga por pantalla: es el número que convierte kg en litros en los comprobantes.

**El caso sale solo.** La penetración se mide con `PEN-01`, cuya calibración el sembrador deja **vencida**. Así los tres lotes quedan con una medición sin respaldo y «Qué hay que reensayar» tiene el caso real que la pantalla existe para contestar: producto ya despachado, medido con un instrumento que no se puede dar por bueno.

## `npm run semillas:desde-cero`

Es un script, no una comprobación de una sola vez: cada cambio en los sembradores puede volver a dejar la demo sin un caso, y a mano nadie lo mira.

Siembra una base **efímera** con la misma maquinaria que la suite —prefijo obligado, creada al empezar, destruida al terminar pase lo que pase—, corre los cuatro sembradores, repite dos de ellos para comprobar idempotencia, y después verifica los casos **ejecutando las mismas consultas que las pantallas**:

```
✔ toda recepción de materia prima trae el número de lote del proveedor
✔ algún lote del proveedor llegó en más de una recepción
    MP-ACEITE-BASE|AB-2026-014: RC-00001 + RC-00007 — recibido 400, sin consumir 100
✔ todos los clientes tienen a quién llamar
✔ hay un reclamo con factura, para derivar el lote
✔ algún ensayo declara con qué instrumento se midió
✔ algún lote puede emitir su certificado de análisis
✔ «Qué hay que reensayar» tiene algo que decir
    3 ensayo(s) a revisar, 3 ya en poder del cliente, de 9 medición(es) evaluadas
```

El caso de reensayos se comprueba llamando a `revisarReensayos()`, no leyendo la base: es una derivación, y afirmar que la demo lo trae sin ejecutarla sería suponerlo.

No entra en `npm test` porque sembrar la demo entera tarda y la suite ya dura ocho minutos. Se corre cuando se toca un sembrador.

## Lo que sí entra en la suite

`tests/la-demo-trae-los-casos.test.ts`: 8 pruebas baratas que guardan lo que hace que los casos ocurran — que la compra lleve el lote del proveedor, que se compre dos veces el mismo, que la segunda entrega quede **después** de producción (si quedara antes se consumiría y no habría saldo que inmovilizar), que las mediciones salgan del plan con su instrumento, y que no se pisen los ensayos cargados a mano.

## Nota sobre `erp_dev`

La base de desarrollo ya tenía sus propios ensayos y un plan hecho a mano con una sola característica, así que al correr `npm run seed:calidad` allí solo se completó el lote que no tenía mediciones. Es el comportamiento buscado: el sembrador completa lo que falta y no reescribe lo que hay.
