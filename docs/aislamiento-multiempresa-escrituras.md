# Aislamiento multiempresa: la mitad de escritura

El ítem 0.2 se cerró en dos mitades: la **FK** (`empresaId` como relación física en los 76 modelos que lo llevaban) y el **filtro de aplicación** (los 68 `actions.ts` resuelven la compañía activa antes de leer o escribir).

La auditoría del 2026-09-12 encontró una tercera cosa que ninguna de las dos cubría: **escribir sin decir en qué compañía**.

## El default que volvió silencioso el olvido

Los 88 modelos con `empresaId` lo declaran así:

```prisma
empresaId String @default("1")
```

El default existe por una razón buena. Las migraciones que agregaron la columna tenían que rellenar las filas ya existentes, todas de la compañía original `"1"`; sin un default no había forma de agregar una columna obligatoria a una tabla con datos.

Cumplida esa función, quedó convertido en una trampa. Una escritura que **omite** el campo no falla, no avisa y no deja rastro: archiva la fila en la compañía `"1"`. El código compila, la prueba pasa, la pantalla muestra lo que se espera — porque hoy la única compañía es la `"1"`.

## Lo que estaba mal

Nueve escrituras de la aplicación no declaraban compañía:

| Dónde | Modelo | Qué habría pasado con una segunda sociedad |
| --- | --- | --- |
| `comercial/facturas/actions.ts` — `crearNotaCredito` | `NotaCredito` | La nota de crédito se lee filtrando por `empresaId` propio (resultados, panel general). Habría aparecido en el P&L de la compañía `"1"` y faltado en el suyo. Además `@@unique([empresaId, numero])`: el correlativo de la segunda compañía empieza en 1, así que su **primera** nota de crédito habría chocado con la de la primera y la transacción entera —incluido el asiento— habría fallado. |
| `comercial/facturas/actions.ts` — dos reversiones | `Comision` | Se lee por `empresaId` propio en comisiones, resultados y panel. Reversiones de comisión sumando al resultado de otra compañía. |
| `comercial/pedidos/actions.ts` — `facturarPedido` | `Comision` | Lo mismo con la comisión generada al facturar. |
| `produccion/envasados/actions.ts` | `Envasado` | El panel general lee envasados por `empresaId` propio; la pantalla de producción los lee por la relación con el lote. La producción de la segunda compañía habría desaparecido de su propio panel. Y `@@unique([empresaId, codigo])` habría chocado igual. |
| `produccion/mantenimiento/actions.ts` | `OrdenMantenimiento` | `@@unique([empresaId, codigo])`: el código salía del correlativo correcto y la fila se guardaba en la `"1"`. Choque de numeración. |
| `lib/mantenimientoPreventivo.ts` (tarea programada) | `OrdenMantenimiento` | Igual, y sin nadie mirando: la tarea habría registrado el fallo en su bitácora y seguido. |
| `produccion/equipos/actions.ts` | `PlanMantenimiento` | Planes preventivos de una compañía archivados en otra. |
| `adjuntos/actions.ts` | `Adjunto` | Hoy los adjuntos se leen por entidad, sin filtro de compañía, así que no se pierden; pero el campo estaba para algo y quedaba mintiendo. |

Ninguna de estas es visible hoy: con una sola compañía, cuyo id **es** `"1"`, el default acierta por casualidad. Se vuelven reales el día que exista la segunda — que el negocio ya confirmó que llegará.

## La guardia

`tests/empresa-en-escrituras.test.ts` lee `prisma/schema.prisma`, arma la lista de modelos cuyo `empresaId` tiene default, recorre todo `src/` y falla si algún `create`, `createMany` o `upsert` sobre uno de esos modelos no menciona `empresaId` en su objeto de datos.

Dos detalles deliberados:

- **Las semillas quedan fuera por directorio, no por lista de excepciones.** `prisma/seed.ts` y `seed-demo.ts` pueblan la compañía `"1"` a propósito: ahí el default es la respuesta correcta. Excluirlas por ruta significa que una escritura nueva en `src/` no tiene forma de quedar exenta; una lista de excepciones se habría llenado sola.
- **La guardia comprueba que sigue mirando algo**: falla si encuentra menos de 50 modelos con `empresaId` por defecto o menos de 100 archivos en `src/`. Una guardia que pasa porque dejó de mirar es peor que ninguna.

Se verificó que detecta la reintroducción del defecto: quitando `empresaId` de la tarea preventiva, la guardia falla nombrando archivo, línea y modelo.

Además hay dos pruebas de comportamiento sobre el caso más completo:

1. La tarea preventiva genera la orden **en la compañía del equipo**, no en la `"1"`, y sigue siendo idempotente (con una orden abierta no genera otra).
2. Dos compañías pueden tener cada una su `OM-00001`, y repetir el código dentro de una se rechaza en base. Es la mitad del índice único que hacía que omitir el campo fuera un fallo duro y no solo un desvío.

## Por qué no se quitó el default

Sería lo correcto en un motor que permita alterar una columna: sin default, omitir el campo no compilaría, y no haría falta ninguna guardia.

En SQLite quitar un default obliga a reconstruir la tabla (el patrón `RedefineTables` de Prisma: crear la nueva, copiar, borrar, renombrar). Ochenta y ocho tablas, entre ellas las de kardex, facturas y planilla. Es una migración enorme, difícil de revertir y con riesgo propio, para un defecto que la guardia ya deja imposible de reintroducir sin que la suite lo diga.

Queda anotado como parte del trabajo de la **migración a PostgreSQL**, donde `ALTER TABLE ... DROP DEFAULT` es una línea por tabla y no una reconstrucción.
