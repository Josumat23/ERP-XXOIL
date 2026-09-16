# Re-análisis: extender la vigencia de un lote sin perder el rastro

**2026-09-16.** Un lubricante no se echa a perder al llegar su fecha. La vida útil de `Producto.vidaUtilMeses` es una estimación conservadora: llegado el vencimiento, el laboratorio vuelve a ensayar el lote y, si sigue en especificación, le da vigencia nueva.

El negocio lo confirmó el 2026-09-16: **se vuelve a ensayar y se extiende.**

Sin esto el vencimiento es duro y obliga a **castigar stock bueno** — que es lo que hacen los ERP genéricos, donde la caducidad es un dato del lote y no el resultado de una decisión de calidad.

## No es cambiar una fecha

Es un **evento con evidencia**. Un sistema que se limita a dejar editar `fechaVencimiento` convierte la prórroga en algo invisible, y extender un vencimiento sin dejar rastro es exactamente lo que una auditoría de calidad busca.

`ReanalisisEnvasado` guarda:

| Campo | Por qué |
| --- | --- |
| `vencimientoAnterior` | se conserva en la fila y no se deduce: cuando alguien lee el historial, el envasado ya fue actualizado |
| `vencimientoNuevo` | la vigencia que quedó |
| `resultado` | `APROBADO` / `RECHAZADO` |
| `planInspeccionId` + `planVersion` | contra qué se ensayó, **con su versión**: un plan cambia, y el ensayo tiene que poder reconstruirse tal como se hizo |
| `usuarioId`, `usuarioNombre`, `fecha` | quién y cuándo |

El envasado sí actualiza su `fechaVencimiento` — la historia vive en las filas de re-análisis.

## La regla que sostiene todo

**Un ensayo `RECHAZADO` no puede extender la vigencia.** Si pudiera, el re-análisis sería una forma de blanquear stock vencido con un papel.

Se valida en el servidor, no solo en el formulario. Verificado: intentar extender con `RECHAZADO` devuelve *«Un ensayo con resultado RECHAZADO no puede extender la vigencia. Registre el rechazo y disponga del lote; el re-análisis queda igualmente asentado.»*

**Acortar con `RECHAZADO` sí se permite**, y de hecho es lo esperable: el laboratorio lo encuentra fuera de especificación y lo deja vencido ya. Prohibirlo obligaría a dejar el lote con una vigencia que nadie cree.

## Las demás reglas, y por qué son pocas

La decisión de si el producto sigue sirviendo es **del laboratorio, no del sistema**. Lo que el sistema impide es que el registro diga algo que no pasó:

- **Sin vencimiento no hay vigencia que revisar.** El mensaje manda a cargar la vida útil si el producto debería vencer.
- **Sin saldo no se re-analiza.** Extender la vigencia de algo que ya salió entero no cambia nada y ensucia el historial con eventos sin efecto.
- **Aprobar con un vencimiento ya pasado** no deja el lote en condiciones de usarse.
- **El mismo vencimiento** no es un re-análisis.

El vencimiento propuesto en el formulario —la vida útil del producto contada desde hoy— es una **sugerencia, no una regla**. Imponerla sería que el sistema decida algo que es del laboratorio.

## Qué se ve

En la ficha del envasado, junto al vencimiento:

> Vence: 30 jun. 2027 · **vigencia revisada 1 vez**

Y el historial completo:

| Fecha | Resultado | Vencía | Pasó a | Efecto | Plan | Quién |
| --- | --- | --- | --- | --- | --- | --- |
| 16 set. 2026 | APROBADO | 31 jul. 2026 | 30 jun. 2027 | **Extendió 333 días** | — | Administrador General |

La columna «Efecto» existe porque una lista de fechas obliga a restar mentalmente en cada fila.

Verificado en el navegador contra la base demo: el lote pasó de `31 jul. 2026 — VENCIDO` en rojo a `30 jun. 2027 · vigencia revisada 1 vez`, con su renglón de historial.

## Lo que NO hace

**No captura los valores medidos del re-ensayo.** El plan de inspección y su versión quedan registrados, pero las mediciones por característica viven en `ResultadoCaracteristicaCalidad`, que hoy cuelga del control de calidad del lote granel y no del envasado. Conectarlas es un trabajo propio; mientras tanto el campo de observaciones recoge lo que el laboratorio quiera dejar asentado.

**No avisa de vencimientos próximos.** El sistema ya tiene avisos de documentos por vencer (`docs/documentos-de-respaldo.md`); un aviso equivalente para lotes sería útil y es otro incremento.

## Dónde mirar

- `src/lib/reanalisis.ts` — las reglas, puras y probadas.
- `src/app/(app)/produccion/envasados/actions.ts` — `registrarReanalisis`.
- `tests/reanalisis.test.ts` — 12 pruebas.
