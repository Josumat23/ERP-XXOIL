# Migrar a PostgreSQL: qué se rompe de verdad

> **Actualización 2026-09-15:** ya hay PostgreSQL. Se instalaron los binarios oficiales 17.2 en modo portable —sin servicio, sin privilegios de administrador y sin tocar el sistema— y el clúster corre en `localhost:5433`. El bloqueo que motivó este documento **ya no existe**, y la afirmación central se midió contra el motor real: ver la corrección más abajo.

**Cuando se escribió esto no se migró nada**, porque en la máquina no había PostgreSQL en ninguna forma —ni `psql`, ni `pg_dump`, ni `initdb`, ni Docker, ni un servicio de Windows, ni nada escuchando en el 5432— así que una migración escrita entonces no podría haberse ejecutado ni una vez.

Un cambio de motor que nunca corrió contra el motor nuevo no es una migración: es una conjetura con formato de código. Así que este documento es la otra cosa útil que sí se puede hacer sin base: **el inventario de lo que realmente se rompe**, medido sobre el código que existe hoy.

## Lo más grave es lo que NO falla

**48 búsquedas en 32 pantallas usan `contains:` y ninguna declara `mode: "insensitive"`.**

En SQLite, `LIKE` es insensible a mayúsculas para ASCII por omisión. En PostgreSQL es **sensible**, y Prisma traduce `contains` a `LIKE` salvo que se le pida `ILIKE` explícitamente.

**Corrección del 2026-09-15, con PostgreSQL 17.2 ya instalado y midiendo en los dos motores.** La primera versión de este documento decía que buscar `ferreteria` dejaría de encontrar «Ferretería San Martín». Eso estaba **mal**: SQLite tampoco la encuentra, porque la tilde no se pliega en ninguno de los dos. El mecanismo sí era correcto; el ejemplo, no.

Medido:

| Patrón | SQLite (hoy) | PostgreSQL `LIKE` | PostgreSQL `ILIKE` |
| --- | --- | --- | --- |
| `%ferreteria%` vs `FERRETERIA SAN MARTIN` | **sí** | no | **sí** |
| `%ferreteria%` vs `Ferretería San Martín` | no | no | no |
| `%ferretería%` vs `Ferretería San Martín` | **sí** | no | **sí** |

De donde sale la conclusión precisa, que es más útil que la anterior: **`mode: "insensitive"` reproduce exactamente el comportamiento actual de SQLite**, ni más ni menos. Las tildes se comportan igual en los dos motores — ninguno las pliega — así que ese no es un riesgo de la migración; lo es la diferencia de mayúsculas en ASCII.

Sin ese cambio, buscar `ferreteria` deja de encontrar «FERRETERIA SAN MARTIN», que hoy sí encuentra. En todo el sistema. Sin un error, sin una excepción, sin una línea en el log — los listados simplemente devuelven menos filas.

Es el peor tipo de regresión posible: la migración se declararía exitosa y el problema aparecería semanas después, reportado como «el buscador no anda bien».

Las 48 necesitan `mode: "insensitive"`, y hace falta una guardia que falle si aparece un `contains` sin él.

### Resuelto el 2026-09-15: los 63 usos están reunidos

`mode: "insensitive"` **no se puede agregar todavía**: no existe en los tipos que Prisma genera para SQLite y no compila. Se comprobó antes de intentarlo.

Lo que sí se hizo fue reunir los 63 usos —eran 63, no 48; la primera cuenta contaba líneas y varias llevan más de uno— en `src/lib/busqueda.ts`, detrás de un `contiene(q)`. El día de la migración es **una línea en un archivo** en vez de 63 ediciones repartidas en 32 pantallas, donde basta olvidar una para dejar ese buscador roto en silencio.

Una guardia falla si alguna pantalla vuelve a escribir `contains` por su cuenta, y otra comprueba que el ayudante siga teniendo los 63 usos detrás: una guardia que prohíbe algo que nadie usaría no protege nada.

Verificado en pantalla que las búsquedas siguen encontrando lo mismo: `ferreter` y `FERRETER` devuelven los mismos 2 clientes, `andina` y `ANDINA` el mismo 1.

## Las migraciones no son portables

De las **123** migraciones versionadas:

| Construcción | Archivos |
| --- | --- |
| `DATETIME` | 100 |
| `PRAGMA` | 54 |
| Patrón `RedefineTables` | 48 |

Nada de eso existe en PostgreSQL. `DATETIME` es `TIMESTAMP`; los `PRAGMA defer_foreign_keys` no tienen equivalente porque PostgreSQL no necesita reconstruir la tabla para cambiar una columna; y el patrón entero de «crear tabla nueva, copiar, borrar, renombrar» —que SQLite obliga a usar— se reemplaza por un `ALTER TABLE` de una línea.

