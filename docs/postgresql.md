# PostgreSQL: la migración, ejecutada

**2026-09-15.** El proyecto dejó SQLite. Este documento dice qué cambió, qué se rompió de verdad al ejecutarlo, y cómo se trabaja ahora.

El inventario previo —qué se esperaba que se rompiera, medido sobre el código— está en [migracion-postgresql-auditoria.md](migracion-postgresql-auditoria.md). Aquel documento se escribió **sin PostgreSQL en la máquina** y lo decía explícitamente. Éste se escribe con la suite corriendo contra el motor nuevo.

## Qué es ahora la base

| | Antes | Ahora |
| --- | --- | --- |
| Motor | SQLite (archivo) | PostgreSQL 17.2 |
| Desarrollo | `local.db` | base `erp_dev` en `localhost:5433` |
| Pruebas | un archivo `.db` en el temporal, uno por corrida | una base `erp_test_<azar>`, creada y destruida por corrida |
| Demo | `.demo/demo.db` | base `erp_demo` |
| Migraciones | 123 archivos versionados | **una línea base**, con las 123 archivadas |

`DATABASE_URL` se usa como **plantilla**: de ella salen la máquina, el puerto y las credenciales. Los scripts reemplazan el nombre de la base por el suyo, así que una variable heredada no puede redirigir la suite ni la demo a la base de trabajo.

```
DATABASE_URL="postgresql://postgres@localhost:5433/erp_dev"
```

## La línea base

Las 123 migraciones de SQLite **no se tradujeron: se reemplazaron**. No era una elección de comodidad —100 usaban `DATETIME`, 54 `PRAGMA`, 48 el patrón `RedefineTables`— y nada de eso existe en PostgreSQL.

- `prisma/migrations/00000000000000_baseline_postgres/` — el esquema completo generado desde `schema.prisma`: 173 tablas, 100 enums, 128 índices únicos, 357 claves foráneas.
- `prisma/migraciones-sqlite-historico/` — las 123 originales, **fuera de la carpeta que Prisma lee**. Se conservan porque varias llevan decisiones anotadas que no están en ningún otro lado: cómo se tradujo un booleano a un enum, por qué un relleno va antes de crear un índice, qué convención heredó cada fila existente.

Ese archivo no es decorativo: seis guardias de la suite lo leen y siguen comprobando que aquellas migraciones preservaran los datos que decían preservar. Lo que se perdió es la capacidad de **ejecutar** ese historial, y conviene decirlo: una instalación de SQLite ya no se puede reconstruir paso a paso desde el repositorio.

## Lo que se rompió de verdad al ejecutarlo

La auditoría acertó en el mecanismo principal (las búsquedas) y no vio dos cosas. Las tres, medidas:

### 1. Las búsquedas — previsto y resuelto

`contains` se traduce a `LIKE`, que en PostgreSQL distingue mayúsculas y en SQLite no. Las 63 búsquedas ya estaban reunidas en `src/lib/busqueda.ts` desde el día anterior, justamente para esto: el arreglo fue **una línea**, agregar `mode: "insensitive"`.

Y ahora hay una prueba que lo mide contra el motor, no contra el código: busca `chachapoyas` en minúsculas sobre el catálogo UBIGEO, que SUNAT publica en MAYÚSCULAS, y exige que lo encuentre. Con `LIKE` a secas devuelve cero filas.

### 2. El cerrojo de correlativos — no previsto

El único SQL crudo del sistema que nombra columnas:

```sql
INSERT INTO cerrojo_correlativo (id, actualizadoEn) ...
```

PostgreSQL pliega a minúsculas **todo identificador sin comillas**. Prisma crea la columna como `"actualizadoEn"`, así que la consulta buscaba `actualizadoen` y fallaba con «column does not exist». SQLite no distinguía: la línea funcionó dos meses sin síntoma y se rompió en 22 pruebas a la vez, porque el cerrojo lo toman los quince generadores de correlativos.

La auditoría había clasificado este SQL como «portable» por el `ON CONFLICT`, que sí lo era. El `ON CONFLICT` no era el problema; los nombres sin comillas, sí.

Arreglado entrecomillando, y con una guardia que falla si vuelven a escribirse sin comillas.

### 3. El respaldo se quedó sin ningún controlador — no previsto

Esto era previsible y aun así no estaba en el inventario. El controlador de SQLite abría el archivo con un `PrismaClient` y el adaptador de better-sqlite3 — y **Prisma rechaza un adaptador de un motor distinto al del esquema**. Con `provider = "postgresql"`, el controlador de SQLite dejó de poder construirse: el sistema se quedó sin ninguna forma de respaldar ni de restaurar, incluidos los respaldos `.db` que ya existen.

Se arregló quitando Prisma de ahí: el controlador abre el archivo con better-sqlite3 directamente. Nunca hizo falta el intermediario —no hay modelos ni consultas generadas, solo `VACUUM INTO` y `PRAGMA integrity_check` contra un archivo que ni siquiera tiene el esquema de la aplicación—, y esa dependencia de más es exactamente lo que se rompió.

**Consecuencia que queda abierta:** los respaldos `.db` existentes se siguen verificando y restaurando, pero **PostgreSQL todavía no tiene controlador**, así que hoy la base de trabajo no se puede respaldar. `controladorPara` se niega con un mensaje que nombra lo que falta —`pg_dump -Fc`, `pg_restore --list`, `pg_restore`— y esa negativa sigue siendo deliberada: un respaldo que nunca corrió contra una base real no es un respaldo. Es el trabajo siguiente, y hasta que esté, **las copias de seguridad hay que hacerlas a mano**.

## Cómo se trabaja ahora

