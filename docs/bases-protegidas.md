# Las bases del repositorio no se tocan desde las pruebas

`dev.db` y sus dos respaldos (`dev.db.bak-2026-07-29`, `dev.db.bak-2026-08-01`) son bases protegidas: no se abren, ni se migran, ni se copian, ni se reemplazan. Su SHA256 se verifica después de cada ciclo.

## Por qué no alcanzaba con el runner

`scripts/run-tests.mjs` crea una base SQLite efímera en el temporal del sistema, le aplica las migraciones versionadas y la siembra. Define `DATABASE_URL` él mismo, así que mientras la suite se ejecute con `npm test` no hay forma de tocar nada del repositorio.

El agujero estaba en ejecutar un archivo suelto:

```bash
npx tsx --test tests/lo-que-sea.test.ts   # NO
```

Ese proceso no pasa por el runner: hereda la `DATABASE_URL` del `.env`, que es `file:./dev.db`. Cualquier prueba que importe `@/lib/prisma` escribe ahí.

Ocurrió el 2026-09-12. Tres filas `Empresa` quedaron dentro de `dev.db` y el hash del archivo cambió. La limpieza que la propia prueba hacía en su `finally` no llegó a ejecutarse, porque abortó antes contra un esquema desactualizado.

**Y aunque hubiera limpiado, no habría bastado.** SQLite reutiliza páginas: insertar y borrar deja el archivo con otros bytes, y el SHA256 ya no vuelve al original. Por eso la protección tiene que ser sobre la **conexión**, no sobre la escritura.

## La guardia

`src/lib/prisma.ts` se niega a construir el cliente si se dan las dos condiciones a la vez:

1. el proceso corre bajo el runner de pruebas de Node (`NODE_TEST_CONTEXT` definida), y
2. la `DATABASE_URL` es un `file:` que resuelve **dentro del directorio del repositorio**.

La comprobación ocurre **antes** de construir el adaptador, así que el archivo no se abre ni un instante — verificado: el archivo ni siquiera llega a crearse.

El mensaje dice qué hacer:

> Una prueba intentó conectarse a `file:…`, que está dentro del repositorio. Las bases del repositorio están protegidas y conectarse ya cambia el archivo. Ejecute la suite con `node scripts/run-tests.mjs` (o `npm test`), que crea una base efímera en el temporal del sistema y le aplica las migraciones.

La regla es "dentro del repositorio", no "se llama dev.db", para que una base nueva en el árbol de trabajo quede cubierta desde el día uno sin que nadie tenga que acordarse de agregarla a una lista.

### La herencia de `NODE_TEST_CONTEXT` es deliberada

Un proceso hijo lanzado desde una prueba hereda la variable, así que también queda cubierto: algo que una prueba dispara sigue siendo una prueba. El servidor y los scripts de operación no la llevan y trabajan contra la base del repositorio con normalidad, que es su trabajo.

## Qué NO cubre

- **Escribir en la base fuera de una prueba.** El servidor, `npm run respaldo`, `prisma migrate`, o un `node -e` a mano no pasan por esta guardia. Aquí la protección sigue siendo el criterio de quien opera.
- **Los otros dos archivos de respaldo.** No los abre nadie; quedan cubiertos por la misma regla solo porque están dentro del repositorio.
- Para revisar la aplicación en el navegador contra datos, está `npm run dev:demo`, que usa una base desechable en `.demo/` e **ignora** cualquier `DATABASE_URL` del entorno.

## Pruebas

`tests/base-protegida.test.ts` ejecuta procesos de verdad, no inspecciona código:

1. Una prueba suelta apuntando a una ruta dentro del repositorio falla con el mensaje, y **el archivo no se crea**. Se usa un nombre inexistente y descartable, nunca una base protegida: si la guardia se rompiera, lo peor posible es un archivo vacío de más.
2. La misma prueba apuntando a una base efímera del temporal pasa — la guardia no puede estorbar a la suite.
3. Fuera del contexto de pruebas, conectarse a una base dentro del repositorio funciona con normalidad.

## Qué es `dev.db` en realidad

Revisada el 2026-09-14, en solo lectura. **No está rota: está congelada, y por diseño.**

Fue la base de trabajo real hasta el 2026-08-08. Todavía tiene los datos de entonces —72 tablas pobladas, 18 facturas, 18 pedidos, 113 asientos contables con 247 detalles, 57 movimientos de kardex, 49 depreciaciones, 5 usuarios— y la hora exacta en que se detuvo está registrada dentro:

