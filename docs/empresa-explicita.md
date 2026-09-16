# La compañía deja de ponerse sola

`docs/aislamiento-multiempresa-escrituras.md` terminaba con una deuda escrita:

> Queda anotado como parte del trabajo de la **migración a PostgreSQL**, donde `ALTER TABLE ... DROP DEFAULT` es una línea por tabla y no una reconstrucción.

Esto la paga. Los 94 modelos con `empresaId String @default("1")` pasan a declararlo sin valor por omisión.

## Qué hacía el default

Rellenaba el campo cuando la escritura se olvidaba de decirlo. Nada fallaba, nada avisaba: la fila se archivaba en la compañía `"1"`. Con una sola sociedad —cuyo id **es** `"1"`— acertaba por casualidad; con la segunda se convierte en una fuga entre empresas, y de las que no se descubren revisando código sino cuando alguien ve datos ajenos en su propio panel.

Existió por una razón buena: las migraciones que agregaron la columna tenían que rellenar las filas ya existentes. Cumplida esa función, solo quedaba el riesgo.

## Qué reemplaza a la guardia

Hasta ahora el control era `tests/empresa-en-escrituras.test.ts`, que leía `src/` con expresiones regulares buscando `create`/`createMany`/`upsert` sin `empresaId`. Era el control proporcionado mientras el proyecto corría sobre SQLite, donde quitar un default obliga a reconstruir la tabla entera.

En PostgreSQL es una línea. La migración `20260916221229_empresa_explicita` son 94 `ALTER COLUMN "empresaId" DROP DEFAULT` y nada más: no cambia ni un dato, solo deja de rellenar por nosotros.

A partir de ahí Prisma genera el campo como obligatorio —`empresaId: string`, no `empresaId?: string`— y el olvido pasa a ser un **error de compilación**. Eso es estrictamente mejor que el regex por dos motivos: no se le escapa una escritura por una forma sintáctica que el patrón no previó, y falla antes de correr en vez de en la suite.

## Lo que midió el cambio

Al quitar los defaults, TypeScript reportó **103 errores**, repartidos así:

| Dónde | Errores |
| --- | --- |
| `src/` | **0** |
| `prisma/seed.ts` | 28 |
| `prisma/seed-demo.ts` | 21 |
| `tests/critical-flows.test.ts` | 46 |
| `tests/tanques-persistencia.test.ts` | 8 |

Cero en la aplicación. Ese número es el resultado de la guardia vieja: llevaba desde el 2026-09-12 obligando a que cada escritura de `src/` nombrara su compañía. El regex hizo su trabajo y ahora lo entrega.

Los 103 estaban en semillas y pruebas, que **sí** quedaban exentas —la guardia las excluía por directorio, a propósito, porque ahí poblar la compañía `"1"` es correcto—. Ahora también la declaran, con una constante `EMPRESA` documentada en cada archivo en vez de depender de que la base rellene el campo.

## Lo que esto no cubre

El compilador protege las escrituras tipadas. No ve:

- **SQL crudo.** En `src/` hay dos usos vivos: un `INSERT` sobre `cerrojo_correlativo`, que no tiene `empresaId`, y un `SELECT 1` de monitoreo. Ninguno depende del default.
- **Datos tipados como `any`.** No los hay hoy en escrituras, pero nada lo impide estructuralmente.

## Las guardias que quedan

`tests/empresa-en-escrituras.test.ts` conserva las dos pruebas de comportamiento (la orden preventiva se archiva en la compañía del equipo; la numeración por compañía solo se sostiene si la fila declara la suya) y cambia las dos de escaneo por las dos que el compilador no puede hacer por sí mismo:

1. **Ningún modelo le pone compañía por defecto.** Devolver el `@default("1")` a uno solo basta para que sus escrituras vuelvan a ser silenciosas. La prueba falla nombrando los modelos, y falla también si encuentra menos de 50 modelos con `empresaId` — una guardia que pasa porque dejó de mirar es peor que ninguna.
2. **El cliente generado exige la compañía.** Mira que el tipo diga `empresaId: string`. Un esquema corregido con un cliente sin regenerar compila igual de mal que antes.

Se verificó reintroduciendo el defecto en los dos frentes a la vez: con `@default("1")` devuelto a un modelo y `empresaId?: string` en el cliente, las dos fallan (`Estos modelos volverían a aceptar escrituras sin compañía` y `empresaId volvió a ser opcional`) y las dos de comportamiento siguen pasando.

## Reversibilidad

`ALTER COLUMN "empresaId" SET DEFAULT '1'` por tabla. La migración no toca datos, así que revertirla no pierde nada — solo devuelve el silencio.