**No se traducen: se reemplazan por una línea base.** El historial de 123 migraciones queda como registro histórico y PostgreSQL arranca con un esquema inicial generado desde `schema.prisma`. Perder ese historial tiene un costo real —ninguna de las decisiones anotadas en esos SQL sobrevive como SQL ejecutable— y conviene decidirlo a propósito, no descubrirlo a mitad.

## El respaldo no tiene controlador

Está previsto y documentado: `controladorPara` reconoce PostgreSQL y **se niega** con un mensaje que nombra lo que falta —`pg_dump -Fc` para copiar, `pg_restore --list` para verificar, `pg_restore` para restaurar—. El núcleo (nombre, retención, manifiesto SHA256, escribir en temporal y renombrar al verificar) no cambia.

Esa negativa fue deliberada: un respaldo que nunca se ejecutó contra una base real no es un respaldo. Sigue siéndolo hoy.

## El SQL crudo

Cinco lugares. Tres son de SQLite puro y viven en el módulo de respaldo: `PRAGMA integrity_check` y dos `VACUUM INTO`. Se van con el controlador nuevo.

Los otros dos son portables y conviene saberlo:

- `SELECT 1` del monitoreo.
- El cerrojo de correlativos usa `INSERT ... ON CONFLICT(id) DO UPDATE`, que es **sintaxis válida en PostgreSQL**. Ese mecanismo sobrevive tal cual.

## Las herramientas de desarrollo asumen un archivo

`scripts/run-tests.mjs` y `scripts/dev-demo.mjs` abren la base con `better-sqlite3` y le aplican los `migration.sql` uno por uno. Tres archivos de pruebas hacen lo mismo para inspeccionar la base directamente.

Con PostgreSQL no hay archivo que abrir ni migraciones que ejecutar así. La suite necesitaría una base efímera de verdad —un esquema por corrida, o una base por corrida— y eso cambia cómo se aísla cada prueba. **Es la parte más grande del trabajo**, más que el esquema.

Y hay una consecuencia que conviene ver ahora: la guardia que impide que una prueba escriba en una base del repositorio está construida sobre «la ruta del archivo cae dentro del proyecto». Con una URL de conexión eso deja de tener sentido y la protección hay que rehacerla con otro criterio.

## Lo que sí sobrevive intacto

- **El truco del índice único con NULL.** «Una dirección principal por tipo», «un solo contacto principal», «una cuenta bancaria principal» dependen de que los NULL no choquen entre sí en un índice único. Es cierto en SQLite y en PostgreSQL.
- **Las 76 relaciones físicas hacia `Empresa`** y sus `onDelete: Restrict`.
- **El cerrojo de correlativos**, por el `ON CONFLICT` portable.
- **Todas las funciones puras y sus pruebas** — no tocan la base.

## Y algo que mejora

Quitar el `@default("1")` de `empresaId` en los 88 modelos, que hoy convierte el olvido de declarar compañía en una escritura silenciosa a la compañía 1. En SQLite exige reconstruir las 88 tablas; en PostgreSQL es un `ALTER TABLE ... ALTER COLUMN ... DROP DEFAULT` por tabla.

Conviene hacerlo **en la misma migración**, porque es el momento en que ese costo desaparece.

## El entorno, ya resuelto

PostgreSQL 17.2 portable en `D:EscritorioERP-postgres`, fuera del repositorio:

- **Sin instalador y sin servicio**: son los binarios oficiales extraídos de un ZIP. Desinstalar es borrar la carpeta.
- **Sin privilegios de administrador**, así que no hizo falta ningún UAC.
- **Puerto 5433**, para no chocar con nada que use el 5432.
- **`listen_addresses = 'localhost'`** y autenticación `trust`: es una instancia desechable de desarrollo y así no hay una credencial más que guardar. **El compromiso conviene decirlo**: cualquier proceso de esta máquina puede conectarse como superusuario. Para algo que no sea una base de desarrollo local, eso hay que cambiarlo por `scram-sha-256`.

Arrancar y parar:

```bash
"D:/Escritorio/ERP-postgres/pgsql/bin/pg_ctl" -D "D:/Escritorio/ERP-postgres/datos" -l "D:/Escritorio/ERP-postgres/postgres.log" start
"D:/Escritorio/ERP-postgres/pgsql/bin/pg_ctl" -D "D:/Escritorio/ERP-postgres/datos" stop
```

Con esto se puede hacer la migración de verdad —línea base, los 48 `contains`, el runner nuevo y el controlador de respaldo con `pg_dump`— y, lo que importa, **probarla contra un PostgreSQL real** antes de proponer nada.