| Rastro | Último |
| --- | --- |
| Ejecución de tarea programada | 2026-08-08 00:33 UTC |
| Sesión de usuario | 2026-08-08 00:39 UTC |
| Migración aplicada | `20260805231615_sunat_gaps_ubigeo` |

Al 2026-09-14 lleva **27 migraciones aplicadas y 85 pendientes** — la primera sin aplicar es `20260812170000_login_rate_limit`. Tiene 105 tablas contra las 171 de una base al día. Le faltan, entre otras, `almacenes.tipo` y `ordenes_mantenimiento.empresaId`, y su tabla `empresas` está vacía: la compañía `"1"` la inserta el seed, no una migración, y el seed no corre desde antes de todo el trabajo multiempresa.

Las 27 aplicadas **existen todas en el repositorio**: no hay linaje divergente ni historia reescrita. Está limpiamente 85 migraciones atrás, y podría ponerse al día el día que se decida.

### Por qué se congeló

La causa es la propia protección, y la cadena se explica sola:

1. Está declarada protegida — *no se abre, no se migra, no se modifica*. Eso prohíbe literalmente correr `prisma migrate deploy` contra ella, así que quedó imposibilitada de avanzar.
2. **2026-08-12**: aterrizan la suite automatizada y CI. La verificación se muda a una base efímera del temporal.
3. **2026-09-11**: aterriza `npm run dev:demo`, cuyo propio documento lo dice sin rodeos — *"no había forma de revisar la aplicación en el navegador sin apuntar el servidor de desarrollo a `dev.db`, que es una base protegida"*. La verificación en pantalla se muda a `.demo/demo.db`.

Cada flujo posterior se diseñó para no tocarla. No quedó ninguno capaz de ponerla al día.

### El cabo suelto que se cerró

Hasta el 2026-09-14 el `.env` de la copia de trabajo decía `DATABASE_URL="file:./dev.db"`, y el README instruía crearlo así y correr `migrate deploy` encima. El README no estaba equivocado en general —describe un clon limpio, donde `dev.db` no existe y la crea el propio comando—, pero en esta copia de trabajo ese nombre ya estaba ocupado por la base protegida. Cualquier proceso que no sobrescribiera `DATABASE_URL` le apuntaba por omisión: `npm run dev`, `prisma migrate`, o un `npx tsx` suelto.

La base de desarrollo local pasa a llamarse **`local.db`** (ignorada por git, creada con `migrate deploy` + `db seed`). `dev.db` queda como lo que ya era: un archivo histórico del 2026-08-08 que nadie vuelve a rozar por omisión.

### El valor por defecto que hacía silencioso el olvido

Al hacer el cambio apareció una segunda causa, más grave que la del `.env`, y que lo explica todo hacia atrás.

`src/lib/prisma.ts` decía:

```ts
const urlBase = process.env.DATABASE_URL ?? "file:./dev.db";
```

Y `server.ts` **no cargaba `.env`** —no es una ruta de Next, así que nadie lo hacía por él—, mientras importaba `./src/lib/tareasProgramadas` en su séptima línea, que arrastra `@/lib/prisma`. Resultado: el módulo se evaluaba con `DATABASE_URL` sin definir y caía al valor por defecto. Como el cliente queda cacheado en `globalThis`, todo lo demás reusaba esa conexión.

Es decir: **`npm run dev` siempre corrió contra `dev.db`, con `.env` o sin él.** De ahí salen los 488 registros de tareas programadas y la sesión del 2026-08-08 que tiene adentro. Y por eso cambiar el `.env` no bastó: el servidor lo ignoraba.

Las dos correcciones:

- **`prisma.ts` ya no tiene base por defecto.** Sin `DATABASE_URL` lanza un error que dice qué configurar. Adivinar la base es peor que no arrancar: quien olvida configurarla ve un error inmediato, no datos ajenos ni escrituras donde no van.
- **`server.ts` carga `.env` antes que cualquier módulo propio.** El import va primero a propósito.

El mismo olvido afectaba a `npm run respaldo`, que corre en su propio proceso bajo tsx: leía `DATABASE_URL` y `RESPALDO_DIR` vacías y decía que no había base que respaldar aunque estuviera configurada. También carga `.env` ahora.

`tests/base-por-configuracion.test.ts` ejecuta un proceso sin `DATABASE_URL` y exige que falle con el mensaje y sin crear ninguna base, y comprueba que `prisma.ts` no vuelva a llevar una ruta literal y que `server.ts` cargue `.env` **antes** de sus imports propios.
