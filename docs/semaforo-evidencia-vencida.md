# El semáforo carga toda la evidencia que caducó

Tres ciclos seguidos terminaron con la misma frase escrita en su documentación: **«el aviso sigue siendo pasivo»**.

| Qué caducó | Dónde se veía |
| --- | --- |
| Homologación por vencer o vencida | en rojo, en la ficha del producto |
| Equivalencia que hoy cubre menos | en rojo, en la ficha del competidor |
| Calibración vencida o fuera de tolerancia | en rojo, en la ficha del instrumento |

Las tres **solo para quien abría esa pantalla**. Construir la degradación automática —para que nadie tuviera que acordarse de revisar— y después esconderla detrás de una pantalla que hay que acordarse de abrir deja el trabajo a mitad de camino. El ciclo de calibración pagó un tercio de esa deuda; este paga el resto.

## La forma que comparten las tres

Es la misma en los tres casos: **algo que se afirmó con respaldo, y el respaldo caducó sin que nadie tocara la afirmación**.

- El certificado afirmaba una homologación; la aprobación venció.
- La equivalencia afirmaba cubrir tres especificaciones; una dejó de contar.
- El ensayo afirmaba una densidad; el instrumento perdió su calibración.

Ninguna de las tres rompe nada de inmediato, y por eso ninguna se nota. Eso es exactamente lo que las hace peligrosas.

## `senalMasSevera`, y por qué hacía falta extraerla

Cada módulo del semáforo muestra **una** línea, así que con varias cosas que decir hay que elegir. La regla ya existía en Finanzas —una operación sin asiento tapa a una factura vencida— escrita a mano con ternarios anidados de tres niveles. Cada fuente nueva agregaba un nivel y repetía la regla.

Ahora es una lista de señales y gana la más severa; entre iguales, la primera. **La decisión de qué pesa más queda a la vista en el orden**, no escondida en un ternario.

## Qué severidad tiene cada una

**Calibración sin vigencia: crítico.** Lo que mida un instrumento vencido o fuera de tolerancia no se sostiene — no puede liberar un lote. No es un recordatorio.

**Homologación vencida: atención.** No rompe nada: el certificado ya dejó de imprimirla y la cobertura de las equivalencias ya bajó sola. Lo que hace falta es renovarla.

**Equivalencia degradada: atención.** Se sigue ofreciendo un reemplazo cuya evidencia se debilitó. Es una afirmación comercial desactualizada, y va **antes** que la caída de ventas cuando las dos pesan igual: es algo concreto que alguien puede corregir hoy.

## Un error del ciclo anterior, corregido

La fila de Calidad colgaba entera del interruptor de calibración. Como las homologaciones no tienen nada que ver con el laboratorio, con el control apagado —que es el estado de hoy, porque el laboratorio se está implementando— **habrían quedado invisibles**.

Ahora la fila es permanente y lo que cuelga del interruptor es solo la señal de calibración. Hay una prueba que falla si alguien vuelve a colgarla entera.

## Verificación en navegador (`erp_dev`)

Con el control de calibración **encendido**:

```
Comercial   1 equivalencia que cubre menos que al declararla   Atención
Calidad     1 instrumento sin calibración vigente              Crítico
```

Con el control **apagado**, la fila de Calidad no desaparece: cae a la señal que queda.

```
Comercial   1 equivalencia que cubre menos que al declararla   Atención
Calidad     1 homologación vencida                             Atención
```

Las tres fuentes son datos reales de los ciclos anteriores: la homologación Mercedes-Benz 228.31 que venció en junio, la equivalencia GR-CHASIS ↔ Delvac 1340 que pasó de 3 de 3 a 2 de 3 por esa misma homologación, y el densímetro DM-01 con calibración vencida.

`tests/semaforo-evidencia.test.ts`: 12 pruebas.

## Lo que queda fuera

- **El semáforo sigue siendo una pantalla.** Nadie recibe un correo ni una notificación: hay que entrar al panel general. Es mejor que antes —el panel se abre todos los días y las fichas no— pero no es una alerta que persiga a nadie.
- **No hay histórico de cuándo se degradó algo.** Se sabe que hoy cubre menos, no desde cuándo.
- **Los lotes de envasado por vencer siguen sin llegar al semáforo.** Es una cuarta fuente con la misma forma que las tres, y no se sumó en este ciclo.
