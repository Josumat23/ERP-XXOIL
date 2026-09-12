# El aporte patronal a EsSalud, con cuenta propia

Corrige lo que quedó a la vista al sembrar las cuentas de control de planilla el mismo día.

## El problema

El asiento de planilla imputaba el **aporte patronal de EsSalud** a la misma cuenta que la remuneración, porque usaba **una sola clave de control** (`GASTO_PERSONAL`) para las dos líneas:

```ts
lineas.push({ clave: "GASTO_PERSONAL", glosa: l.empleado, debe: l.remuneracionComputable, ... });
if (l.essaludPatronal > 0) {
  lineas.push({ clave: "GASTO_PERSONAL", glosa: `EsSalud — ${l.empleado}`, ... });  // ya no
}
```

En el PCGE el aporte patronal es una **contribución social de la empresa** y corresponde a la divisionaria **627**, no a **621**: no es remuneración del trabajador. Con una sola clave, los dos importes terminaban en 6211 «Sueldos y salarios», y el gasto de personal del período quedaba sobrestimado mientras la cuenta de contribuciones aparecía en cero.

No era una hipótesis: el asiento real de la verificación anterior mostraba `6211 debe 2 500` **y** `6211 debe 225` en el mismo documento.

## Lo que se hizo

Clave propia `GASTO_ESSALUD_PATRONAL` → cuenta **6271 Régimen de prestaciones de salud**, sembrada y con migración idempotente para las bases ya instaladas, con el mismo patrón del ciclo anterior: cada control contra el plan de **su** compañía, sin pisar una cuenta o un control ya configurados. Verificado sobre dos compañías, una con un 6271 propio llamado «Seguridad social»: quedó intacto.

Como siempre, la cuenta es un **valor inicial razonable y no una afirmación** — se reapunta desde Finanzas → Plan de cuentas, y una prueba exige que la clave tenga etiqueta para que aparezca ahí.

## El detalle que casi se pierde

La clave nueva se agregó también a `CLAVES_RECLASIFICABLES`.

Suena a trámite y no lo es: ese importe **ya era reclasificable** entre centros de costo, porque vivía dentro de `GASTO_PERSONAL` y lleva `centroCostoId`. Separar la clave sin ponerla en la lista le habría quitado, en silencio, una capacidad que nadie pidió quitar — una corrección contable que rompe una función de gestión. Hay una prueba que lo exige.

## Lo que no se toca

**Los asientos ya contabilizados no se reescriben.** Un asiento emitido es historia, y moverlo de cuenta cambiaría balances de períodos posiblemente cerrados. Si el contador quiere corregir los anteriores, es un asiento de reclasificación — decisión suya, con la pantalla que ya existe.

**Gratificación, CTS y liquidación no cambian.** Son inafectas a EsSalud (está dicho en sus propios comentarios desde antes), así que ahí `GASTO_PERSONAL` es la clave correcta y sigue siéndolo. Se revisaron las tres antes de tocar nada.

## Verificación

**8 pruebas** en el archivo (338 en total): que las dos cuentas existan y sean distintas, que `postearPlanilla` use la clave nueva para el patronal y deje **una sola** línea con `GASTO_PERSONAL`, que la clave siga siendo reclasificable, que el asiento cuadre, y que las dos migraciones cubran entre ambas las siete claves sin pisar nada.

**En navegador**, sobre una base de demostración nueva con un empleado en ONP y S/ 2 500 de básico, generando la planilla desde su pantalla:

| Cuenta | Debe | Haber |
|---|---:|---:|
| 6211 Sueldos y salarios | 2 500.00 | |
| **6271 Régimen de prestaciones de salud** | **225.00** | |
| 4032 ONP / AFP por pagar | | 325.00 |
| 4031 EsSalud por pagar | | 225.00 |
| 4111 Sueldos y salarios por pagar | | 2 175.00 |

Cuadrado en S/ 2 725 y con el patronal ya fuera de la cuenta de sueldos. La ficha muestra «Gasto patronal EsSalud del período (no descontado al trabajador): S/ 225.00», que ahora coincide con lo que dice el libro.

## Nota sobre la verificación

Durante el recorrido apareció un 404 al abrir la planilla recién generada. **No es un defecto del producto**: fue consecuencia de haber ejecutado `npm run build` con los cambios guardados en *stash* mientras el servidor de desarrollo seguía corriendo, y los dos escribieron sobre `.next`. Reiniciando el servidor con la carpeta limpia, la ficha abre normalmente.