### Arrancar el motor

```bash
"D:/Escritorio/ERP-postgres/pgsql/bin/pg_ctl" -D "D:/Escritorio/ERP-postgres/datos" -l "D:/Escritorio/ERP-postgres/postgres.log" start
```

Es una instalación portable, sin servicio y sin privilegios de administrador; desinstalar es borrar la carpeta. Autenticación `trust` y `listen_addresses = 'localhost'`: **cualquier proceso de esta máquina puede conectarse como superusuario**, lo cual es aceptable para una base de desarrollo local y no lo es para ninguna otra cosa. Para algo que no sea esto, `scram-sha-256`.

### La suite

```bash
npm test
```

Cada corrida crea `erp_test_<azar>`, le aplica las migraciones con `prisma migrate deploy`, siembra los maestros mínimos, corre las pruebas y **destruye la base pase lo que pase**, incluso si fallaron.

Aplicar con Prisma —y no ejecutando los SQL a mano, como antes— tiene una ventaja que antes no se podía tener: la suite ejerce el mismo procedimiento que un entorno real, así que una migración que no aplica falla acá y no el día del despliegue.

### La demo

```bash
npm run dev:demo            # reutiliza erp_demo
npm run dev:demo -- --reset # la recrea desde cero
```

Reutilizar una base creada antes de una migración nueva levantaba el servidor contra un esquema incompleto. Antes eso exigía un registro propio —una tabla `_demo_migraciones` mantenida a mano— porque el script aplicaba los SQL sueltos; ahora aplica Prisma, que lleva el suyo y sabe cuáles faltan. Ese mecanismo se retiró.

Si quedó un `.demo/demo.db` de antes, ya no lo usa nadie y se puede borrar; el script no lo toca.

## La protección de las bases, rehecha

Ésta es la parte que la auditoría sí anticipó: *«la guardia que impide que una prueba escriba en una base del repositorio está construida sobre "la ruta del archivo cae dentro del proyecto"; con una URL de conexión eso deja de tener sentido»*.

El historial que la motiva: el 2026-09-12 una prueba suelta dejó tres filas dentro de `dev.db`, y el 2026-09-14 el servidor de desarrollo dejó cinco más. Las dos veces el archivo era una base protegida y el SHA256 cambió.

La regla vieja, sola, habría quedado **siempre en falso**: presente, verde, y sin proteger nada — porque una URL de conexión no tiene ruta que mirar.

La regla nueva es al revés y más estricta. Bajo el runner, la base **tiene que llamarse** `erp_test_…`, que es lo único que `scripts/run-tests.mjs` crea y destruye. Cualquier otra cosa —`erp_dev`, la base de alguien más, una de producción por un `.env` mal puesto— se rechaza **antes de construir el adaptador**, sin abrir la conexión ni un instante.

Y el nombre es también lo único que autoriza a destruir: `eliminarBase` exige el prefijo, e `identificador()` rechaza cualquier nombre que no sea `[a-z0-9_]` en vez de entrecomillarlo. Aceptar lo que sea para después escaparlo es la forma habitual de que un `DROP DATABASE` termine en el lugar equivocado.

La regla vieja **no se retiró**: el módulo de respaldo sigue abriendo archivos `.db` sueltos. Las dos se comprueban en `tests/base-protegida.test.ts`.

## Lo que sobrevivió intacto

Confirmado corriendo, no supuesto:

- **El truco del índice único con NULL.** «Una dirección principal por tipo», «un contacto principal», «una cuenta bancaria principal», `documentoNormalizado`: todos dependen de que los NULL no choquen entre sí en un índice único. Cierto en los dos motores.
- **Las relaciones físicas hacia `Empresa`** y sus `onDelete: Restrict`.
- **El `ON CONFLICT` del cerrojo**, que sí era portable.
- **Las funciones puras y sus pruebas.**

## Los datos de `local.db` siguen en `local.db`

`erp_dev` arranca **vacía**. El archivo `local.db` —la base de desarrollo hasta hoy— sigue donde estaba, intacto, con 2.752 filas: 1.834 son el catálogo UBIGEO, que se vuelve a sembrar solo, y las ~900 restantes son trabajo real (95 asientos contables con 210 detalles, 19 facturas, 22 pedidos, 56 movimientos de kardex, 49 depreciaciones).

**No se migraron a propósito**, por dos razones. Copiar filas entre motores no es un `INSERT ... SELECT`: hay 100 enums, fechas que en SQLite son texto y acá son `TIMESTAMP`, booleanos que allá son `0`/`1`, y 357 claves foráneas que obligan a un orden de carga. Y hacerlo mal no falla ruidosamente — deja datos torcidos que aparecen semanas después. Es un trabajo propio, no un apéndice de éste.

Mientras tanto: `npm run dev:demo` levanta la aplicación contra datos sembrados, y `local.db` no se toca. Hay un respaldo verificado en `D:\Escritorio\ERP-respaldos`.

## Lo que queda pendiente

1. **El controlador de respaldo con `pg_dump`/`pg_restore`.** Es lo siguiente, y mientras tanto la base de trabajo no tiene copias automáticas.
2. **Traer los datos de `local.db`**, si se quieren conservar (ver arriba).
3. **Quitar el `@default("1")` de `empresaId`.** Hoy convierte el olvido de declarar compañía en una escritura silenciosa a la compañía 1. En SQLite exigía reconstruir 88 tablas; en PostgreSQL es un `ALTER TABLE ... DROP DEFAULT` por tabla. El costo desapareció, así que ya no hay razón para no hacerlo.
4. **Las credenciales.** `trust` sirve para esta máquina y para nada más.
