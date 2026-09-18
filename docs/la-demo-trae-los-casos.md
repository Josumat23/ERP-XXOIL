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

---

## Actualización: el tanque con mezcla

El módulo de tanques es lo que distingue a este sistema de los grandes: la base lubricante llega en cisterna y se descarga sobre el remanente de la anterior, así que los lotes quedan **mezclados**, y un consumo se reparte **en proporción** entre ellos en vez de obligar a elegir uno —que es lo que hace SAP y produce «una respuesta equivocada con aire de certeza»—.

No había **un solo tanque sembrado**. La pantalla existía y no se podía ni abrir.

Ahora `npm run seed:trazabilidad` crea `TK-01` (base lubricante 500N, 3 000 kg) y descarga en él dos lotes del proveedor distintos. Tres decisiones:

**Dos lotes, no uno.** Con uno solo el reparto proporcional no se puede ver, así que `seed-demo.ts` compra una cisterna más con su propio número de lote. Desde cero: 60 kg de `AB-2026-014` y 90 kg de `AB-2026-021`, 150 kg mezclados.

**Solo una parte de cada recepción.** El negocio confirmó que recibe de las dos formas —lo envasado conserva su lote, el granel va al tanque—, y además descargar todo dejaría la recepción en cero: la pantalla de recall ya no podría decir cuánto del lote sospechoso sigue sin consumirse. Con la descarga parcial, `AB-2026-014` queda con 40 kg sueltos y el caso del recall sobrevive.

Eso último lo detectó la propia comprobación: `descargarEnTanque()` **decrementa `cantidadDisponible`**, así que una descarga total habría roto en silencio el caso sembrado dos ciclos antes. La guarda «queda material sin consumir» lo habría puesto en rojo.

**La descarga no se escribe a mano.** La hace `descargarEnTanque()`, que mueve la disponibilidad con reclamo optimista y registra el aporte. Insertar las filas por afuera sería una segunda implementación de una regla de saldos.

En `erp_dev` el tanque queda con **un** solo lote, porque esa base ya tenía sus compras hechas y `seed-demo.ts` no se puede volver a correr encima. El sembrador lo dice al terminar en vez de aparentar una mezcla que no existe.

---

## Actualización: un lote que no pasó calidad

La no conformidad **la abre el sistema al rechazar** un lote: no es un registro que alguien cree por su cuenta. Los tres lotes de la demo salían aprobados, así que no existía ninguna — y con ella quedaba invisible todo el circuito que viene después: contención, causa raíz, acción correctiva y verificación de eficacia.

Ahora la demo produce un cuarto lote que **no pasa**. Consumió su material igual —eso ya ocurrió— y no deja nada disponible para envasar: qué se hace con él lo decide calidad después.

La historia cierra sola:

| | |
| --- | --- |
| Causa raíz | «Jabón de litio agregado por debajo de la fórmula por una balanza descalibrada en la sala de pesaje» |
| Penetración trabajada 60× | **298.6** contra un límite superior de **295** → no conforme |
| Densidad y punto de goteo | Dentro de especificación |
| Lote | `LG-00004`, RECHAZADO |
| No conformidad | ABIERTA, con su primer evento |

Un rechazo con todas las lecturas conformes sería una contradicción impresa: la ficha mostraría un ensayo que no dice por qué se rechazó. Por eso el sembrador de calidad, al completar las mediciones de un control **RECHAZADO**, pone fuera de límite precisamente la característica que la causa raíz menciona —la penetración, que es lo que describe una grasa más blanda—.

### `dev:demo` levantaba una base a medias

`npm run dev:demo` es la forma de revisar la aplicación en el navegador, y sembraba solo el flujo comercial: la base que se usa **justamente para mirar** tenía las mismas pantallas en blanco que se habían encontrado sembrando desde cero. Ahora corre los cinco sembradores.

---

## Actualización: capacidad con carga abierta

La planificación de capacidad muestra la **carga abierta** por centro: las operaciones de las órdenes que todavía no terminaron. La demo no tenía ni un centro de trabajo, ni una ruta en la fórmula, ni una orden abierta — la pantalla salía vacía por triplicado.

Una planta siempre tiene trabajo en curso. Sembrar solo órdenes terminadas deja la planificación sin nada que planificar.

Ahora la demo trae:

- **Cuatro centros de trabajo**: pesaje y premezcla, reactor de saponificación, molino coloidal, línea de envasado, con sus horas por día y su eficiencia.
- **La ruta de la fórmula**: pesaje → saponificación → molienda, con horas de preparación, máquina y mano de obra por cada 100 kg, que se escalan solas con el tamaño del lote.
- **Una orden abierta** de 120 kg, planificada, con su ruta y su material **reservado**.
- Las tres órdenes ya cerradas llevan su ruta **completada**: sin ella, la ficha de un lote terminado no muestra por dónde pasó, y la ruta parecería inventada para la orden nueva.

### Reservar no es consumir

La orden abierta crea `ReservaInsumoProduccion`, no movimientos de kardex. El material se consume al liberar la orden, no al planificarla — que es exactamente lo que hace `crearLote()` por pantalla.

Que eso sea cierto se ve en los números: después de agregar la orden abierta, el material sin consumir del lote del proveedor siguió en **18.88 kg** y el tanque en **118.32 kg**, idénticos a antes. Si la orden hubiera consumido, esos dos habrían cambiado y las guardas lo habrían dicho.

La línea de envasado queda sin carga, y está bien: el envasado es un proceso aparte y la ruta del granel no pasa por ahí. La pantalla lo dice —«Sin carga abierta»— en vez de inventarle trabajo.
