# Respaldo y restauración

Estrategia de respaldo y recuperación de la base SQLite del ERP. Cubre el ítem transversal de Oleada 1: *"Backup automatizado programado + procedimiento de restauración probado al menos una vez"*.

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

Conviene que `RESPALDO_DIR` apunte a un disco distinto del de la base: un respaldo en el mismo disco no protege contra la falla que más probablemente ocurra.

Con retención 0 o negativa **no se borra nada**: "no conservar ninguno" casi siempre es un error de configuración, no una instrucción.

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

## Qué no cubre

- **Réplica fuera del sitio.** El respaldo queda donde apunte `RESPALDO_DIR`. Llevarlo a otro edificio o a almacenamiento remoto es una decisión de infraestructura, no de la aplicación.
- **Punto de recuperación.** Con respaldo diario, el peor caso es perder un día de operación. Bajar eso exige replicación o WAL archiving, y depende de cuánta pérdida tolera el negocio — un dato que no está en el código.
- **Los archivos adjuntos en disco**, que viven fuera de la base y necesitan su propia copia.

## Atado a SQLite

`VACUUM INTO` y `PRAGMA integrity_check` son primitivas de SQLite. Es la decisión correcta mientras la base sea SQLite —son las herramientas que el motor da para esto—, pero conviene tenerlo anotado: **si alguna vez se migra a PostgreSQL, este módulo hay que reemplazarlo**, no adaptarlo. El equivalente sería `pg_dump` con su propia verificación.

Queda registrado en el roadmap junto a la fila de esa migración, para que no se descubra a mitad del cambio de motor.
