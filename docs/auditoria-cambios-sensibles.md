# Auditoría de cambios sensibles

El modelo ya existía: `AuditoriaMaestro` guarda entidad, registro, acción, valores antes y después, usuario y fecha, y `/configuracion/auditoria` lo consulta. Lo que faltaba era cobertura. La revisión de 2026-09-11 recorrió los 68 `actions.ts` y encontró siete maestros sensibles que se sobrescribían en sitio sin dejar rastro.

## Qué se cerró y por qué cada uno importa

| Módulo | Qué se sobrescribía sin rastro |
| --- | --- |
| `configuracion/empresa` | Tasa de IGV, umbrales de aprobación de compras y pagos, tasas de crédito y mora, proveedor OSE. |
| `configuracion/aprobaciones-compras` | Los umbrales que deciden **quién puede aprobar cuánto**: es control interno, no un parámetro cosmético. |
| `configuracion/calendario-fiscal` | Abrir y cerrar períodos contables. Reabrir borraba `cerradoEn`/`cerradoPor`, así que se perdía quién lo había cerrado. |
| `comercial/descuentos-canal` | Un porcentaje que altera el precio de toda venta del canal. |
| `configuracion/series` | Numeración legal: correlativo inicial y activación de series. |
| `finanzas/plan-cuentas` | `asignarControlContable` decide qué cuenta usa cada asiento automático — la pieza que más cambia el resultado contable sin tocar una sola transacción. |
| `finanzas/centros-costo` | Jerarquía, activación, presupuesto mensual y reglas de asignación. |

## Qué NO se tocó, y por qué

- **Los módulos transaccionales** (pedidos, facturas, cobros, kardex, asientos, lotes…) no entran. Su historia es inmutable por diseño: no se editan, se compensan con documentos nuevos, y cada registro ya guarda `usuarioId`/`usuarioNombre`. Un change log genérico encima sería ruido duplicado.
- **Sueldos de empleados.** `CambioSalarial` ya versiona sueldo anterior, sueldo nuevo, vigencia, motivo y usuario. Es mejor que un change log genérico, no peor: duplicarlo sería empeorarlo.
- **Parámetros de planilla y políticas de tiempo de trabajo.** Están versionados por diseño (`vigenteDesde`, estado `BORRADOR`/`APROBADO`, `aprobadoEn`/`aprobadoPorId`): crear una versión nueva *es* la historia, no se mutan en sitio.

## Secretos

`guardarConfiguracionEmpresa` audita el objeto completo, que incluye la clave SOL y la contraseña del certificado digital. `serializarCambiosMaestro` ya enmascaraba `passwordHash`, `sunatClaveSol`, `sunatCertificadoPassword` y `token` — el diseño anticipaba exactamente este caso. Hay una prueba que lo fija: los cuatro salen como `[PROTEGIDO]` y los campos no secretos (tasa de IGV, usuario SOL) siguen legibles, porque una auditoría que enmascara de más tampoco permite reconstruir el cambio.

## Verificación

`los maestros sensibles registran quién cambió qué` lleva la lista de los 24 módulos que deben auditar y falla si alguno deja de hacerlo. La lista es explícita a propósito: obliga a decidir conscientemente si un módulo nuevo entra o no, en lugar de inferirlo con una heurística que se equivoque en silencio.
