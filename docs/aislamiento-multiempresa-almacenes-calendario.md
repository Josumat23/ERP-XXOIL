# Aislamiento multiempresa: almacenes, zonas y calendario de producción

Segundo tramo de la mitad de aplicación del ítem 0.2. El módulo resolvía todo con `requerirRol` de `@/lib/auth`, creaba con el `empresaId` por defecto `"1"` y aceptaba cualquier `almacenId`, `id` de zona o `id` de día no laborable que llegara del navegador.

## Qué cambia

- `crearAlmacen` usa `requerirRolEmpresaActiva` y graba `empresaId: auth.usuario.empresaId`.
- Un ayudante privado, `almacenDeEmpresaActiva(almacenId)`, relee el almacén acotado por la compañía activa y devuelve su id o `null`. Lo usan `crearZonaAlmacen`, `guardarHorasCalendario`, `agregarDiaNoLaborable` y `cargarFeriadosPeru` antes de escribir nada.
- `alternarActivoAlmacen` comprueba `perteneceAEmpresaActiva` sobre el registro releído.
- `alternarActivoZona` filtra por `almacen: { empresaId }`; `quitarDiaNoLaborable` por `calendario: { almacen: { empresaId } }`. Ni `ZonaAlmacen`, ni `CalendarioProduccion`, ni `DiaNoLaborable` llevan `empresaId` propio: la compañía se resuelve siempre a través del almacén.
- Todas las entradas de auditoría de maestros se registran con el `empresaId` de la compañía activa en lugar del `"1"` por defecto.
- La página lista solo los almacenes de la compañía activa.

## Verificación

La suite crea dos compañías con un almacén `ALM01` en cada una —el índice único es `(empresaId, codigo)`, así que conviven— y comprueba que las consultas acotadas no devuelven la zona ni el día no laborable de la otra compañía. La guardia de regresión que ya cubría series y unidades ahora incluye también este `actions.ts`.

## Qué sigue

Quedan grupos de seguridad y usuarios, los dos módulos que tocan la seguridad del sistema.
