# Respaldo y restauración

Estrategia de respaldo y recuperación de la base del ERP. Cubre el ítem transversal de Oleada 1: *"Backup automatizado programado + procedimiento de restauración probado al menos una vez"*.

> **2026-09-15: PostgreSQL ya se respalda.** El controlador estuvo declarado y **rechazado** tres días, desde la migración de motor. Ahora existe, con `pg_dump -Fc` / `pg_restore`, y la suite lo ejerce **contra un PostgreSQL de verdad**: vuelca una base con datos, verifica el artefacto, lo restaura en otra base y comprueba que los datos llegaron. Los respaldos `.db` de SQLite se siguen verificando y restaurando. Véase [El controlador de PostgreSQL](#el-controlador-de-postgresql).

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

| Operación | SQLite | PostgreSQL |
| --- | --- | --- |
| `copiar` | `VACUUM INTO` | `pg_dump --format=custom` |
| `verificar` | `PRAGMA integrity_check` | `pg_restore --list` |
| `restaurar` | `VACUUM INTO` sobre el destino | `pg_restore --exit-on-error` |
| `extension` | `.db` | `.dump` |

El controlador de SQLite abre el archivo **con better-sqlite3 directamente**. Hasta el 2026-09-15 lo hacía a través de un `PrismaClient`, y el día de migrar a PostgreSQL dejó de poder construirse: Prisma rechaza un adaptador de un motor distinto al del esquema, así que el módulo se quedó **sin ningún controlador capaz de correr** — ni siquiera para verificar los respaldos que ya existían. Ese intermediario nunca aportó nada: acá no hay modelos ni consultas generadas, solo dos sentencias contra un archivo que ni siquiera tiene el esquema de la aplicación. Vale la pena anotarlo porque la auditoría de portabilidad no lo previó, y es el tipo de acoplamiento que solo se ve cuando se rompe.

El día de la migración hay que escribir ese objeto y nada más. Que eso sea cierto no es una promesa: la suite conduce el núcleo completo —respaldo, verificación, manifiesto, retención y restauración— con un controlador de prueba que **no toca SQLite** y declara motor `POSTGRES` y extensión `.dump`. Si alguna primitiva de SQLite vuelve a filtrarse a `crearRespaldo` o `restaurarRespaldo`, una guardia estructural falla.

La retención respeta la extensión del motor, así que un respaldo `.db` y uno `.dump` pueden convivir en el mismo directorio sin que uno borre al otro durante la transición.

### El controlador de PostgreSQL

Escrito el 2026-09-15, después de que la migración de motor lo volviera urgente.

| | |
| --- | --- |
| Copiar | `pg_dump --format=custom --no-owner --no-acl` |
| Verificar | `pg_restore --list` |
| Restaurar | `pg_restore --no-owner --no-acl --exit-on-error` |
| Extensión | `.dump` |

**`pg_dump` vuelca dentro de una transacción**, así que la copia es consistente aunque el sistema esté escribiendo y no bloquea a nadie — es la misma propiedad que hace correcto a `VACUUM INTO` en SQLite. El formato propio (`--format=custom`) además se puede inspeccionar sin restaurar, que es lo que hace posible verificar una copia sin tener adónde ponerla.

**`--no-owner --no-acl`** porque el dueño y los permisos son del servidor donde se hizo la copia. Conservarlos haría fallar la restauración en cualquier otro servidor, que es exactamente el día en que se necesita.

**`--exit-on-error` es lo que separa una restauración de una ilusión.** Por omisión `pg_restore` informa los errores y **sigue**, terminando con código 0: la base quedaría a medias y quien opera leería que salió bien.

**Verificar exige que el volcado no esté vacío.** Un volcado de cero objetos es sintácticamente válido, `pg_restore --list` lo acepta, y no sirve para nada — es justo lo que produciría respaldar la base equivocada. Si `verificar` solo mirara el código de salida, eso pasaría por bueno.

#### Las herramientas tienen que estar

`pg_dump` y `pg_restore` son parte de las herramientas cliente de PostgreSQL. Si están en el PATH no hay nada que configurar; si no —el caso de la instalación portable de esta máquina, que no toca el PATH— se define `PG_BIN_DIR` con el directorio que las contiene:

```
PG_BIN_DIR="D:/Escritorio/ERP-postgres/pgsql/bin"
```

Sin ellas el error **nombra la variable**, en vez de un `ENOENT` que manda a buscar el problema donde no está.

Una advertencia que cuesta descubrir sola: **el cliente no puede ser de una versión menor que el servidor.** `pg_dump` 16 contra un servidor 17 se niega con «server version mismatch». Al revés —cliente nuevo, servidor viejo— funciona.

#### Restaurar sobre una base, no sobre un archivo

Ésta es la parte que obligó a tocar el núcleo, y es la razón por la que el controlador no se pudo escribir antes.

El núcleo trataba el destino de una restauración como una **ruta**: lo consultaba con `stat`, se negaba a pisarlo, lo borraba con `unlink` y le calculaba el SHA256 al terminar. El destino de un `pg_restore` es una **base**. Copiar nunca tuvo ese problema —un volcado siempre es un archivo—, pero restaurar sí.

La solución fue la misma que ya se había usado para copiar: cinco preguntas que el núcleo hace **siempre en el mismo orden** y que cada motor contesta a su manera.

| Pregunta del núcleo | SQLite | PostgreSQL |
| --- | --- | --- |
| ¿Qué es este destino? | una ruta | una URL de conexión |
| ¿Es el mismo que el respaldo? | misma ruta resuelta | nunca (archivo vs. base) |
| ¿Ya tiene contenido? | el archivo existe | el esquema tiene tablas |
| Vacíalo | `unlink` | `DROP SCHEMA public CASCADE` |
| ¿Qué quedó? | SHA256 del archivo | cuántas tablas |

**El orden importa más que cualquiera de los pasos**, y por eso vive en el núcleo: si la verificación fuera después de vaciar, un respaldo corrupto dejaría la base destruida **y** sin nada con qué reemplazarla. Hay una prueba que lo ejerce con un volcado roto y comprueba que el destino sigue intacto.

Vaciar es `DROP SCHEMA public CASCADE` y no borrar la base entera, a propósito: borrarla exigiría conectarse a `postgres` como superusuario, y quien restaura no tiene por qué serlo. Con el esquema alcanza para que la restauración parta de cero en vez de mezclarse con lo que hubiera antes — y hay una prueba que lo comprueba: restaura sobre una base con una tabla ajena y exige que después quede **solo** lo del respaldo.

#### Las credenciales no salen en los mensajes

Los resúmenes y errores de esta librería terminan en el registro de tareas programadas, que se lee **desde una pantalla**. Una contraseña ahí dentro queda guardada en la base y a la vista de cualquiera que abra esa pantalla, así que toda URL que salga en un mensaje pasa por `urlSinCredenciales()`.

#### Restaurar, en concreto

```bash
npm run restaurar -- --respaldo /ruta/erp-20260915-030000.dump --destino "postgresql://usuario@maquina:5432/base_nueva"
```

El destino es una **ruta** para un `.db` y una **URL** para un `.dump`; el motor sale de la extensión del artefacto. Sin `--forzar` se niega si el destino ya tiene contenido.
