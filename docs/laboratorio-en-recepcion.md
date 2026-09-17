# El laboratorio también mide lo que entra

Los ensayos de producción ya registraban con qué instrumento se midieron. La inspección de recepción no.

Es el mismo laboratorio y son los mismos equipos: **una calibración vencida no distingue entre lo que se compra y lo que se fabrica**. El aceite base aceptado con un viscosímetro descalibrado no aparecía en ninguna lista, y la pregunta «¿qué midió este instrumento?» devolvía una respuesta incompleta sin avisar.

Ahora el plan de inspección de insumos declara con qué instrumento se espera medir cada característica, la inspección registra con cuál se midió de verdad, y esas mediciones entran en **«Qué hay que reensayar»** y en la ficha del instrumento junto a las de producción.

## Dos defectos que aparecieron al abrir esta puerta

### 1. Publicar un plan de inspección de insumos estaba roto

`normalizarCaracteristicasPlan` lo comparten el plan de **producto** y el de **insumo**. Cada campo que ganó para el producto —`esDensidad` en el ciclo de la densidad, `instrumentoId` en el de trazabilidad— llegaba al `create` de un modelo que no lo tiene, y Prisma rechazaba la operación.

Estuvo roto **dos ciclos** sin que nada lo avisara:

- **TypeScript no lo ve**: la revisión de propiedades de más solo se aplica a objetos literales, no a una variable que se pasa.
- **No había prueba** que publicara un plan de insumos.
- **No había datos**: cero planes en la base, así que nadie abrió la pantalla.

Corregido copiando campo por campo, con el motivo escrito en el código, y con dos pruebas: una que publica un plan de verdad y otra que comprueba que pasarle el objeto entero **sigue fallando** —para que la primera no pase por casualidad—.

La marca de densidad **no** se copia al plan de insumos, a propósito: la densidad de un insumo no gobierna ninguna conversión hoy, y agregarla sería inventar un requisito.

### 2. La pantalla de evaluar una recepción no se podía usar con un plan vigente

El servidor le pasaba al componente cliente el plan tal como sale de Prisma, con sus `Decimal`:

> Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported.

El tipo del cliente decía `{ toString(): string } | null`, que compila y falla en ejecución. La pantalla quedaba cargando para siempre.

**Este no se encontró leyendo código ni con pruebas: se encontró ejecutando la pantalla.** Corregido pasando valores planos.

## La tercera copia de la misma operación

Armar los resultados a partir del plan y las lecturas estaba escrito a mano también acá. Es la tercera vez que aparece la misma regla; ahora las tres usan `resultadosDelEnsayo`. Una regla de negocio copiada es cómo dos ensayos terminan aplicando criterios distintos sin que nadie lo decida.

## Dónde viven las mediciones de recepción

En su propia tabla (`mediciones_inspeccion_compra`), no en la de los otros dos ensayos.

Es una decisión distinta a la del ciclo anterior, y a propósito. Allí las lecturas del re-análisis **todavía no existían**, así que compartir tabla no costaba nada. Acá la tabla ya existe con su historia: unificarla sería una migración de datos, no un cambio aditivo, sobre un flujo de compras que funciona.

El precio es que la consulta tiene que recorrer dos tablas. La protección contra olvidarse de una es que **solo hay un lugar donde acordarse**: `revisarReensayos`. Cuando eso deje de alcanzar —o cuando haga falta tocar la tabla por otro motivo— unificarlas es el movimiento correcto.

## «Ya salió» quiere decir otra cosa para un insumo

La lista ordena por dónde está el material, y para un insumo eso no es el cliente:

| Destino | Lote o envasado | Insumo recibido |
| --- | --- | --- |
| `DESPACHADO` | Ya está en poder del cliente | **Ya se consumió en producción** |
| `EN_ALMACEN` | Todavía en almacén | Todavía en almacén, sin consumir |
| `SIN_SALIDA` | Nunca salió | Ni consumido ni en stock |

Es la misma posición en la lista y son dos conversaciones distintas: si el insumo ya se consumió, el problema deja de ser el insumo y pasa a ser **lo que se fabricó con él**.

## Verificación en navegador (`erp_dev`)

1. **Se publica un plan de inspección de insumos** —lo que estaba roto—: `MP-ACEITE-BASE · Recepcion de aceite base v1 · Viscosidad a 100 C [10.5, 12.5] cSt`, con `DM-01` declarado como instrumento esperado.
2. Al evaluar una recepción, el selector de instrumento **aparece ya en `DM-01`**, heredado del plan.
3. Con `11.8 cSt` la inspección queda aprobada y su tabla de resultados muestra la medición **con el instrumento**: `10.5 a 12.5 cSt · 11.8 cSt · DM-01`.
4. Como `DM-01` volvió fuera de tolerancia, esa inspección entra sola en la lista de reensayo, junto a los ensayos de producción:

   | Lote / envasado | Ensayo | Qué queda sin respaldo | Dónde está |
   | --- | --- | --- | --- |
   | LG-00001 | Liberación del lote | En duda | Ya está en poder del cliente |
   | ENV-00003 | Re-análisis de vigencia | Sin calibración vigente | Ya está en poder del cliente |
   | LG-00004 | Liberación del lote | En duda | Todavía en almacén |
   | **RC-FX-001 · MP-ACEITE-BASE** | **Inspección de recepción** | Sin calibración vigente | **Todavía en almacén, sin consumir** |

5. La ficha del instrumento lista las cuatro, cada una con su clase de ensayo.

`tests/laboratorio-en-recepcion.test.ts`: 13 pruebas. La guarda del defecto se comprobó reintroduciéndolo: volver a pasar el objeto entero del normalizador hace fallar su prueba.

## Lo que queda fuera, y por qué

- **No se dice qué lotes se fabricaron con el insumo en cuestión.** La cadena existe en la base (`AsignacionLoteInsumo`), y contestarla bien es un ciclo propio: hay que decidir si se muestran los lotes, los envasados o los clientes finales.
- **La recepción no tiene ficha propia a la que enlazar** desde la lista; se identifica por su número y el código del insumo.
- **Sigue sin bloquear ni advertir al liberar** con un instrumento sin calibración vigente: la misma decisión de calidad pendiente desde hace cuatro ciclos.
