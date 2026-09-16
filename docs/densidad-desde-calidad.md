# La densidad la mide el laboratorio, no la teclea producción

El ciclo de la densidad (`docs/densidad-masa-volumen.md`) dio a `LoteGranel` una densidad medida, porque la del producto es una especificación y la del lote es lo que de verdad salió. Lo que no hizo —y esto lo corrige— es conectarla con **quien la mide**.

## La desconexión

El plan de inspección de calidad ya hace medir la densidad: es una característica como la viscosidad, con límites, método de ensayo y valor medido, y queda guardada en `ResultadoCaracteristicaCalidad`. Ahí se quedaba. Nadie la leía.

Mientras tanto, `LoteGranel.densidadKgL` —el número que convierte kg en litros en **cada comprobante** que salga de ese lote— se tecleaba a mano en el formulario de *Finalizar cocción*.

El orden es lo que lo vuelve grave:

```
finalizarLote  →  estado = PENDIENTE_CALIDAD  →  registrarCalidad
   ↑                                                  ↑
   producción teclea una densidad             el laboratorio la MIDE
   (la que gobierna la facturación)           (y no se usaba)
```

Producción escribía la densidad **antes** de que el laboratorio la midiera. Así que la facturación se apoyaba en un número provisional y la medición real del ensayo no servía para nada.

Nada fallaba. Las dos cifras son plausibles —0,88 y 0,8814 se parecen— y no había nada que las comparara. El error solo aparece en los litros declarados, uno por uno, sin ruido.

## Lo que cambia

`CaracteristicaPlanCalidad` gana `esDensidad`: marca **cuál** de las mediciones del plan es la densidad del lote.

- Como máximo una por plan. Con dos no hay forma de decir cuál rige, y quedarse con la primera sería inventar un criterio que nadie declaró.
- **Obligatoria**, siempre. Una densidad que se mide «a veces» deja lotes sin ella, y esos no se pueden convertir a litros.
- La unidad tiene que ser de densidad. Se aceptan `kg/L`, `g/cm³` y `g/mL` porque son **numéricamente idénticas** —1 g/cm³ = 1 kg/L exactamente—, así que aceptarlas no convierte nada: es la misma cifra con otro nombre, y ASTM D4052 reporta en g/cm³. Lo que **no** se acepta es una magnitud adimensional: la *densidad relativa* es un cociente contra el agua, no kg por litro, y tomarla por densidad metería ~0,1 % de error en cada litro declarado.

Al registrar la calidad, el valor medido de esa característica pasa a `LoteGranel.densidadKgL`. Se toma **aunque el lote salga rechazado**: es un hecho medido, y un lote rechazado puede reprocesarse.

## Un solo camino, no dos

El campo manual de *Finalizar cocción* desaparece cuando el plan vigente mide la densidad, y el servidor **rechaza** el valor aunque llegue igual.

Las dos mitades hacen falta. Ocultar el campo sin validar en el servidor deja la puerta abierta a un POST fabricado —las acciones de servidor son endpoints públicos—; validar sin ocultar convierte la pantalla en una trampa para quien la llena de buena fe.

Cuando el plan **no** mide la densidad, el campo manual sigue estando y funciona como antes. El cambio es aditivo: los planes que ya existían quedaron en `esDensidad = false` y se comportan igual que siempre.

## Dónde se equivocan los ERP genéricos

Esta desconexión no es un descuido local: es la forma normal de los ERP grandes. El módulo de calidad guarda resultados como **documentación** —para imprimir el certificado de análisis y aprobar o rechazar— y el factor que convierte unidades vive en el maestro de materiales, en otra tabla, puesto por otra persona, en otro momento. En SAP se mide en QM y la conversión sale de MARM, y nada obliga a que digan lo mismo.

Para un fabricante de lubricantes eso importa más que en otros rubros: el producto se produce y cuesta en kilos, se vende y se declara en litros o galones, y la densidad es lo único que une las dos cosas. Un ensayo que mide la densidad y no la entrega al lote está midiendo para el archivador.

## Verificación

Cadena completa en navegador contra `erp_dev`:

1. Plan publicado con la densidad marcada. Marcarla con unidad `cSt` se rechazó: *«Densidad a 15 C alimenta la densidad del lote, así que su unidad debe ser kg/L (o g/cm³, que es la misma cifra). «cSt» no lo es.»*
2. LG-00004, 100 kg objetivo, liberada. El formulario de cierre **no mostró** el campo de densidad — solo kg producidos y horas.
3. Ensayo registrado con 0,8814 kg/L dentro de 0,86–0,90 → APROBADO.
4. `LoteGranel.densidadKgL = 0.8814`. El valor del laboratorio, que antes no llegaba.

Y el POST fabricado: en LG-00005 se **inyectó** en el formulario el campo `densidadKgL = 0.95` que la pantalla no ofrece. El servidor lo rechazó con el motivo, y el lote quedó como estaba —`EN_PROCESO`, `kgProducidos = 0`, `densidadKgL = null`—, sin finalizar a medias.

`tests/densidad-desde-calidad.test.ts`: 11 pruebas. Se verificó que las guardias detectan la reintroducción del defecto — quitando la escritura al lote y volviendo incondicional el campo manual, fallan con *«la densidad medida no se escribe en el lote»* y *«el campo no es condicional»*.

## Lo que queda fuera

- **El re-análisis de envasados no captura valores medidos.** `ReanalisisEnvasado` guarda contra qué plan se ensayó, pero no las lecturas. Quedó anotado al construirlo y sigue abierto.
- **Los planes de inspección de insumos** (`CaracteristicaPlanInsumo`) tienen la misma forma y no se tocaron: un insumo a granel también tiene densidad, pero hoy nada la consume, y agregar el campo sin lector sería un campo muerto.
