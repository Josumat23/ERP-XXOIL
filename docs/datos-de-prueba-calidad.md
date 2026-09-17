# Datos de prueba del laboratorio y del catálogo técnico

`seed-demo.ts` tiene 1.046 líneas y siembra el flujo comercial entero —clientes, pedidos, facturas, cobros, compras, lotes, envasados, activos, mantenimiento— y **cero** de los módulos de calidad: ni una especificación, ni un competidor, ni un instrumento, ni un plan de inspección.

Por eso seis ciclos de trabajo «no se veían». No faltaban datos del negocio: **el sembrador se había quedado atrás.**

```bash
npm run seed:calidad
```

Es idempotente: correrlo dos veces no duplica nada.

## Qué siembra, y por qué así

### La data cuenta una historia

Sembrar todo «en verde» dejaría las alertas sin nada que decir, y nadie sabría si funcionan. Así que cada pantalla construida tiene su caso:

| Sembrado a propósito | Qué hace visible |
| --- | --- |
| Una homologación **vencida** (Cummins CES 20086) | Deja de imprimirse en el certificado · semáforo en ámbar |
| Una homologación **por vencer** (DIN 51825, 60 días) | El aviso a 90 días |
| Una equivalencia declarada cubriendo 4 de 4 | Hoy aparece **degradada**: la homologación venció |
| `VIS-01` con vigencia a 20 días | Instrumento **por vencer** |
| `PEN-01` con vigencia pasada | Instrumento **vencido** |
| `BAL-01` con verificación `NO_CONFORME` | Instrumento **fuera de tolerancia** → lotes en la lista de reensayo |

### Especificaciones de grasas, no de aceite de motor

Las que había cargadas a mano —API CK-4, ACEA E9, MB 228.31— son de **aceite de motor** y no aplican a ninguno de los dos productos del catálogo, que son grasas. El sembrador carga las que corresponden: NLGI 1/2/3, API GC-LB, ISO 6743-9 L-XBCEA 2, DIN 51825 KP2K-30, Cummins CES 20086.

Las viejas se dejan: son datos de prueba válidos y borrarlas no aporta nada.

### Los competidores son marcas inventadas

Vulcano, Andes Lub, Kordal. **No son reales, y es deliberado.**

Un sembrador viaja con el repositorio y termina en demos y capturas de pantalla. Afirmar ahí que el producto de una empresa real cumple tal norma es poner en circulación una declaración sobre un tercero que nadie verificó. Las marcas ficticias prueban exactamente igual.

(El modelo guarda `fuente` justamente porque, con competidores reales, lo que se registra no son hechos verificados por XXOIL sino lo que la literatura del competidor declara.)

### El control queda en `ADVIERTE`

En producción el nivel nace en `NO_APLICA`: el laboratorio no frena nada hasta que la empresa lo decida, y eso no cambia.

Pero **este es un sembrador de prueba**, y dejarlo apagado escondería justo lo que se acaba de sembrar —un instrumento vencido, otro fuera de tolerancia— detrás de un interruptor que nadie sabe que existe. `ADVIERTE` y no `BLOQUEA`: avisa sin frenar.

Para volver al comportamiento de producción: Producción → Instrumentos de medición → «No aplica».

## Verificación en navegador (`erp_dev`)

Antes del sembrador, la fila de Calidad del panel decía «1 homologación vencida» y la de Comercial «1 equivalencia». Después:

| Módulo | Indicador |
| --- | --- |
| Comercial | 2 equivalencias que cubren menos que al declararla — Atención |
| **Calidad** | **2 lotes despachados con mediciones sin respaldo — Crítico** |

Y los cinco instrumentos, cada uno en su estado:

```
DM-01  Densímetro digital        Anton Paar DMA 35
VIS-01 Viscosímetro cinemático   Cannon CT-1000      Por vencer
PEN-01 Penetrómetro de grasas    Koehler K19500      Calibración vencida
BAL-01 Balanza analítica         Mettler ME204       Fuera de tolerancia
TER-01 Termómetro de inmersión   Fluke 1523          Calibrado
```

## Lo que queda fuera, y por qué

- **No siembra ensayos ni re-análisis.** Los lotes existentes ya tienen sus controles; fabricar mediciones históricas sería inventar un pasado que nadie vivió. Lo que sí queda listo es el camino: planes con densidad marcada e instrumento declarado, para que el próximo ensayo que alguien registre alimente la cadena completa.
- **No toca `seed-demo.ts`.** Son dos sembradores independientes, como `seed:segunda-empresa`. El demo completo es `seed:demo` y después `seed:calidad`.
- **No siembra productos nuevos.** Los dos que hay alcanzan para que las equivalencias y los planes tengan sentido; agregar más cambiaría precios, stock y comisiones del demo comercial sin necesidad.
