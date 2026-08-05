# TEST — Verificación — comercial-embudo-ventas

## Escenario 1 — Crear cotización con probabilidad
- **Pasos:** crear cotización real (cliente "Comercial Andina del Sur E.I.R.L.", vendedor "Carlos Huamán", 5 × Grasa Chasis Pote 1lb a S/12.50, probabilidad 30%).
- **Resultado esperado:** total S/62.50, valor ponderado S/18.75 (62.50 × 0.30).
- **Resultado obtenido:** exacto — `COT-00001` creada con esos valores, verificado en el detalle y en la lista.

## Escenario 2 — Pipeline agregado
- **Pasos:** abrir `/comercial/pipeline` con la cotización del escenario 1 como único registro pendiente.
- **Resultado esperado:** 1 cotización, total S/62.50, ponderado S/18.75; bucket "Media (26-50%)" con 1 y S/62.50; vendedor "Carlos Huamán" con S/18.75 ponderado.
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 3 — Cierre fija probabilidad a 100%
- **Pasos:** marcar la cotización del escenario 1 como "Aceptada".
- **Resultado esperado:** probabilidad pasa a 100%, valor ponderado a S/62.50, formulario de ajuste desaparece (ya no PENDIENTE).
- **Resultado obtenido:** exacto a lo esperado.

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios (incluye `comercial/cotizaciones/page.tsx`, ya en la lista baseline por un motivo no relacionado — confirmado que los errores en ese archivo son los mismos de siempre, no nuevos).

## Datos de prueba a limpiar
- `COT-00001` (con su `CotizacionDetalle`) insertada vía UI real, eliminada por SQL tras la verificación. Confirmado post-limpieza: 0 cotizaciones en la base.
