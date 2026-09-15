# Respaldo y restauración

Estrategia de respaldo y recuperación de la base del ERP. Cubre el ítem transversal de Oleada 1: *"Backup automatizado programado + procedimiento de restauración probado al menos una vez"*.

> **Aviso 2026-09-15: la base de trabajo no tiene copias automáticas.** El proyecto migró a PostgreSQL y **PostgreSQL todavía no tiene controlador de respaldo**. Los respaldos `.db` ya existentes se siguen verificando y restaurando, pero mientras el controlador no exista, las copias de la base viva hay que hacerlas a mano. Véase [PostgreSQL se reconoce, pero todavía no se respalda](#postgresql-se-reconoce-pero-todavía-no-se-respalda).

El núcleo es agnóstico del motor y las primitivas de cada base viven en un controlador aparte. Ver [Portabilidad](#portabilidad-qué-es-del-motor-y-qué-no).

## Por qué `VACUUM INTO` y no copiar el archivo

Copiar `dev.db` con el explorador o con `cp` mientras el servidor escribe puede producir una copia rota — y el problema es que **no se nota hasta el día que se necesita**. `VACUUM INTO` es la primitiva que SQLite ofrece justamente para esto: escribe una copia consistente y compactada en un archivo nuevo, sin bloquear escrituras, sin modificar el origen, y falla si el destino ya existe.

Además, cada respaldo se escribe primero con nombre temporal (`.parcial`) y solo se renombra al nombre definitivo **después** de pasar `PRAGMA integrity_check`. Así el directorio nunca contiene un archivo con nombre de respaldo válido que en realidad no sirve. Si la verificación falla, el archivo se descarta: un respaldo corrupto guardado es peor que ninguno, porque aparenta una cobertura que no existe.

Junto a cada respaldo queda un manifiesto `.sha256` con el hash del archivo.

## Respaldo automático

La tarea programada `RESPALDO_BASE` corre con el resto de tareas del servidor y deja constancia en `/configuracion/tareas-programadas`, donde además un ADMIN puede dispararla a mano.

**No corre sola por defecto.** Exige la variable de entorno `RESPALDO_DIR`. Sin ella la tarea registra *"Respaldo no configurado"* y no toca ningún archivo — instalar una versión nueva nunca debe empezar a escribir copias en una ruta que nadie eligió.

| Variable | Qué hace | Por defecto |
| --- | --- | --- |
| `RESPALDO_DIR` | Directorio donde se guardan los respaldos. **Sin ella la tarea no hace nada.** | — |
| `RESPALDO_RETENCION` | Cuántos respaldos se conservan; los más antiguos se eliminan con su manifiesto. | 7 |
| `RESPALDO_INTERVALO_HORAS` | Cada cuánto corresponde una copia nueva. La tarea se ejecuta cada hora, pero solo respalda si la copia más reciente ya tiene esta antigüedad. | 24 |

Conviene que `RESPALDO_DIR` apunte a un disco distinto del de la base: un respaldo en el mismo disco no protege contra la falla que más probablemente ocurra.

Con retención 0 o negativa **no se borra nada**: "no conservar ninguno" casi siempre es un error de configuración, no una instrucción. Un intervalo que no sea un número positivo se ignora del mismo modo y vale el de por defecto.

### La tarea corre cada hora; el respaldo no

La tarea programada se dispara al arrancar el servidor y luego cada hora, como todas. Eso **no** significa un respaldo por hora: antes de copiar nada, mira el directorio y solo respalda si la copia más reciente ya tiene la antigüedad de `RESPALDO_INTERVALO_HORAS`. Si no, deja constancia de que no correspondía y no toca ningún archivo.

Sin esa comprobación, con retención 7 se conservarían **las últimas siete horas** en vez de la última semana, y reiniciar el servidor siete veces —o pulsar "Ejecutar ahora" siete veces— borraría el historial entero. La suite reproduce exactamente esa secuencia: una semana de copias, siete corridas la misma tarde, y verifica que la semana sigue completa.

El directorio es la fuente de verdad, no una tabla ni la fecha de modificación del archivo: la fecha de cada copia va en su nombre, y una tabla diría que existen respaldos que quizá ya no están. Una marca de tiempo en el futuro —reloj corregido hacia atrás, copias traídas de otra máquina— no bloquea el respaldo a la espera de que el tiempo la alcance: ante la duda se respalda, que es el lado barato del error.

Si hace falta una copia extra fuera de la cadencia, está el respaldo manual, que siempre crea una.

## Respaldo manual

```bash
npm run respaldo -- --dir D:/respaldos-erp --retencion 14
```

El origen sale de `DATABASE_URL`; el script no adivina qué base respaldar. Imprime ruta, tamaño y SHA256.

## Restauración

```bash
npm run restaurar -- --respaldo D:/respaldos-erp/erp-20260911-030000.db --destino D:/Escritorio/ERP/dev.db --forzar
```

Tres protecciones, en este orden:

1. **Se rechaza si origen y destino son el mismo archivo**, antes de tocar nada.
2. **Se verifica la integridad del respaldo antes de escribir.** Si el respaldo está corrupto, no se restaura nada y la base viva queda intacta.
3. **Sin `--forzar` se niega a pisar un archivo existente.** Restaurar encima de la base viva es precisamente la operación que no debe poder hacerse por accidente, así que el destino se indica siempre de forma explícita: el script nunca deduce que hay que sobrescribir la base en uso.

**Detenga el servidor antes de restaurar sobre la base en uso.** Restaurar bajo un servidor activo deja conexiones apuntando a un archivo que ya no existe.

## Procedimiento de recuperación, probado

El roadmap exige que la restauración esté probada al menos una vez. Está ejercida de punta a punta en la suite (`tests/respaldo.test.ts`), sobre bases efímeras en el temporal del sistema — ninguna prueba abre ni copia la base de desarrollo:

1. Se crea una base con un dato conocido.
2. Se respalda y se verifica que la copia trae los datos, que el SHA256 del manifiesto coincide y que **el origen queda intacto**.
3. Se modifica la base viva después del respaldo.
4. Se intenta restaurar sin confirmación: se rechaza y la base viva conserva el dato nuevo.
5. Se intenta restaurar sobre sí misma: se rechaza.
6. Se restaura en una ruta nueva: aparece el dato del respaldo.
7. Se restaura sobre la base viva con confirmación explícita: el dato vuelve al estado respaldado.

También se prueba que un archivo que no es una base SQLite se rechaza sin escribir nada, y que la retención elimina el respaldo más antiguo junto con su manifiesto, sin dejarlo huérfano.

Y, para cualquier motor: si el controlador no verifica su propia copia, el archivo se descarta y **el directorio no queda con un respaldo aparente**.

## Qué no cubre

- **Réplica fuera del sitio.** El respaldo queda donde apunte `RESPALDO_DIR`. Llevarlo a otro edificio o a almacenamiento remoto es una decisión de infraestructura, no de la aplicación.
- **Punto de recuperación.** Con respaldo diario, el peor caso es perder un día de operación. Bajar eso exige replicación o WAL archiving, y depende de cuánta pérdida tolera el negocio — un dato que no está en el código.
- **Los archivos adjuntos en disco**, que viven fuera de la base y necesitan su propia copia.

## Portabilidad: qué es del motor y qué no

El módulo está partido en dos.

**El núcleo es agnóstico del motor.** Cómo se llama el archivo, en qué orden quedan, cuántos se conservan, el manifiesto SHA256, escribir en `.parcial` y renombrar recién al verificar, negarse a pisar un archivo existente: nada de eso depende de que la base sea SQLite. Es la mayor parte del módulo y la que costaría rehacer.

**El motor aporta tres operaciones**, reunidas en un `ControladorRespaldo`:

| Operación | SQLite | PostgreSQL (pendiente) |
| --- | --- | --- |
| `copiar` | `VACUUM INTO` | `pg_dump -Fc` |
| `verificar` | `PRAGMA integrity_check` | `pg_restore --list` |
| `restaurar` | `VACUUM INTO` sobre el destino | `pg_restore` |
| `extension` | `.db` | `.dump` |

El controlador de SQLite abre el archivo **con better-sqlite3 directamente**. Hasta el 2026-09-15 lo hacía a través de un `PrismaClient`, y el día de migrar a PostgreSQL dejó de poder construirse: Prisma rechaza un adaptador de un motor distinto al del esquema, así que el módulo se quedó **sin ningún controlador capaz de correr** — ni siquiera para verificar los respaldos que ya existían. Ese intermediario nunca aportó nada: acá no hay modelos ni consultas generadas, solo dos sentencias contra un archivo que ni siquiera tiene el esquema de la aplicación. Vale la pena anotarlo porque la auditoría de portabilidad no lo previó, y es el tipo de acoplamiento que solo se ve cuando se rompe.

El día de la migración hay que escribir ese objeto y nada más. Que eso sea cierto no es una promesa: la suite conduce el núcleo completo —respaldo, verificación, manifiesto, retención y restauración— con un controlador de prueba que **no toca SQLite** y declara motor `POSTGRES` y extensión `.dump`. Si alguna primitiva de SQLite vuelve a filtrarse a `crearRespaldo` o `restaurarRespaldo`, una guardia estructural falla.

La retención respeta la extensión del motor, así que un respaldo `.db` y uno `.dump` pueden convivir en el mismo directorio sin que uno borre al otro durante la transición.

### PostgreSQL se reconoce, pero todavía no se respalda

Si `DATABASE_URL` apunta a PostgreSQL, el respaldo **falla con un mensaje que dice exactamente qué falta**:

> DATABASE_URL apunta a PostgreSQL y el respaldo todavía no tiene controlador para ese motor. Hace falta implementarlo con pg_dump/pg_restore y probarlo contra una base real antes de confiar en él.

Antes el mensaje era *"DATABASE_URL no apunta a un archivo SQLite"* — cierto, y a la vez inútil el día de migrar, porque no distingue una URL de PostgreSQL de una cadena sin sentido.

**Por qué sigue sin escribirse, ahora que sí hay `pg_dump`.** El motivo original —en esta máquina no había PostgreSQL en ninguna forma— dejó de valer el 2026-09-15: `pg_dump` y `pg_restore` están en `D:/Escritorio/ERP-postgres/pgsql/bin`. Lo que queda es una razón distinta y más concreta: **el núcleo trata el destino de una restauración como un archivo** —lo consulta con `stat`, se niega a pisarlo, lo borra y le calcula el SHA256—, y el destino de un `pg_restore` es una **base**, no un archivo. Escribir `copiar` y `verificar` es directo; `restaurar` exige que esa parte del núcleo también se vuelva agnóstica, y eso es el trabajo de verdad.

Lo que no cambia es el criterio: un respaldo que nunca corrió contra una base real no es un respaldo, es una creencia — y creer que hay copias cuando no las hay es peor que saber que no las hay, porque el error se descubre el día que ya es tarde. Por eso el controlador sigue negándose en vez de existir a medias. **Mientras tanto la base de trabajo no tiene copias automáticas**, y eso hay que decirlo en voz alta, no dejarlo implícito en un mensaje de error.

La restauración elige el controlador por la extensión del artefacto: intentar restaurar un `.dump` con el driver de SQLite diría *"no pasó la verificación de integridad"* y mandaría a buscar el problema donde no está.

## Los comandos funcionaban solo en el papel

`npm run respaldo` y `npm run restaurar` morían al arrancar, con `ERR_MODULE_NOT_FOUND`, desde que existen: definían `NODE_OPTIONS` **dentro de un proceso que ya había arrancado** —Node esa variable la lee al iniciar— y después importaban TypeScript, así que nadie registraba `tsx` y el alias `@/` no resolvía. Ninguna prueba lo notaba porque todas importaban la librería directamente, y la tarea programada sí funcionaba porque corre dentro del servidor.

Ahora cada comando es un lanzador que ejecuta su lógica en un proceso hijo bajo `tsx` —el mismo patrón del runner de pruebas y de la demo—, y la suite ejecuta ambos comandos tal cual los corre una persona: si vuelven a no arrancar, la prueba lo dice.
