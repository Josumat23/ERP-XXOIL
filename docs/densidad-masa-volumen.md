# Densidad: convertir masa en volumen

**2026-09-16.** El granel se produce, se controla y se cuesta en **kilogramos**. El producto se vende y se declara a SUNAT en **litros o galones**. El puente entre los dos es la densidad, y hasta hoy no existía en el sistema.

## El defecto que lo destapó

`presentaciones/actions.ts` permite elegir `LTR`, `GLL`, `KGM` o `BLL` como unidad SUNAT de una presentación. Las tres salidas de comprobante —factura, nota de crédito y guía de remisión— armaban el ítem así:

```ts
unidadMedida: presentacion.unidadMedidaSunat,   // "LTR"
cantidad: d.cantidad,                            // 10  ← baldes, no litros
```

Un balde de 20 L configurado como `LTR` declaraba **«10 LTR»** cuando son 200 litros. El número y su unidad se contradecían en un documento fiscal, y nada lo validaba.

Que el defecto estuviera en los tres lugares a la vez no es casualidad: es lo que pasa cuando la regla se repite en vez de compartirse. Por eso ahora vive en `src/lib/itemComprobante.ts` y las tres la usan.

**Qué código corresponde a un producto envasado es una pregunta tributaria** y no se responde acá. Lo que sí es responsabilidad del sistema es que la cifra signifique lo que su unidad dice.

## Dónde se equivocan SAP y Epicor

Los dos resuelven masa↔volumen con un **factor de conversión fijo por material** — en SAP, la tabla MARM: 1 L = X kg. Es un dato maestro constante.

El problema es que la densidad **no es una constante**: varía de lote en lote y con la temperatura. Cuando la densidad real difiere de la cargada, la conversión sale mal **en silencio** — no hay error, no hay aviso, solo una cantidad equivocada en cada documento.

SAP lo reconoce al punto de vender **IS-Oil** como complemento aparte, cuyo módulo de conversión de cantidades existe precisamente para agregar densidad y temperatura. El núcleo se equivoca y el arreglo se cobra.

## Cómo se modela acá

| Dónde | Campo | Qué significa |
| --- | --- | --- |
| `Producto` | `densidadKgL` | Densidad de **especificación**: a qué se apunta |
| `Producto` | `temperaturaReferenciaC` | A qué temperatura se midió |
| `LoteGranel` | `densidadKgL` | Densidad **medida** de ese lote: qué salió |

**La del lote manda sobre la del producto.** La especificación dice a qué se apunta; la medición dice qué salió, y lo que se envasó es lo que salió.

**Sin temperatura, una densidad no significa nada.** Un lubricante cambia ~0,7 % cada 10 °C, así que el número solo es comparable si dice a qué se tomó. Cargar densidad sin temperatura se rechaza. 15 °C es la referencia habitual de los ensayos de petróleo (ASTM D1298 / D4052), pero se declara y no se asume.

**Sin densidad, el sistema no convierte.** No supone un factor: se niega y dice qué falta. Es la diferencia central con el enfoque de los ERP grandes — una conversión que no se puede hacer bien es mejor no hacerla que hacerla mal.

**Toda conversión dice con qué densidad se hizo.** Una cantidad declarada en un comprobante fiscal tiene que poder auditarse hasta su origen; no alcanza con el número.

## Qué NO hace

**No corrige por temperatura.** La corrección volumétrica del petróleo (ASTM D1250 / tablas API) necesita el coeficiente de expansión del producto, que no está en el sistema y que nadie pidió. Lo que sí hace es no dejar comparar densidades tomadas a temperaturas distintas, que es el error que produciría un número creíble y equivocado.

## Dos controles que evitan errores silenciosos

**La coma corrida.** Un lubricante ronda 0,80–1,05 kg/L. Un `8,7` en vez de `0,87` produciría un volumen diez veces menor en cada comprobante de ese lote. Se avisa al capturar la densidad medida — se avisa, no se prohíbe: quien tenga un producto fuera de rango puede cargarlo desde la ficha.

**El contenido en litros sin contrastar.** `Presentacion.contenidoLitros` se carga a mano y no se comparaba con nada. Un balde de 20 kg de un producto de 0,88 kg/L son 22,7 L; si alguien escribe 20, ese error viaja hasta la factura. Ahora se contrasta contra peso y densidad **al crear y al editar** — validar solo en el alta deja la puerta abierta a crear bien y editar mal.

La tolerancia es del 2 % porque el contenido nominal de un envase es un número comercial redondeado, no el resultado de una división.

## La transición

Los tres campos son **opcionales y sin valor por defecto**. Ningún producto existente se rellena con una densidad inventada — que es exactamente el error que este módulo evita.

La consecuencia es gradual y deliberada: mientras un producto no tenga densidad, sus presentaciones se pueden seguir declarando en `NIU` como siempre, y solo se bloquea si alguien intenta declararlas en `LTR` o `GLL`. La restricción se activa sola a medida que se carga el dato.

## Dónde mirar

- `src/lib/densidad.ts` — las conversiones, puras y probadas.
- `src/lib/itemComprobante.ts` — la regla única de las tres salidas de comprobante.
- `tests/densidad.test.ts` — 19 pruebas, incluidas las guardias de que ninguna salida vuelva a armar el ítem por su cuenta y de que los campos nuevos no sean obligatorios.
