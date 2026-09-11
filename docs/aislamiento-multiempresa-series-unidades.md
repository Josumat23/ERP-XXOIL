# Aislamiento multiempresa: series de documento y unidades de medida

Los dos primeros módulos de Configuración que cierran la mitad de aplicación del ítem 0.2. Antes resolvían todo con `requerirRol` de `@/lib/auth`, creaban con el `empresaId` por defecto `"1"` y actualizaban por el `id` recibido del navegador.

## Series de documento

- `crearSerieDocumento` usa `requerirRolEmpresaActiva` y graba `empresaId: auth.usuario.empresaId`, de modo que la serie nace en la compañía activa y no siempre en la `"1"`.
- `alternarActivoSerie(id, activo)` relee la serie y comprueba `perteneceAEmpresaActiva` antes de escribir: un `id` de otra compañía no produce ningún cambio.
- La página lista solo las series de la compañía activa.

El índice único es `(empresaId, tipoDocumento, serie)`, así que dos compañías pueden tener la misma serie `F001` sin colisionar.

## Unidades de medida

- `crearClaseUnidadMedida` graba la clase en la compañía activa y registra la auditoría con ese mismo `empresaId`.
- `UnidadMedida` no lleva `empresaId` propio: cuelga de `ClaseUnidadMedida`. Por eso `crearUnidadMedida` resuelve la clase con `findFirst({ where: { id: claseId, empresaId } })` y rechaza el alta si la clase no es de la compañía activa, y `alternarActivoUnidad` filtra por `clase: { empresaId }`.
- La página lista solo las clases de la compañía activa.

## Verificación

La suite crea dos compañías, comprueba que la misma serie `F001` puede convivir en ambas, que `perteneceAEmpresaActiva` rechaza la serie ajena, y que las consultas acotadas por `clase: { empresaId }` no devuelven la unidad de la otra compañía. Una segunda prueba lee ambos `actions.ts` y falla si vuelven a importar `@/lib/auth` en lugar del helper de compañía activa.

## Qué sigue

Quedan tres módulos de Configuración por acotar: almacenes, grupos de seguridad y usuarios.
