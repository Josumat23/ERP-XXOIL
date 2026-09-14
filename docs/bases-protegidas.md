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
