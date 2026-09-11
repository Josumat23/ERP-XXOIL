# Certificado de análisis de calidad (Oleada 1, QM)

Este ítem del roadmap ya estaba construido. La revisión de 2026-09-11 lo verificó contra el código en lugar de reimplementarlo, y corrigió dos cosas que aparecieron al leerlo.

## Lo que ya existía

- `CaracteristicaPlanCalidad` define, por versión de plan, cada parámetro a medir: nombre, unidad, límites inferior y superior, método de ensayo y si es obligatoria.
- `ResultadoCaracteristicaCalidad` congela por control el valor medido y su conformidad, junto con una copia de los límites y el método vigentes al liberar. El plan puede versionarse después sin alterar certificados ya emitidos.
- `registrarControlCalidad` calcula la conformidad con `valorCumpleEspecificacion` y deriva el resultado del lote: `APROBADO` solo si **todas** las características medidas son conformes.
- `/produccion/calidad/certificados/[loteId]` emite el certificado imprimible con membrete, datos del lote, tabla de especificación contra resultado, observaciones y firma del responsable de liberación.

## Lo que se corrigió

### Aislamiento multiempresa en pantallas de calidad

Cuatro pantallas resolvían la compañía con `obtenerUsuario()` y filtraban por `usuario.empresaId`, que es la compañía **de origen** del usuario, no la activa:

- `produccion/calidad/certificados/[loteId]`
- `produccion/calidad/planes`
- `produccion/calidad/no-conformidades`
- `produccion/calidad/no-conformidades/[id]`

Un ADMIN que cambiaba de compañía seguía viendo la suya, mientras que las Server Actions de esos mismos módulos sí operaban sobre la activa: pantalla y escritura quedaban en compañías distintas. Las cuatro pasan a `obtenerUsuarioEmpresaActiva()`.

El barrido que lo encontró recorrió los 162 `page.tsx` y `route.ts` del proyecto; esas cuatro eran las únicas. Ahora es una prueba de la suite, así que una pantalla nueva no puede repetirlo.

### El certificado lee la conformidad, no la deduce

La columna "Conformidad" imprimía el literal `Conforme` en todas las filas. Hoy eso siempre coincide con la realidad —el certificado solo se emite para controles `APROBADO`, y un control es `APROBADO` solo si todas las características medidas son conformes—, así que no era un dato falso en producción. Pero el documento afirmaba algo sin leer la columna que lo respalda: si mañana cambia la regla de aprobación (por ejemplo, aprobar con una característica no obligatoria fuera de especificación), el certificado mentiría sin que nadie tocara el certificado. Ahora imprime `r.conforme`.

## Verificación

Dos pruebas nuevas en la suite: una recorre todas las pantallas y falla si alguna filtra por `usuario.empresaId` sin resolver la compañía activa; otra falla si el certificado vuelve a afirmar la conformidad en lugar de leerla.
